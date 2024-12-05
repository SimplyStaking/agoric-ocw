import { addRemovedTX, addTransaction, getTransactionByHash, updateTransactionStatus } from "./lib/db";
import { NobleLCD, getForwardingAccount, getNobleLCDClient } from "./lib/noble-lcd";
import { CCTPTxEvidence, DepositForBurnEvent, NobleAddress, TransactionStatus } from "./types";
import { decodeToNoble } from "./utils/address";
import { logger } from "./utils/logger";
import { incrementEventsCount, incrementRevertedCount, incrementTotalAmount } from "./metrics";
import { vStoragePolicy } from "./lib/agoric";
import { ENV } from "./config/config";

export async function processCCTPBurnEventLog(event: DepositForBurnEvent, originChain: string, nobleLCD = getNobleLCDClient()): (Promise<CCTPTxEvidence | null>) {
    // If not to noble
    if (event.destinationDomain != (vStoragePolicy.nobleDomainId || 4)) {
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

    let amount = Number(event.amount)
    if (agoricForwardingAcct.recipient != "UNKNOWN") {
        incrementEventsCount(originChain)
        incrementTotalAmount(originChain, amount)
    }

    await addTransaction({
        chain: originChain,
        status: TransactionStatus.CONFIRMED,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        amount: Number(event.amount),
        recipientAddress: agoricForwardingAcct.recipient,
        forwardingAddress: nobleAddress,
        forwardingChannel: vStoragePolicy.nobleAgoricChannelId,
        blockHash: event.blockHash,
        blockTimestamp: Number(event.blockTimestamp),
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