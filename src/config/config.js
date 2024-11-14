"use strict";
// config.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOBLE_LCD_URL = exports.FALLBACK_INTERVAL_BLOCKS = exports.FALLBACK_MECHANISM = exports.chainConfig = void 0;
var dotenv_1 = require("dotenv");
var chains_1 = require("viem/chains");
// Load environment variables from .env file
(0, dotenv_1.config)();
/**
 * Configuration for supported chains and their RPC URLs and contract addresses.
 */
exports.chainConfig = [
    {
        name: "Ethereum",
        chain: chains_1.mainnet,
        rpcUrl: process.env.MAINNET_RPC_URL || '',
        contractAddress: "0xbd3fa81b58ba92a82136038b25adec7066af3155",
    },
    {
        name: "Polyogn",
        chain: chains_1.polygon,
        rpcUrl: process.env.POLYGON_RPC_URL || '',
        contractAddress: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
    },
    {
        name: "Optimism",
        chain: chains_1.optimism,
        rpcUrl: process.env.OPTIMISM_RPC_URL || '',
        contractAddress: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
    },
    {
        name: "Base",
        chain: chains_1.base,
        rpcUrl: process.env.BASE_RPC_URL || '',
        contractAddress: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
    },
    {
        name: "Arbitrum",
        chain: chains_1.arbitrum,
        rpcUrl: process.env.ARBITRUM_RPC_URL || '',
        contractAddress: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
    },
];
/**
 * Fallback mechanism settings
 */
exports.FALLBACK_MECHANISM = process.env.FALLBACK_MECHANISM === 'true';
exports.FALLBACK_INTERVAL_BLOCKS = parseInt(process.env.FALLBACK_INTERVAL_BLOCKS || '100', 10);
exports.NOBLE_LCD_URL = process.env.NOBLE_LCD_URL || '';
