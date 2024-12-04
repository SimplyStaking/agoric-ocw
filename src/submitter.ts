import { OfferSpec } from "@agoric/smart-wallet/src/offers";
import { ACTIVE_AGORIC_RPC, AGORIC_RPC_CHECK_INTERVAL, TX_TIMEOUT_BLOCKS, WATCHER_WALLET_ADDRESS, nextActiveAgoricRPC } from "./config/config";
import { execSwingsetTransaction, getLatestBlockHeight, outputAction, watcherInvitation } from "./lib/agoric";
import { addSubmission, getSubmission, updateSubmissionStatus } from "./lib/db";
import { setAgoricActiveRpc } from "./metrics";
import { AgoricOCWOfferTemplate, AgoricSubmissionResponse, CCTPTxEvidence, SubmissionStatus, TransactionStatus } from "./types";
import { logger } from "./utils/logger";

/**
 * @param evidence evidence to submit
 */
export async function submitToAgoric(evidence: CCTPTxEvidence) {

    // Get latest Agoric block
    let agoricRpcStatus = await getLatestBlockHeight()
    // Check if already submitted
    let submission = await getSubmission(evidence.txHash, evidence.status == TransactionStatus.REORGED)
    if (submission && submission.submissionStatus != SubmissionStatus.CANCELLED && agoricRpcStatus.height < submission.timeoutHeight) {
        logger.info(`Evidence for TX ${evidence.txHash} has status ${submission.submissionStatus} and a timeout height ${submission.timeoutHeight}. Current Agoric height is ${agoricRpcStatus.height}`)
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
    let templateOffer: AgoricOCWOfferTemplate = {
        invitationSpec: {
            source: "continuing",
            previousOffer: watcherInvitation,
            invitationMakerName: "SubmitEvidence",
            invitationArgs: [{
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
                    "forwardingAddress": evidence.forwardingAddress
                },
                "txHash": evidence.txHash
            }
            ],
        },
        proposal: {},
    };

    let keyring = {
        home: "",
        backend: "test",
    };

    let id = Number(Date.now());
    let offer: OfferSpec = { ...templateOffer, id };

    let offerData = outputAction({
        method: "executeOffer",
        offer,
    });

    let rpcStatus = await getLatestBlockHeight()

    if (rpcStatus.syncing) {
        logger.warn(`Skipping submission because Agoric RPC is still syncing on height ${rpcStatus.height}`)
        return
    }

    // Set timeout height
    let timeoutHeight = rpcStatus.height + TX_TIMEOUT_BLOCKS;
    // Execute tx
    let response: AgoricSubmissionResponse = await execSwingsetTransaction(
        `wallet-action --allow-spend '${JSON.stringify(offerData)}' --gas-prices=0.01ubld --timeout-height=${timeoutHeight}`,
        WATCHER_WALLET_ADDRESS,
        keyring
    );

    logger.info("Response: " + JSON.stringify(response))

    // If transaction failed
    if (response.code == 0) {
        logger.info(`Evidence sent successfully: ${response.txhash}`)
        // Set submission as in flight
        await addSubmission(String(id), evidence.txHash, evidence.status == TransactionStatus.REORGED, SubmissionStatus.INFLIGHT, timeoutHeight)
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
        let currentActive = ACTIVE_AGORIC_RPC
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