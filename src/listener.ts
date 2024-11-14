import { ethers } from 'ethers';
import { processCCTPBurnEventLog } from './processor';
import { logger } from './utils/logger';
import { submitToAgoric } from './submitter';
import { setRpcAlive, setRpcBlockHeight } from './metrics';
import { EVENT_ABI, chainConfig } from "./config/config";
import { ChainConfig, DepositForBurnEvent, Hex } from './types';
import { ContractEventPayload } from 'ethers';
import { getWsProvider } from './lib/evm-client';

/**
 * Listens for `DepositForBurn` events and new blocks, and handles reconnections on error.
 * @param chain - Chain configuration containing contract address, chain name, and RPC URL.
 */
export function listen(chain: ChainConfig) {
  const { contractAddress, name, rpcUrl } = chain;

  let wsProvider = getWsProvider(chain)
  
  const contract = new ethers.Contract(contractAddress, EVENT_ABI, wsProvider);

  // Listen for `DepositForBurn` events and process them
  contract.on("DepositForBurn",
    async (nonce, burnToken, depositor, amount, mintRecipient, destinationDomain, destinationTokenMessenger, destinationCaller, event:ContractEventPayload) => {
      try {
          if (Number(destinationDomain) === 4) { // Filter by specific destination domain
            setRpcAlive(name, true);

            // Create a log object with details needed for processing
            const log: DepositForBurnEvent = {
              amount, mintRecipient, destinationDomain, destinationTokenMessenger,
              transactionHash: event.log.transactionHash as Hex,
              blockHash: event.log.blockHash as Hex,
              blockNumber: BigInt(event.log.blockNumber),
              removed: event.log.removed,
            };

            // Process the event and submit if evidence is found
            const evidence = await processCCTPBurnEventLog(log, name);
            if (evidence) {
              await submitToAgoric(evidence);
            }
          }
          else {
            logger.debug(`NOT FOR NOBLE from ${chain.name}: ${event.log.transactionHash}`)
          }
      } catch (err) {
        logger.error("Error while handling logs:", err);
      }
    });

  // Listen for new blocks
  wsProvider.on("block", (blockNumber) => {
    setRpcAlive(name, true);
    setRpcBlockHeight(name, blockNumber)
  });

  // Reconnect function for WebSocket
  function reconnect() {
    setTimeout(() => {
      listen(chain)
      console.log("Attempting to reconnect to WebSocket...");
    }, 5000); // Retry after 5 seconds
  }
}

/**
 * Initializes listeners for multiple blockchain networks.
 * 
 */
export async function startMultiChainListener() {
  for (let chain of chainConfig) {
    listen(chain)
  }
}