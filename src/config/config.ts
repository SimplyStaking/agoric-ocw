import { config } from 'dotenv';
import { AgoricAddress, ChainConfig, FeedPolicy } from '../types';
import { logger } from '../utils/logger';
import { PROD } from '../constants';

// Load environment variables from .env file
config();

/**
 * Check chains start hieght
 */
const ETHEREUM_START_HEIGHT = Number(process.env.ETHEREUM_START_HEIGHT || '0');
if (isNaN(ETHEREUM_START_HEIGHT)) {
  logger.error(`ETHEREUM_START_HEIGHT must be a valid number`)
  process.exit(1)
}

const POLYGON_START_HEIGHT = Number(process.env.POLYGON_START_HEIGHT || '0');
if (isNaN(POLYGON_START_HEIGHT)) {
  logger.error(`POLYGON_START_HEIGHT must be a valid number`)
  process.exit(1)
}

const OPTIMISM_START_HEIGHT = Number(process.env.OPTIMISM_START_HEIGHT || '0');
if (isNaN(OPTIMISM_START_HEIGHT)) {
  logger.error(`POLYGON_START_HEIGHT must be a valid number`)
  process.exit(1)
}

const BASE_START_HEIGHT = Number(process.env.BASE_START_HEIGHT || '0');
if (isNaN(BASE_START_HEIGHT)) {
  logger.error(`POLYGON_START_HEIGHT must be a valid number`)
  process.exit(1)
}

const ARBITRUM_START_HEIGHT = Number(process.env.ARBITRUM_START_HEIGHT || '0');
if (isNaN(ARBITRUM_START_HEIGHT)) {
  logger.error(`POLYGON_START_HEIGHT must be a valid number`)
  process.exit(1)
}

const LOCALEVMCHAIN_START_HEIGHT = Number(process.env.LOCALEVMCHAIN_START_HEIGHT || '0');
if (isNaN(LOCALEVMCHAIN_START_HEIGHT)) {
  logger.error(`POLYGON_START_HEIGHT must be a valid number`)
  process.exit(1)
}

/**
 * Configuration for supported chains and their RPC URLs and contract addresses.
 */
export const chainConfig = [
  {
    name: "Ethereum",
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL || '',
    startHeight: ETHEREUM_START_HEIGHT,
    contractAddress: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
  },
  {
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || '',
    startHeight: POLYGON_START_HEIGHT,
    contractAddress: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
  },
  {
    name: "Optimism",
    rpcUrl: process.env.OPTIMISM_RPC_URL || '',
    startHeight: OPTIMISM_START_HEIGHT,
    contractAddress: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
  },
  {
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || '',
    startHeight: BASE_START_HEIGHT,
    contractAddress: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
  },
  {

    name: "Arbitrum",
    rpcUrl: process.env.ARBITRUM_RPC_URL || '',
    startHeight: ARBITRUM_START_HEIGHT,
    contractAddress: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
  },
  {

    name: "LocalTestChain",
    rpcUrl: process.env.LOCALEVMCHAIN_RPC_URL || '',
    startHeight: LOCALEVMCHAIN_START_HEIGHT,
    contractAddress: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
  },
];


/**
 * Holds the Noble LCD URL (Port 1317)
 */
export const NOBLE_LCD_URL = process.env.NOBLE_LCD_URL || 'https://noble-api.polkachu.com';

/**
 * Holds the Noble RPC URL (Port 26657)
 */
export const NOBLE_RPC_URL = process.env.NOBLE_RPC_URL || 'https://noble-rpc.polkachu.com';

/**
 * Holds the Noble RPC WS URL (Port 26657)
 */
export const NOBLE_RPC_WS_URL = process.env.NOBLE_RPC_WS_URL || 'https://noble-rpc.polkachu.com/websocket';

/**
 * Holds the Postgres URL to connect to
 */
export const DB_URL = process.env.DB_URL

/**
 * Holds the Fusdc Configuration Endpoint
 */
export const FUSDC_CONFIG_ENDPOINT = 'https://fastusdc-configurations.agoric.net'

/**
 * Gets the chain config from an endpoint
 * @param endpoint endpoint url
 * @returns the Chain config or null if the endpoint is not found
 */
export const getChainFromEndpoint = (endpoint: string) => {
  for (let chain of chainConfig) {
    if (chain.rpcUrl.includes(endpoint)) {
      return chain;
    }
  }
  return null
}

/**
 * Gets the chain config from a name
 * @param chainName chain name
 * @returns the Chain config or null if the name is not found
 */
export const getChainFromConfig = (chainName: string): ChainConfig | null => {
  for (let chain of chainConfig) {
    if (chain.name == chainName) {
      return chain;
    }
  }
  return null
}

