/**
 * @file Create test and prod clients for interfacing with an EVM RPC node
 */
import { logger } from '../utils/logger';
import { ChainConfig } from '../types';
import WebSocket from 'ws';
import { setRpcAlive } from '../metrics';
import { listen } from '../listener';
import { getChainFromConfig, REQUESTS_INTERVAL, REQUESTS_RETRIES, RPC_RECONNECT_DELAY } from '../config/config';
import { WebSocketProvider } from 'ethers';
import { TIMEOUT_RESPONSE } from '@src/constants';
import { vStoragePolicy } from './agoric';
import { isChainBlockHeightStale } from '@src/state';


// Define a type that maps string keys to WebSocketProvider values
type WebSocketProviderMap = {
  [key: string]: WebSocketProvider;
};

// Example usage of the WebSocketProviderMap type
const providers: WebSocketProviderMap = {};

/**
 * Creates a websocket to be used for the websocket provider
 * @param chain the chain config which is used when retrying
 * @returns A working ws connection
 */
function createWebSocket(chain: ChainConfig) {
  const ws = new WebSocket(chain.rpcUrl);

  ws.on("open", () => {
    logger.debug(`Connected to ${chain.name} on ${chain.rpcUrl}`);
    setRpcAlive(chain.name, true)
  });

  ws.on("close", () => {
    logger.error(`Disconnected on ${chain.name}. Reconnecting...`);
    setRpcAlive(chain.name, false)

    setTimeout(() => {
      providers[chain.name] = makeWebSocketProvider(chain);
      listen(chain);
    }, RPC_RECONNECT_DELAY * 1000);
  });

  ws.on("error", (error) => {
    setRpcAlive(chain.name, false)
    logger.error(`WebSocket error on ${chain.name}: ${error}`);
  });

  return ws;
}

/**
 * Function to create a websocker provider for a chain
 * @param chain the chain config which is used to create the provider
 * @returns The websocket provider for the chain
 */
const makeWebSocketProvider = (chain: ChainConfig) => {
  // Setup WebSocket provider
  const ws = createWebSocket(chain)
  return new WebSocketProvider(ws);
}

/**
* Get the singleton instance of the websocket provider for the given chain
* @param chain the chain for which to get the websocket provider
* @returns The websocket provider for the given chain
*/
export const getWsProvider = (chain: ChainConfig): WebSocketProvider => {
  if (!providers[chain.name]) {
    logger.debug(`Creating new Websocket provider client instance for ${chain.name}.`);
    providers[chain.name] = makeWebSocketProvider(chain);
  } else {
    logger.debug(`Using existing Websocket provider client instance for ${chain.name}.`);
  }

  return providers[chain.name];
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Returns the block timestamp
 * @param wsProvider the ws provider
 * @param blockNumber the block number to get the timestamp for
 * @param chain the chain name
 * @returns the block timestamp
 */
export const getBlockTimestamp = async (wsProvider: WebSocketProvider, blockNumber: number, chain: string): Promise<number> => {

  for (let i = 0; i < REQUESTS_RETRIES; i++) {
    logger.debug(`Trying try ${i+1} getting block timestamp for block ${blockNumber} on ${chain}`)
    try {
      const block = await wsProvider.getBlock(blockNumber);
      if (!block) {
        logger.error(`Block ${blockNumber} not found on ${chain} when getting timestamp`)
      };

      return block!.timestamp; // Returns the block timestamp in seconds
    } catch (error) {
      logger.error(`Failed to fetch timestamp for block ${blockNumber} on ${chain}`)
    }
    await sleep(REQUESTS_INTERVAL * 1000);
  }

  return 0;

}

/**
 * Returns the transaction sender
 * @param wsProvider the ws provider
 * @param txHash thetx hash to get the sender for
 * @param chain the chain name
 * @returns the tx sender
 */
export const getTxSender = async (wsProvider: WebSocketProvider, txHash: string, chain: string): Promise<string> => {

  for (let i = 0; i < REQUESTS_RETRIES; i++) {
    logger.debug(`Trying try ${i+1} getting TX sender for tx ${txHash} on ${chain}`)
    try {
      const tx = await wsProvider.getTransaction(txHash);
      if (!tx) {
        logger.error(`Transaction ${txHash} not found on ${chain} when getting sender`)
      };

      return tx!.from; // Returns the tx sender
    } catch (error) {
      logger.error(`Failed to fetch tx sender for transaction ${txHash} on ${chain}`)
    }
    await sleep(REQUESTS_INTERVAL * 1000);
  }

  return TIMEOUT_RESPONSE;
}

/**
 * Refreshed a connection for a chain
 * @param chain chain name
 */
export const refreshConnection = (chain: string) =>
{
  logger.debug(`Refreshing connection for ${chain}`)
  let config = getChainFromConfig(chain)
  if(!config){
    logger.error(`Could not find config for chain ${chain} when refreshing connection`)
    return
  }

  providers[chain].websocket.close();
  // providers[chain] = makeWebSocketProvider(config);
  // listen(config);
}

/**
 * This function checks if there were new blocks in the past X minutes for each chain
 * and if not, it attempts a reconnection
 */
export const startRPCChecker = () => {
  setInterval(() => {
    // For each chain
    for (const chain in vStoragePolicy.chainPolicies) {
      if(isChainBlockHeightStale(chain)){
        refreshConnection(chain);
      }
    }
  }, 60 * 1000)
}