import { register, Gauge } from 'prom-client';
import { getAllGauges, setGaugeValue, setHeightForChain } from './lib/db';
import { logger } from './utils/logger';
import { chainConfig } from './config/config';

/**
 * Gauge metric to track RPC status for a network.
 * Value is 1 if RPC is alive, 0 if dead.
 */
const rpcAliveGauge = new Gauge({
    name: 'rpc_alive',
    help: 'Shows if RPC is alive (1) or dead (0) for a specific network',
    labelNames: ['network'],
});

/**
 * Gauge metric to track which Agoric RPC is active
 * Value is 1 if RPC is alive, 0 if dead.
 */
const agoricActiveRPC = new Gauge({
    name: 'agoric_active_rpc',
    help: 'Shows which Agoric RPC is active',
    labelNames: ['endpoint'],
});

/**
 * Gauge metric to track the latest block height for a specific network.
 */
const rpcBlockHeight = new Gauge({
    name: 'rpc_height',
    help: 'Shows the block height for a node on a specific network',
    labelNames: ['network'],
});

/**
 * Gauge metric to track the count of events destined for Agoric on a specific network.
 */
const eventsCount = new Gauge({
    name: 'events_count',
    help: 'Shows the number of events destined to Agoric on a specific network',
    labelNames: ['network'],
});

/**
 * Gauge metric to track the count of reverted transactions due to reorgs for a specific network.
 */
const revertedTxsCount = new Gauge({
    name: 'reverted_tx_count',
    help: 'Shows the number of reverted transactions due to reorgs on a specific network',
    labelNames: ['network'],
});

/**
 * Gauge metric to track the total amount destined to Agoric on a specific network.
 */
const totalAmount = new Gauge({
    name: 'total_amount',
    help: 'Shows the total amount destined to Agoric on a specific network',
    labelNames: ['network'],
});

/**
 * Gauge metric to track the last offerId from a watcher address
 */
const lastOfferSubmitted = new Gauge({
    name: 'last_watcher_offer',
    help: 'Shows the id(timestamp) of the last submission made by a watcher',
    labelNames: ['watcher'],
});

/**
 * Gauge metric to track the cumulated current block range tx amount
 */
const currentBlockRangeAmount = new Gauge({
    name: 'current_block_range_amount',
    help: 'Shows the sum of the current block range tx amounts',
    labelNames: ['network'],
});

/**
 * Sets the rpcAlive metric for a specific network.
 * @param network - The name of the network.
 * @param isAlive - Boolean value indicating if the RPC is alive (true) or dead (false).
 */
export const setRpcAlive = (network: string, isAlive: boolean): void => {
    rpcAliveGauge.set({ network }, isAlive ? 1 : 0);
};

/**
 * Sets the rpcBlockHeight metric for a specific network.
 * @param network - The name of the network.
 * @param height - The block height to be set for the specified network.
 */
export const setRpcBlockHeight = (network: string, height: number): void => {
    rpcBlockHeight.set({ network }, height);
};

/**
 * Increments the eventsCount metric by 1 for a specific network.
 * @param network - The name of the network.
 */
export const incrementEventsCount = async (network: string) => {
    eventsCount.inc({ network });
    const metric = await eventsCount.get();
    const values = metric.values;

    for (const value in values) {
        const labelNetwork = String(values[value].labels.network)
        if (labelNetwork == network) {
            const val = values[value].value
            await setGaugeValue("eventsCount", network, val)
        }
    }
};

/**
 * Increments the totalAmount metric for a specific network by a specified amount.
 * @param network - The name of the network.
 * @param amount - The amount to increment the total by.
 */
export const incrementTotalAmount = async (network: string, amount: number) => {
    totalAmount.inc({ network }, amount);
    const metric = await totalAmount.get();
    const values = metric.values;

    for (const value in values) {
        const labelNetwork = String(values[value].labels.network)
        if (labelNetwork == network) {
            const val = values[value].value
            await setGaugeValue("totalAmount", network, val)
        }
    }
};

