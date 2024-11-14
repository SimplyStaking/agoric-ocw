import { NOBLE_DOMAIN } from "./config/config";
import { addTransaction, getTransactionByHash, updateTransactionStatus } from "./lib/db";
import { NobleLCD, getForwardingAccount, getNobleLCDClient } from "./lib/noble-lcd";
import { CCTPTxEvidence, DepositForBurnEvent, NobleAddress, TransactionStatus } from "./types";
import { decodeToNoble } from "./utils/address";
import {logger} from "./utils/logger";
import { incrementEventsCount, incrementRevertedCount, incrementTotalAmount } from "./metrics";

export async function processCCTPBurnEventLog(event: DepositForBurnEvent, originChain: string, nobleLCD = getNobleLCDClient()): (Promise<CCTPTxEvidence | null>) {
    
    // If not to noble
    if(event.destinationDomain != (NOBLE_DOMAIN || 4)){
        logger.debug(`NOT FOR NOBLE from ${originChain}: ${event.transactionHash}`)
        return null;
    }
    
    logger.info(`Found DepositForBurn from ${originChain} to NOBLE (TX: ${event.transactionHash} on block ${event.blockNumber})`)    

    // Get noble address
    let nobleAddress = decodeToNoble(event.mintRecipient || "")

    let agoricForwardingAcct = await getForwardingAccount(nobleLCD, nobleAddress as NobleAddress)

    // If not an agoric forwarding account
    if(!agoricForwardingAcct){
        logger.error(`(TX ${event.transactionHash}) ${nobleAddress} not an Agoric forwarding account `)
        return null;
    }

    logger.info(`(TX ${event.transactionHash}) ${nobleAddress} is an Agoric forwarding address (${agoricForwardingAcct.channel} -> ${agoricForwardingAcct.recipient})`)
    
    // Get tx from DB if already there
    let tx = await getTransactionByHash(event.transactionHash, originChain)

    // If reorged
    if(event.removed){
        logger.info(`${event.transactionHash} on ${originChain} was REORGED`)
        
         // Check if tx exists
         if(tx && tx?.status == TransactionStatus.REORGED){
            logger.debug(`Reorged TX ${event.transactionHash} on ${originChain} already processed`)
            return null;
        }

        // Update record in DB
        await updateTransactionStatus(event.transactionHash, originChain, TransactionStatus.REORGED)

        // Increment metric
        incrementRevertedCount(originChain)

        return {
            amount: event.amount,
            status: TransactionStatus.REORGED,
            blockHash: event.blockHash,
            blockNumber: event.blockNumber,
            forwardingAddress: nobleAddress as NobleAddress,
            forwardingChannel: agoricForwardingAcct.channel,
            recipientAddress: agoricForwardingAcct.recipient,
            txHash: event.transactionHash!,
        }
    }

     // Check if tx exists
     if(tx && tx?.status == TransactionStatus.CONFIRMED){
        logger.debug(`TX ${event.transactionHash} on ${originChain} already processed`)
        return null;
    }

    let amount = Number(event.amount)
    incrementEventsCount(originChain)
    incrementTotalAmount(originChain, amount)

    await addTransaction({
        chain: originChain,
        status: TransactionStatus.CONFIRMED,
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        amount: Number(event.amount),
        recipientAddress: agoricForwardingAcct.recipient
    })

    return {
        amount: event.amount,
        status: TransactionStatus.CONFIRMED,
        blockHash: event.blockHash,
        blockNumber: event.blockNumber,
        forwardingAddress: nobleAddress as NobleAddress,
        forwardingChannel: agoricForwardingAcct.channel,
        recipientAddress: agoricForwardingAcct.recipient,
        txHash: event.transactionHash!,
    }
}