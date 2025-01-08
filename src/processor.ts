import { addRemovedTX, addTransaction, getTransactionByHash, sumTransactionAmounts, updateTransactionStatus } from "./lib/db";
import { NobleLCD, getForwardingAccount, getNobleLCDClient } from "./lib/noble-lcd";
import { BlockRangeAmountState, CCTPTxEvidence, DepositForBurnEvent, NobleAddress, TransactionStatus, TxThreshold } from "./types";
import { decodeToNoble } from "./utils/address";
import { logger } from "./utils/logger";
import { incrementEventsCount, incrementRevertedCount, incrementTotalAmount } from "./metrics";
import { settlementAccount, vStoragePolicy } from "./lib/agoric";
import { ENV } from "./config/config";
import { NOBLE_CCTP_DOMAIN, UNKNOWN_FA } from "./constants";
import { getTotalSumForChainBlockRangeAmount } from "./state";

/**
 * Function to get the confirmations needed for an amount
 * @param amount The amount for the TX
 * @param txThresholds The transaction thresholds for the chain
 * @returns a number of confirmations or -1 if above the threshold
 */
function getConfirmations(amount: number, txThresholds: TxThreshold[]): number {
    // Sort thresholds by maxAmount in ascending order
    const sortedThresholds = [...txThresholds].sort((a, b) => a.maxAmount - b.maxAmount);

    // Find the first threshold where the amount is less than or equal to maxAmount
    const threshold = sortedThresholds.find(t => amount <= t.maxAmount);

    // Return the confirmations or a default value (e.g., -1) if no threshold is matched
    return threshold ? threshold.confirmations : -1;
}

export async function processCCTPBurnEventLog(event: DepositForBurnEvent, originChain: string, nobleLCD = getNobleLCDClient(), backfilling: boolean = false): (Promise<CCTPTxEvidence | null>) {
    // If not to noble
    if (event.destinationDomain != (vStoragePolicy.nobleDomainId || NOBLE_CCTP_DOMAIN)) {
        logger.debug(`NOT FOR NOBLE from ${originChain}: ${event.transactionHash}`)
        return null;
    }

    logger.info(`Found DepositForBurn from ${originChain} to NOBLE (TX: ${event.transactionHash} on block ${event.blockNumber})`)

    // Get noble address
    let nobleAddress = decodeToNoble(event.mintRecipient || "")

    let agoricForwardingAcct = await getForwardingAccount(nobleLCD, nobleAddress as NobleAddress)

    // If not an agoric forwarding account
    if (!agoricForwardingAcct) {
        logger.error(`(TX ${event.transactionHash}) ${nobleAddress} not an Agoric forwarding account `)
        return null;
    }

    // If not noble contract address
    if (ENV != "dev" && event.sender != vStoragePolicy.chainPolicies[originChain].nobleContractAddress) {
        logger.error(`(TX ${event.transactionHash}) not from Noble contract address (FROM: ${event.sender}) `)
        return null;
    }

    logger.info(`(TX ${event.transactionHash}) ${nobleAddress} is an Agoric forwarding address (${agoricForwardingAcct.channel} -> ${agoricForwardingAcct.recipient})`)

    // Get tx from DB if already there
    let tx = await getTransactionByHash(event.transactionHash, originChain)

    // If reorged
    if (event.removed) {
        logger.info(`${event.transactionHash} on ${originChain} was REORGED`)

        // Check if tx exists
        if (tx && tx?.status == TransactionStatus.REORGED) {
            logger.debug(`Reorged TX ${event.transactionHash} on ${originChain} already processed`)
            return null;
        }

        // Update record in DB
        await updateTransactionStatus(event.transactionHash, originChain, TransactionStatus.REORGED)

        // Add tx to removed TX in DB
        await addRemovedTX(event.transactionHash, originChain)

        // Increment metric
        incrementRevertedCount(originChain)

        return {
            amount: event.amount,
            status: TransactionStatus.REORGED,
            blockHash: event.blockHash,
            blockNumber: event.blockNumber,
            blockTimestamp: event.blockTimestamp,
            chainId: vStoragePolicy.chainPolicies[originChain].chainId,
            forwardingAddress: nobleAddress as NobleAddress,
            forwardingChannel: agoricForwardingAcct.channel,
            recipientAddress: agoricForwardingAcct.recipient,
            txHash: event.transactionHash!,
        }
    }

    // Check if tx exists
    if (tx && tx?.status == TransactionStatus.CONFIRMED) {
        logger.debug(`TX ${event.transactionHash} on ${originChain} already processed`)
        return null;
    }

    // Check for settlementAccount
    if (agoricForwardingAcct.recipient != settlementAccount) {
        logger.debug(`TX ${event.transactionHash} on ${originChain} with recipient ${agoricForwardingAcct.recipient} is not the settlement account( address:${settlementAccount} )`)
        return null;
    }

    let amount = Number(event.amount)
    if (agoricForwardingAcct.recipient != UNKNOWN_FA) {
        incrementEventsCount(originChain)
        incrementTotalAmount(originChain, amount)
    }

    let risksIdentified: string[] = []
    // Check tx amount
    if (Number(event.amount) > vStoragePolicy.chainPolicies[originChain].maxAmountPerTransaction) {
        logger.debug(`TX ${event.transactionHash} on ${originChain} with amount ${amount} exceeds the TX amount limit ${vStoragePolicy.chainPolicies[originChain].maxAmountPerTransaction}`)
        risksIdentified.push("TX_LIMIT_EXCEEDED")
    }

    // Get current sum for block range
    // If backfilling, get the count from DB, otherwise from state
    let currentBlockRangeAmount = backfilling ? await sumTransactionAmounts(originChain, Number(event.blockNumber) - vStoragePolicy.chainPolicies[originChain].blockWindowSize) : getTotalSumForChainBlockRangeAmount(originChain)
    let remainingAmountInBlockRange = Number(vStoragePolicy.chainPolicies[originChain].maxAmountPerBlockWindow) - currentBlockRangeAmount

    // If TX amount is greater than remaining allowed amount
    if (amount > remainingAmountInBlockRange) {
        logger.debug(`TX ${event.transactionHash} on ${originChain} with amount ${amount} exceeds the Block amount limit ${vStoragePolicy.chainPolicies[originChain].maxAmountPerBlockWindow} (Remaining allowed: ${remainingAmountInBlockRange})`)
        risksIdentified.push("BLOCK_RANGE_LIMIT_EXCEEDED")
    }

    // Get confirmations for amount
    let confirmations = getConfirmations(amount, vStoragePolicy.chainPolicies[originChain].txThresholds)

    await addTransaction({
        chain: originChain,
        status: TransactionStatus.CONFIRMED,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        amount: amount,
        recipientAddress: agoricForwardingAcct.recipient,
        forwardingAddress: nobleAddress,
        forwardingChannel: vStoragePolicy.nobleAgoricChannelId,
        blockHash: event.blockHash,
        blockTimestamp: Number(event.blockTimestamp),
        risksIdentified: risksIdentified,
        confirmationBlockNumber: Number(event.blockNumber) + confirmations,
        created: Date.now()
    })

    return {
        amount: event.amount,
        status: TransactionStatus.CONFIRMED,
        blockHash: event.blockHash,
        blockNumber: event.blockNumber,
        blockTimestamp: event.blockTimestamp,
        forwardingAddress: nobleAddress as NobleAddress,
        forwardingChannel: agoricForwardingAcct.channel,
        recipientAddress: agoricForwardingAcct.recipient,
        txHash: event.transactionHash!,
        chainId: vStoragePolicy.chainPolicies[originChain].chainId
    }
}