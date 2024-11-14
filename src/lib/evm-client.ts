/**
 * @file Create test and prod clients for interfacing with an EVM RPC node
 */
import { logger } from '../utils/logger';
import { ChainConfig } from 'src/types';
import WebSocket from 'ws';
import { setRpcAlive } from 'src/metrics';
import { listen } from 'src/listener';
import { RPC_RECONNECT_DELAY } from 'src/config/config';
import { WebSocketProvider } from 'ethers';


// Define a type that maps string keys to WebSocketProvider values
type WebSocketProviderMap = {
  [key: string]: WebSocketProvider;
};

// Example usage of the WebSocketProviderMap type
const providers: WebSocketProviderMap = {};

/**
 * Fetches the latest block number from the connected blockchain.
 *
 * @param client - The client to query
 * @param chain - The chain name
 * @return A promise that resolves to the current block number as a BigInt.
 * @throws An error if there is an issue retrieving the block number.
 */
export async function fetchCurrentBlockNumber(client, chain): Promise<bigint> {
  try {
    const blockNumber = await client.getBlockNumber();
    return BigInt(blockNumber);
  } catch (error) {
    logger.error(`Error fetching block number for ${chain}: ${error}`);
    throw error;
  }
}

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
      listen(chain);
    }, RPC_RECONNECT_DELAY * 1000);
  });

  ws.on("error", (error) => {
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
 let ws = createWebSocket(chain)
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
    logger.debug('Using existing Websocket provider client instance for ${chain.name}.');
  }

  return providers[chain.name];
};