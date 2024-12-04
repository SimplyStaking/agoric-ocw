import { ethers } from "ethers";
import { EVENT_ABI, getChainFromConfig } from "./config/config";
import { ChainConfig, DepositForBurnEvent } from "./types";
import { getWsProvider } from "./lib/evm-client";
import { logger } from "./utils/logger";
import { getAllHeights } from "./lib/db";
import { Hex } from "viem";
import { processCCTPBurnEventLog } from "./processor";
import { submitToAgoric } from "./submitter";
import { setRpcAlive } from "./metrics";
import { vStoragePolicy } from "./lib/agoric";

/**
 * Backfills chain
 * @param chain The chain to backfill
 * @param fromBlock The block to backfill from
 */
export async function backfillChain(
  chain: ChainConfig,
  fromBlock: number
) {

  let wsProvider = getWsProvider(chain)
  const contract = new ethers.Contract(chain.contractAddress, EVENT_ABI, wsProvider);

  logger.debug(`Getting event logs on ${chain.name} from block ${fromBlock}`)

  // Get logs for the 'DepositForBurn' event from the specified block onwards
  try {
    const logs = await wsProvider.getLogs({
      fromBlock, // Starting block number
      toBlock: "latest", // You can specify a `toBlock` number if needed
      address: chain.contractAddress, // Filter by contract address
      topics: [
        ethers.id("DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32)") // This is the event signature hash
      ]
    });

    // Process each log
    for (const log of logs) {
      try {
        // Decode the log using the contract ABI
        const parsedLog = contract.interface.parseLog(log);

        if (parsedLog) {
          const {
            amount,
            mintRecipient,
            destinationDomain,
            destinationTokenMessenger,
          } = parsedLog.args;

          if (Number(destinationDomain) === 4) { // Filter by specific destination domain
            setRpcAlive(chain.name, true);

            // Create a log object with details needed for processing
            const eventLog: DepositForBurnEvent = {
              amount, mintRecipient, destinationDomain, destinationTokenMessenger,
              transactionHash: log.transactionHash as Hex,
              blockHash: log.blockHash as Hex,
              blockNumber: BigInt(log.blockNumber),
              removed: log.removed,
              blockTimestamp: BigInt(Date.now()) // Ignore for now
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
  } catch (err) {
    logger.error(`Error fetching backfilled logs from ${chain.name}: ${err}`);
  }
}

/**
 * Backfills events for all chains
 */
export async function backfill() {
  // Get latest heights
  let heights = await getAllHeights() || null
  for (let chain in heights) {
    // If chain is found in agoric policy
    if (vStoragePolicy.chainPolicies[chain]) {
      logger.info(`Backfilling for ${chain}`)
      let chainConfig = getChainFromConfig(chain)
      if (chainConfig) {
        await backfillChain(chainConfig, heights[chain])
      }
    }

  }

}