/**
 * The time in seconds to wait between each RPC reconnection attemot
 */
export const RPC_RECONNECT_DELAY = parseInt(process.env.RPC_RECONNECT_DELAY || '3', 10);
if (isNaN(RPC_RECONNECT_DELAY)) {
  logger.error(`RPC_RECONNECT_DELAY must be a valid number`)
  process.exit(1)
}

/**
 * ABI for the `DepositForBurn` event
 */
export const EVENT_ABI = [
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)"
];

/**
 * Holds the Agoric LCD URL (Port 1317)
 */
export const AGORIC_LCD_URL = process.env.AGORIC_LCD_URL || 'http://127.0.0.1:1317';

/**
 * A list of agoric RPCs, comma seperated
 */
export const AGORIC_RPCS = process.env.AGORIC_RPCS?.split(",") || ['https://agoric-rpc.polkachu.com'];
export const AGORIC_WS_RPCS = process.env.AGORIC_WS_RPCS?.split(",") || ['https://agoric-rpc.polkachu.com/websockets'];
if (AGORIC_RPCS.length != AGORIC_WS_RPCS.length) {
  logger.error(`You must have an Agoric WS endpoint for every non-WS endpoint`)
  process.exit(1)
}
export let ACTIVE_AGORIC_RPC_INDEX = 0

/**
 * The agoric chain id
 */
export const AGORIC_NETWORK = process.env.AGORIC_NETWORK || 'agoric-3';

/**
 * The interval in seconds between each Agoric RPC Check
 */
export const AGORIC_RPC_CHECK_INTERVAL = process.env.AGORIC_RPC_CHECK_INTERVAL || '20';

/**
 * Function to switch to the next Agoric RPC
 */
export function nextActiveAgoricRPC() {
  // If there are more
  if (ACTIVE_AGORIC_RPC_INDEX < AGORIC_RPCS.length -1) {
    ACTIVE_AGORIC_RPC_INDEX++
  }
  else {
    ACTIVE_AGORIC_RPC_INDEX = 0
  }
}

/**
 * Interval between each request to query parameters
 */
export const QUERY_PARAMS_INTERVAL = Number(process.env.QUERY_PARAMS_INTERVAL || '300');
if (isNaN(QUERY_PARAMS_INTERVAL)) {
  logger.error(`QUERY_PARAMS_INTERVAL must be a valid number`)
  process.exit(1)
}

/**
 * Wallet Address from which to send transactions
 */
export const WATCHER_WALLET_ADDRESS = process.env.WATCHER_WALLET_ADDRESS || ""
if (WATCHER_WALLET_ADDRESS == "") {
  logger.error("WATCHER_WALLET_ADDRESS cannot be empty")
  // Exit if no wallet address
  process.exit(1)
}

/**
 * Holds the maximum number of offers to loop when getting offers
 */
export const MAX_OFFERS_TO_LOOP = Number(process.env.MAX_OFFERS_TO_LOOP || '25')
if (isNaN(MAX_OFFERS_TO_LOOP)) {
  logger.error(`MAX_OFFERS_TO_LOOP must be a valid number`)
  process.exit(1)
}

/**
 * Holds the maximum number of blocks to timeout the tx
 */
export const TX_TIMEOUT_BLOCKS = Number(process.env.TX_TIMEOUT_BLOCKS || '3')
if (isNaN(TX_TIMEOUT_BLOCKS)) {
  logger.error(`TX_TIMEOUT_BLOCKS must be a valid number`)
  process.exit(1)
}

/**
 * Holds the environment
 */
export const ENV = process.env.ENV || PROD

/**
 * Holds the api secret to query txs
 */
export const API_SECRET = process.env.API_SECRET || "XXXXXXX"

/**
 * Holds the maximum number of minutes to hold transactions in the DB without a FA Account
 */
export const MINUTES_HOLDING_UNKNOWN_FA = Number(process.env.MINUTES_HOLDING_UNKNOWN_FA || '30')
if (isNaN(MINUTES_HOLDING_UNKNOWN_FA)) {
  logger.error(`MINUTES_HOLDING_UNKNOWN_FA must be a valid number`)
  process.exit(1)
}

/**
 * Holds retries for requests
 */
export const REQUESTS_RETRIES = Number(process.env.REQUESTS_RETRIES || '2');
if (isNaN(REQUESTS_RETRIES)) {
  logger.error(`REQUESTS_RETRIES must be a valid number`)
  process.exit(1)
}

/**
 * Holds interval in secons between requests
 */
export const REQUESTS_INTERVAL = Number(process.env.REQUESTS_INTERVAL || '1');
if (isNaN(REQUESTS_INTERVAL)) {
  logger.error(`REQUESTS_INTERVAL must be a valid number`)
  process.exit(1)
}