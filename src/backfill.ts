import { ethers } from "ethers";
import { ENV, EVENT_ABI, getChainFromConfig } from "./config/config";
import { ChainConfig, DepositForBurnEvent } from "./types";
import { getBlockTimestamp, getWsProvider } from "./lib/evm-client";
import { logger } from "./utils/logger";
import { getAllHeights, setHeightForChain, getBlockSums } from "./lib/db";
import { Hex } from "viem";
import { processCCTPBurnEventLog } from "./processor";
import { setRpcAlive } from "./metrics";
import { vStoragePolicy } from "./lib/agoric";
import { setChainEntries } from "./state";
import { PROD } from "./constants";

/**
 * Backfills chain
 * @param chain The chain to backfill
 * @param fromBlock The block to backfill from
 */
export async function backfillChain(
  chain: ChainConfig,
  fromBlock: number,
) {

  const wsProvider = getWsProvider(chain)
  const contract = new ethers.Contract(chain.contractAddress, EVENT_ABI, wsProvider);

  logger.debug(`Getting event logs on ${chain.name} from block ${fromBlock}`)

  // Get logs for the 'DepositForBurn' event from the specified block onwards
  try {
    const latestBlockNumber = await wsProvider.getBlockNumber();

    const logs = await wsProvider.getLogs({
      fromBlock, // Starting block number
      toBlock: latestBlockNumber, // You can specify a `toBlock` number if needed
      address: ENV == PROD ? vStoragePolicy.chainPolicies[chain.name].cctpTokenMessengerAddress : chain.contractAddress, // Filter by contract address
      topics: [
        ethers.id(vStoragePolicy.eventFilter) // This is the event signature hash
      ]
    });

    // Process each log
    for (const log of logs) {
      try {
        // Decode the log using the contract ABI
        const parsedLog = contract.interface.parseLog(log);

        if (parsedLog) {
          const {
            nonce,
            burnToken,
            amount,
            depositor,
            mintRecipient,
            destinationDomain,
            destinationTokenMessenger,
            destinationCaller
          } = parsedLog.args;

          if (Number(destinationDomain) === 4) { // Filter by specific destination domain
            setRpcAlive(chain.name, true);

            let timestamp = await getBlockTimestamp(wsProvider, log.blockNumber, chain.name);

            // Create a log object with details needed for processing
            const eventLog: DepositForBurnEvent = {
              amount, mintRecipient, destinationDomain, destinationTokenMessenger,
              transactionHash: log.transactionHash as Hex,
              blockHash: log.blockHash as Hex,
              blockNumber: BigInt(log.blockNumber),
              removed: log.removed,
              sender: depositor,
              blockTimestamp: BigInt(timestamp)
            };

            // Process the event and submit if evidence is found
            await processCCTPBurnEventLog(eventLog, chain.name);
          }
          else {
            logger.debug(`NOT FOR NOBLE from ${chain.name}: ${log.transactionHash}`)
          }
        }
      } catch (err) {
        logger.error(`Error processing backfilled logs from ${chain.name}: ${err}`);
      }
    }
    // Store height in DB after backfill if a log is found
    await setHeightForChain(chain.name, latestBlockNumber);

    // Get totals for latest blocks
    const blockTotals = await getBlockSums(chain.name, latestBlockNumber, vStoragePolicy.chainPolicies[chain.name].rateLimits.blockWindowSize)
    setChainEntries(chain.name, blockTotals.blockSums)

  } catch (err) {
    logger.error(`Error fetching backfilled logs from ${chain.name}: ${err}`);
  }
}

/**
 * Backfills events for all chains
 */
export async function backfill() {
  // Get latest heights
  const heights = await getAllHeights() || null
  for (const chain in heights) {
    // If chain is found in agoric policy
    if (vStoragePolicy.chainPolicies[chain]) {
      logger.info(`Backfilling for ${chain}`)
      const chainConfig = getChainFromConfig(chain)
      if (chainConfig) {
        await backfillChain(chainConfig, heights[chain] || chainConfig.startHeight)
      }
    }
  }

}