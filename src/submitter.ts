import { addSubmission, getSubmissionStatus, updateSubmissionStatus } from "./lib/db";
import { CCTPReOrgEvidence, CCTPTxEvidence, SubmissionStatus, TransactionStatus } from "./types";
import {logger} from "./utils/logger";

/**
 * @param evidence evidence to submit
 */
export async function submitToAgoric(evidence: CCTPTxEvidence) {

    // Check if already submitted
    let submissionStatus = await getSubmissionStatus(evidence.txHash, evidence.status == TransactionStatus.REORGED)
    if(submissionStatus && submissionStatus != SubmissionStatus.CANCELLED){
        logger.info(`Evidence for TX ${evidence.txHash} is already ${submissionStatus}`)
        return
    }

    if(evidence.status == TransactionStatus.REORGED){
        logger.info(`REORGED TX: ${evidence}`)
        //Set normal submission to cancelled
        await updateSubmissionStatus(evidence.txHash, false, SubmissionStatus.CANCELLED)
    }
    else{
        logger.info(`CONFIRMED TX: ${evidence}`)
    }

    // Set submission as in flight
    await addSubmission(evidence.txHash, evidence.status == TransactionStatus.REORGED, SubmissionStatus.INFLIGHT)
}
