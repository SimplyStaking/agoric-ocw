import { register, Gauge } from 'prom-client';
import { getAllGauges, setGaugeValue, setHeightForChain } from './lib/db';
import { logger } from './utils/logger';
import { chainConfig } from './config/config';

/**
 * Gauge metric to track RPC (Remote Procedure Call) status for a network.
 * Value is 1 if RPC is alive, 0 if dead.
 */
const rpcAliveGauge = new Gauge({
    name: 'rpc_alive',
    help: 'Shows if RPC is alive (1) or dead (0) for a specific network',
    labelNames: ['network'],
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
    let values = metric.values;

    for(let value in values){
        let labelNetwork = String(values[value].labels.network)
        if(labelNetwork == network){
            let val = values[value].value
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
    let values = metric.values;

    for(let value in values){
        let labelNetwork = String(values[value].labels.network)
        if(labelNetwork == network){
            let val = values[value].value
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
    let values = metric.values;

    for(let value in values){
        let labelNetwork = String(values[value].labels.network)
        if(labelNetwork == network){
            let val = values[value].value
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
    let gauges = await getAllGauges()
    // If no gauges found in DB
    if(!gauges){
        for(let chain of chainConfig){
            initialiseMetricsForNetwork(chain.name)
        }
    }
    // Else get them from DB and set them
    else{
        for(let chain of chainConfig){
            let network = chain.name
            eventsCount.set({ network }, gauges["eventsCount"] ? gauges["eventsCount"][network] : 0);
            totalAmount.set({ network }, gauges["totalAmount"] ? gauges["totalAmount"][network] : 0);
            revertedTxsCount.set({ network }, gauges["revertedTxsCount"] ? gauges["revertedTxsCount"][network] : 0);
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

    for(let value in rpcStatesValues){
        let network = String(rpcStatesValues[value].labels.network)
        let height = rpcStatesValues[value].value
        logger.info(`Saving ${network} RPC state (${height})`)
        await setHeightForChain(network, height)
    }
}

// Exports the 'register' object for exposing metrics in index.js or other modules
export { register };
