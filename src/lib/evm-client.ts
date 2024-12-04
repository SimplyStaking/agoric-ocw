/**
 * @file Create test and prod clients for interfacing with an EVM RPC node
 */
import { logger } from '../utils/logger';
import { ChainConfig } from '../types';
import WebSocket from 'ws';
import { setRpcAlive } from '../metrics';
import { listen } from '../listener';
import { RPC_RECONNECT_DELAY } from '../config/config';
import { WebSocketProvider } from 'ethers';


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
    logger.debug(`Using existing Websocket provider client instance for ${chain.name}.`);
  }

  return providers[chain.name];
};