/**
 * Increments the revertedTxsCount metric by 1 for a specific network.
 * @param network - The name of the network.
 */
export const incrementRevertedCount = async (network: string) => {
    revertedTxsCount.inc({ network });
    const metric = await revertedTxsCount.get();
    const values = metric.values;

    for (const value in values) {
        const labelNetwork = String(values[value].labels.network)
        if (labelNetwork == network) {
            const val = values[value].value
            await setGaugeValue("revertedTxsCount", network, val)
        }
    }
};

/**
 * Initializes the metrics for a specific network by setting each gauge to 0.
 * Useful for starting from a base state when adding a new network.
 * @param network - The name of the network to initialize metrics for.
 */
export const initialiseMetricsForNetwork = (network: string): void => {
    eventsCount.set({ network }, 0);
    totalAmount.set({ network }, 0);
    revertedTxsCount.set({ network }, 0);
};

/**
 * Function to initialise gauges on startup
 */
export const intialiseGauges = async () => {
    const gauges = await getAllGauges()
    // If no gauges found in DB
    if (!gauges) {
        for (const chain of chainConfig) {
            initialiseMetricsForNetwork(chain.name)
        }
    }
    // Else get them from DB and set them
    else {
        for (const chain of chainConfig) {
            const network = chain.name
            eventsCount.set({ network }, gauges["eventsCount"] ? gauges["eventsCount"][network] ? gauges["eventsCount"][network] : 0 : 0);
            totalAmount.set({ network }, gauges["totalAmount"] ? gauges["totalAmount"][network] ? gauges["totalAmount"][network] : 0 : 0);
            revertedTxsCount.set({ network }, gauges["revertedTxsCount"] ? gauges["revertedTxsCount"][network] ? gauges["revertedTxsCount"][network] : 0 : 0);
        }
    }
}

/**
 * Function to save rpc block heights metrics to db
 */
export const saveRPCStates = async () => {
    // Get rpc states
    let rpcStates = await rpcBlockHeight.get()
    let rpcStatesValues = rpcStates.values;

    for (let value in rpcStatesValues) {
        let network = String(rpcStatesValues[value].labels.network)
        let height = rpcStatesValues[value].value
        logger.info(`Saving ${network} RPC state (${height})`)
        await setHeightForChain(network, height)
    }
}

/**
 * Sets the agoric metric for a specific network.
 * @param endpoint - The endpoint.
 * @param isActive - Boolean value indicating if the RPC is active (true) or dead (false).
 */
export const setAgoricActiveRpc = (endpoint: string, isActive: boolean): void => {
    agoricActiveRPC.set({ endpoint }, isActive ? 1 : 0);
};

/**
 * Sets the last offerId submitted by a watcher
 * @param watcher the watcher address
 * @param offerId the last offerId
 */
export const setWatcherLastOfferId = (watcher: string, offerId: number): void => {
    lastOfferSubmitted.set({ watcher }, offerId);
};

/**
 * Sets the current block range summation for a network
 * @param network - The name of the network.
 * @param amount - The amount to set the total to.
 */
export const setCurrentBlockRangeAmount = async (network: string, amount: number) => {
    currentBlockRangeAmount.set({ network }, amount);
};

/**
 * Gets the current block range amount for a network
 * @param network - The name of the network.
 * @returns the current block range amount for the given network
 */
export const getCurrentBlockRangeAmount = async (network: string) => {
    let currentBlockRangeAmounts = await currentBlockRangeAmount.get()
    let currentBlockRangeValues = currentBlockRangeAmounts.values;

    for (let value in currentBlockRangeValues) {
        let label = String(currentBlockRangeValues[value].labels.network)
        if (label == network) {
            return Number(currentBlockRangeValues[value].value)
        }
    }

    return 0;
};

// Exports the 'register' object for exposing metrics in index.js or other modules
export { register };
