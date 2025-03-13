import { addRemovedTX, addTransaction, getBlockSums, getNobleAccount, getTransactionByHash, sumTransactionAmounts, updateTransactionStatus } from "./lib/db";
import { getForwardingAccount, getNobleLCDClient, NobleLCD } from "./lib/noble-lcd";
import { CCTPTxEvidence, ChainPolicy, DepositForBurnEvent, NobleAddress, OCWForwardingAccount, TransactionStatus, TxThreshold, VStorage } from "./types";
import { logger } from "./utils/logger";
import { incrementEventsCount, incrementRevertedCount, incrementTotalAmount, setCurrentBlockRangeAmount } from "./metrics";
import { decodeAddress, queryWorkerForNFA, settlementAccount, vStoragePolicy } from "./lib/agoric";
import { ENV } from "./config/config";
import { NOBLE_CCTP_DOMAIN, UNKNOWN_FA } from "./constants";
import { getTotalSumForChainBlockRangeAmount, incrementOrCreateBlock } from "./state";
import { Hex } from "viem";
import { decodeToNoble } from "./utils/address";

/**
 * Function to get the confirmations needed for an amount
 * @param amount The amount for the TX
 * @param policy The chain policy
 * @returns a number of confirmations or -1 if above the threshold
 */
function getConfirmations(amount: number, policy: ChainPolicy): number {
    const txThresholds = policy.txThresholds
    if (!txThresholds || txThresholds.length == 0) {
        return policy.confirmations;
    }

    // Sort thresholds by maxAmount in ascending order
    const sortedThresholds = [...txThresholds].sort((a, b) => a.maxAmount - b.maxAmount);

    // Find the first threshold where the amount is less than or equal to maxAmount
    const threshold = sortedThresholds.find(t => amount <= t.maxAmount);

    // Return the confirmations or a default value (e.g., -1) if no threshold is matched
    return threshold ? threshold.confirmations : -1;
}

/**
 * Gets a forwarding account (channel and recipient) from a noble address
 * @param nobleLCD nobleLCD to query noble
 * @returns A forwarding account or null if its not an agoric forwarding account
 */
export const getOCWForwardingAccount =
    async (nobleLCD: NobleLCD, address: NobleAddress): Promise<OCWForwardingAccount | null> => {
        // Forwarding target derivation requires a query to a Noble LCD or RPC node.
        // The response is deterministic, so let's store results in a DB
        const cached = await getNobleAccount(address)
        if (cached) {
            logger.debug(`Retrieved Noble forwarding account details from DB for ${address}.`);
            const { isAgoricForwardingAcct, account } = cached;
            if (!isAgoricForwardingAcct) {
                logger.debug(`${address} is not an Agoric forwarding account.`);
                return null;
            }
            return {
                channel: account?.channel,
                recipient: account?.recipient
            } as OCWForwardingAccount;
        }

        let workerNFA = await queryWorkerForNFA(address)

        if (workerNFA) {
            logger.debug(`Found Noble Forwarding Account for ${address} from worker`)
            return workerNFA
        }

        let lcdNBA = await getForwardingAccount(nobleLCD, address)

        if (lcdNBA) {
            return {
                channel: lcdNBA?.channel,
                recipient: lcdNBA?.recipient
            } as OCWForwardingAccount;
        }

        return null
    };

