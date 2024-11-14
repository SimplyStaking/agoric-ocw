import express from 'express';
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client';
import { getLatestTransactionByBlockNumber, getLatestBlockNumberByChain } from './path_to_your_existing_code'; // Replace with actual path
import { Transaction } from './lib/db';

// Create a custom Prometheus registry
const registry = new Registry();

// Collect default metrics (like CPU and memory usage)
collectDefaultMetrics({ register: registry });

// Define a gauge for block height
const latestBlockHeightGauge = new Gauge({
    name: 'latest_block_height',
    help: 'The latest block height for each chain',
    labelNames: ['chain'],
    registers: [registry],
});

// Store latest transaction hashes separately
let latestTransactionHashes: Record<string, string> = {};

// Update metrics with data from MongoDB
const updateMetrics = async () => {
    // Get all distinct chains
    const chains = await Transaction.distinct('chain');

    for (const chain of chains) {
        // Fetch the latest transaction by block number for this chain
        const latestTransaction = await getLatestTransactionByBlockNumber();

        if (latestTransaction) {
            // Update the block height gauge
            latestBlockHeightGauge.set({ chain: chain }, latestTransaction.blockNumber);

            // Store the latest transaction hash for the chain
            latestTransactionHashes[chain] = latestTransaction.transactionHash;
        }
    }
};

// Update metrics every 15 seconds
setInterval(updateMetrics, 15000);

// Set up an HTTP server for Prometheus to scrape metrics
const app = express();

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});

// Custom endpoint to expose latest transaction hashes as text
app.get('/latest_transaction_hashes', (req, res) => {
    res.json(latestTransactionHashes); // Can use JSON or text/plain format
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Prometheus metrics server listening on port ${PORT}`);
});
