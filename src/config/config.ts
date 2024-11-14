import { config } from 'dotenv';
import { ChainConfig } from 'src/types';

// Load environment variables from .env file
config();

/**
 * Configuration for supported chains and their RPC URLs and contract addresses.
 */
export const chainConfig = [
  {
    name: "Ethereum",
    rpcUrl: process.env.MAINNET_RPC_URL || '',
    contractAddress: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
  },
  {
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || '',
    contractAddress: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
  },
  {
    name: "Optimism",
    rpcUrl: process.env.OPTIMISM_RPC_URL || '',
    contractAddress: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
  },
  {
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || '',
    contractAddress: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
  },
  {
    name: "Arbitrum",
    rpcUrl: process.env.ARBITRUM_RPC_URL || '',
    contractAddress: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
  },
] as const;

/**
 * Fallback mechanism settings
 */
export const FALLBACK_MECHANISM = process.env.FALLBACK_MECHANISM === 'true';
export const FALLBACK_INTERVAL_BLOCKS = parseInt(process.env.FALLBACK_INTERVAL_BLOCKS || '100', 10);


/**
 * The `destinationDomain` parameter value for Noble in Circle's CCTP Protocol.
 *
 * @link https://developers.circle.com/stablecoins/supported-domains
 */
export const NOBLE_DOMAIN = 4;

export const NOBLE_LCD_URL = process.env.NOBLE_LCD_URL || 'https://noble-api.polkachu.com';

export const DB_URL = process.env.DB_URL

/**
 * Gets the chain config from an endpoint
 * @param endpoint endpoint url
 * @returns the Chain config or null if the endpoint is not found
 */
export const getChainFromEndpoint = (endpoint: string) => {
  for(let chain of chainConfig){
    if(chain.rpcUrl.includes(endpoint)){
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
  for(let chain of chainConfig){
    if(chain.name == chainName){
      return chain;
    }
  }
  return null
}

/**
 * The time in seconds to wait between each RPC reconnection attemot
 */
export const RPC_RECONNECT_DELAY = parseInt(process.env.RPC_RECONNECT_DELAY || '3', 10);

/**
 * ABI for the `DepositForBurn` event
 */
export const EVENT_ABI = [
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)"
];