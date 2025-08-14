import { OfferSpec } from "@agoric/smart-wallet/src/offers";
import { ACTIVE_AGORIC_RPC_INDEX, AGORIC_RPCS, AGORIC_RPC_CHECK_INTERVAL, TX_TIMEOUT_BLOCKS, WATCHER_WALLET_ADDRESS, nextActiveAgoricRPC } from "./config/config";
import { execSwingsetTransaction, getLatestBlockHeight, outputAction, watcherInvitation } from "./lib/agoric";
import { addSubmission, getSubmission, updateSubmissionStatus } from "./lib/db";
import { setAgoricActiveRpc } from "./metrics";
import { AgoricOCWOfferTemplate, AgoricRPCStatus, AgoricSubmissionResponse, CCTPTxEvidence, SubmissionStatus, TransactionStatus } from "./types";
import { logger } from "./utils/logger";
import { incrementWatcherAccountSequenceNumber, setWatcherAccountSequenceNumber, watcherAccount } from "./state";

/**
 * Submits evidence to Agoric
 * @param evidence evidence to submit
 * @param risksIdentified an array of risks identified
 * @param agoricRpcStatus the Agoric RPC status
 */
export async function submitToAgoric(evidence: CCTPTxEvidence, risksIdentified: string[], agoricRpcStatus: AgoricRPCStatus) {

    // Check if already submitted
    let submission = await getSubmission(evidence.txHash, evidence.status == TransactionStatus.REORGED)
    if (submission && submission.submissionStatus != SubmissionStatus.CANCELLED && agoricRpcStatus.height < submission.timeoutHeight) {
        logger.info(`Evidence for TX ${evidence.txHash} has status ${submission.submissionStatus} and a timeout height ${submission.timeoutHeight}. Current Agoric height is ${agoricRpcStatus.height}`)
        return
    }

    // If already failed
    if (submission && submission.submissionStatus == SubmissionStatus.FAILED){
        logger.info(`Submission for TX ${evidence.txHash} has already failed`)
        return
    }

    if (evidence.status == TransactionStatus.REORGED) {
        logger.info(`REORGED TX: ${JSON.stringify(evidence)}`)
        // Set normal submission to cancelled
        await updateSubmissionStatus(evidence.txHash, false, SubmissionStatus.CANCELLED)
    }
    else {
        logger.info(`CONFIRMED TX: ${JSON.stringify(evidence)}`)
    }

    // Create an offer
    let invArgs: any[] = [{
        "aux": {
            "forwardingChannel": evidence.forwardingChannel,
            "recipientAddress": evidence.recipientAddress
        },
        "blockHash": evidence.blockHash,
        "blockNumber": BigInt(evidence.blockNumber),
        "blockTimestamp": BigInt(evidence.blockTimestamp),
        "chainId": evidence.chainId,
        "tx": {
            "amount": BigInt(evidence.amount),
            "forwardingAddress": evidence.forwardingAddress,
            "sender": evidence.sender
        },
        "txHash": evidence.txHash
    }]
    if (risksIdentified.length > 0) {
        invArgs.push({
            risksIdentified: risksIdentified
        })
    }

    let templateOffer: AgoricOCWOfferTemplate = {
        invitationSpec: {
            source: "continuing",
            previousOffer: watcherInvitation,
            invitationMakerName: "SubmitEvidence",
            invitationArgs: invArgs,
        },
        proposal: {},
    };

    let keyring = {
        home: "/app/.agoric",
        backend: "test",
    };

    let id = Number(Date.now());
    let offer: OfferSpec = { ...templateOffer, id };

    let offerData = outputAction({
        method: "executeOffer",
        offer,
    });

    // Set timeout height
    let timeoutHeight = agoricRpcStatus.height + TX_TIMEOUT_BLOCKS;
    // Execute tx
    let response: AgoricSubmissionResponse = await execSwingsetTransaction(
        `wallet-action --allow-spend '${JSON.stringify(offerData)}' --gas-prices=0.01ubld --offline --account-number=${watcherAccount.accountNumber} --sequence=${watcherAccount.sequence} --timeout-height=${timeoutHeight}`,
        WATCHER_WALLET_ADDRESS,
        keyring
    );
    incrementWatcherAccountSequenceNumber();

    logger.info(`Response for submission for TX ${evidence.txHash}: ${JSON.stringify(response)}`)

    // If transaction failed
    if (response.code == 0) {
        logger.info(`Evidence sent successfully: ${response.txhash}`)
        // Set submission axs in flight
        await addSubmission(String(id), evidence.txHash, evidence.status == TransactionStatus.REORGED, SubmissionStatus.INFLIGHT, timeoutHeight)
    }
    else {
        // Get raw log
        let rawLog = response["raw_log"];
        // If error contains sequence mismatch
        if (rawLog.includes("incorrect account sequence")) {
            // setSequence
            const regex = /\d+/g;
            const numbers = rawLog.match(regex);
            let expectedSequence = Number(numbers![0])
            logger.debug(`Setting watcher account sequence to ${expectedSequence}`)
            setWatcherAccountSequenceNumber(expectedSequence)
            // retry
            await submitToAgoric(evidence, risksIdentified, agoricRpcStatus)
        }
    }
}

/**
 * Monitors Agoric RPCs
 */
export async function monitorAgoric() {
    setInterval(async () => {
        // Get status
        let status = await getLatestBlockHeight()
        // Get current active rpc
        let currentActive = AGORIC_RPCS[ACTIVE_AGORIC_RPC_INDEX]
        if (!status || status.syncing) {
            setAgoricActiveRpc(currentActive, false)
            // Get the next
            nextActiveAgoricRPC()
        }
        else {
            setAgoricActiveRpc(currentActive, true)
        }
    }, Number(AGORIC_RPC_CHECK_INTERVAL) * 1000)
}