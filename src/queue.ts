import { logger } from "./utils/logger.js";
import type { CCTPTxEvidence, SubmissionQueueEvidence } from "./types.js";
import { submitToAgoric } from "./submitter.js";
import { getLatestBlockHeight } from "./lib/agoric.js";

export const makeSubmissionQueue = () => {
    const queue: SubmissionQueueEvidence[] = [];
    const inQueue = new Set<string>();
    let isProcessing = false;

    const addToQueue = (evidence: CCTPTxEvidence, risksIdentified: string[]) => {
        if (inQueue.has(evidence.txHash)) return;
        queue.push({ evidence, risksIdentified });
        inQueue.add(evidence.txHash);
        if (!isProcessing) processQueue();
    };

    const processQueue = async () => {
        if (isProcessing) return;
        isProcessing = true;
        let agoricRPCStatus = await getLatestBlockHeight()

        if (agoricRPCStatus.syncing) {
            logger.warn(`Skipping submissions because Agoric RPC is still syncing on height ${agoricRPCStatus.height}`)
            return
        }

        while (queue.length > 0) {
            const evidence = queue.shift();
            if (!evidence) continue;

            try {
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
    };

    return { addToQueue, processQueue };
}

export let submissionQueue = makeSubmissionQueue()
