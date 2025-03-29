import { logger } from "./utils/logger.js";
import type { CCTPTxEvidence, SubmissionQueueEvidence } from "./types.js";
import { submitToAgoric } from "./submitter.js";
import { getLatestBlockHeight } from "./lib/agoric.js";

export const makeSubmissionQueue = () => {
    const queue: SubmissionQueueEvidence[] = [];
    const inQueue = new Set<string>();
    let isProcessing = false;

    const addToQueue = (evidence: CCTPTxEvidence, risksIdentified: string[]) => {
        if (!inQueue.has(evidence.txHash)){
            logger.debug(`TX ${evidence.txHash} from ${evidence.chainId} added to queue`);
            queue.push({ evidence, risksIdentified });
            inQueue.add(evidence.txHash);
        }
        else{
            logger.debug(`TX ${evidence.txHash} from ${evidence.chainId} already in queue and queue length is ${queue.length}`);
        }
        if (!isProcessing) processQueue();
    };

    const processQueue = async () => {
        if (isProcessing){
            logger.debug(`Already processing queue`);
            return;
        } 
        isProcessing = true;
        let agoricRPCStatus = await getLatestBlockHeight();

        if (agoricRPCStatus.syncing) {
            logger.warn(`Skipping submissions because Agoric RPC is still syncing on height ${agoricRPCStatus.height}`);
            isProcessing = false;
            return
        }

        while (queue.length > 0) {
            const evidence = queue.shift();
            if (!evidence){
                logger.debug(`No evidence to process in queue`)
                continue;
            }

            try {
                logger.debug(`Submitting to agoric ${evidence.evidence.txHash} from queue`);
                await submitToAgoric(evidence.evidence, evidence.risksIdentified, agoricRPCStatus);
                logger.debug(`Successfully processed transaction ${evidence.evidence.txHash} from queue`);
                inQueue.delete(evidence.evidence.txHash);
            } catch (error) {
                logger.error(`Error processing transaction ${evidence.evidence.txHash} in queue:`, error);
                // XXX consider retry logic with maxRetries. For now, it should be requeued by the db query
                inQueue.delete(evidence.evidence.txHash);
            }
        }

        isProcessing = false;
        logger.debug("Nothing in queue, exiting from queue submission operations")
    };

    return { addToQueue, processQueue };
}

export let submissionQueue = makeSubmissionQueue()