export async function processCCTPBurnEventLog(event: DepositForBurnEvent, originChain: string, nobleLCD = getNobleLCDClient(), backfilling: boolean = false): (Promise<CCTPTxEvidence | null>) {
    // If not to noble
    if (event.destinationDomain != (vStoragePolicy.nobleDomainId || NOBLE_CCTP_DOMAIN)) {
        logger.debug(`NOT FOR NOBLE from ${originChain}: ${event.transactionHash}`)
        return null;
    }

    logger.info(`Found DepositForBurn from ${originChain} to NOBLE (TX: ${event.transactionHash} on block ${event.blockNumber})`)

    // Get noble address
    const nobleAddress = decodeToNoble(event.mintRecipient || "")

    const agoricForwardingAcct = await getOCWForwardingAccount(nobleLCD, nobleAddress as NobleAddress)

    // If not an agoric forwarding account
    if (!agoricForwardingAcct) {
        logger.error(`(TX ${event.transactionHash}) ${nobleAddress} not an Agoric forwarding account `)
        return null;
    }

    // If not noble contract address
    if (ENV != "dev" && !vStoragePolicy.chainPolicies[originChain].attenuatedCttpBridgeAddresses.includes(event.depositor as Hex)) {
        logger.error(`(TX ${event.transactionHash}) not from Noble contract address (FROM: ${event.sender}) `)
        return null;
    }

    logger.info(`(TX ${event.transactionHash}) ${nobleAddress} ${agoricForwardingAcct.recipient == UNKNOWN_FA ? "could be": "is"} an Agoric forwarding address (${agoricForwardingAcct.channel} -> ${agoricForwardingAcct.recipient})`)

    // Get tx from DB if already there
    const tx = await getTransactionByHash(event.transactionHash, originChain)

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
            sender: event.sender as Hex
        }
    }

    // Check if tx exists
    if (tx && tx?.status != TransactionStatus.REORGED) {
        logger.debug(`TX ${event.transactionHash} on ${originChain} already processed`)
        return null;
    } else {
        if(!tx){
            logger.debug(`No existing tx ${event.transactionHash} found on ${originChain}`)
        }
        else{
            logger.debug(`Existing tx ${event.transactionHash} found on ${originChain} with status ${tx?.status}`)
        }
    }

    // Check for settlementAccount
    const decodedAddress = decodeAddress(agoricForwardingAcct.recipient)
    if (!decodedAddress) {
        logger.error(`TX ${event.transactionHash} on ${originChain} with address ${agoricForwardingAcct.recipient} could not be decoded`)
        return null;
    }
    else if (decodedAddress && decodedAddress.baseAddress != settlementAccount) {
        logger.error(`TX ${event.transactionHash} on ${originChain} with base address ${decodedAddress.baseAddress} is not the settlement account( address:${settlementAccount} )`)
        return null;
    }

    const amount = Number(event.amount)
    if (agoricForwardingAcct.recipient != UNKNOWN_FA) {
        logger.debug(`New Agoric destined CCTP event detected with hash ${event.transactionHash}`)
        incrementEventsCount(originChain)
        incrementTotalAmount(originChain, amount)
    }

    const risksIdentified: string[] = []
    // Check tx amount
    if (Number(event.amount) > vStoragePolicy.chainPolicies[originChain].rateLimits.tx) {
        logger.error(`TX ${event.transactionHash} on ${originChain} with amount ${amount} exceeds the TX amount limit ${vStoragePolicy.chainPolicies[originChain].rateLimits.tx}`)
        risksIdentified.push("TX_LIMIT_EXCEEDED")
    }

    // Get current sum for block range
    // If backfilling, get the count from DB, otherwise from state
    const currentBlockRangeAmount = backfilling ? (await getBlockSums(originChain, Number(event.blockNumber), vStoragePolicy.chainPolicies[originChain].rateLimits.blockWindowSize)).totalSum : getTotalSumForChainBlockRangeAmount(originChain)
    logger.debug(`${originChain} has an amount of ${currentBlockRangeAmount} in the current block window`)
    const remainingAmountInBlockRange = Number(vStoragePolicy.chainPolicies[originChain].rateLimits.blockWindow) - currentBlockRangeAmount

    // If TX amount is greater than remaining allowed amount
    if (amount > remainingAmountInBlockRange) {
        logger.error(`TX ${event.transactionHash} on ${originChain} with amount ${amount} exceeds the Block amount limit ${vStoragePolicy.chainPolicies[originChain].rateLimits.blockWindow} (Remaining allowed: ${remainingAmountInBlockRange})`)
        risksIdentified.push("BLOCK_RANGE_LIMIT_EXCEEDED")
    }

    // Get confirmations for amount
    const confirmations = getConfirmations(amount, vStoragePolicy.chainPolicies[originChain])

    // If above thresholds
    if (confirmations == -1) {
        logger.error(`TX ${event.transactionHash} on ${originChain} with amount ${amount} exceeds the TX amount limit ${vStoragePolicy.chainPolicies[originChain].rateLimits.tx}`)
        risksIdentified.push("TX_LIMIT_EXCEEDED")
    }

    // If no risks identified, increment block
    if (risksIdentified.length == 0) {
        incrementOrCreateBlock(originChain, Number(event.blockNumber), amount)
        setCurrentBlockRangeAmount(originChain, currentBlockRangeAmount + amount)
    }
    else {
        setCurrentBlockRangeAmount(originChain, currentBlockRangeAmount)
    }

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
        sender: event.sender as Hex,
        depositor: event.depositor as Hex,
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
        chainId: vStoragePolicy.chainPolicies[originChain].chainId,
        sender: event.sender as Hex
    }
}