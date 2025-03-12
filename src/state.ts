import { AGORIC_LCD_URL, WATCHER_WALLET_ADDRESS } from "./config/config";
import { AccountDetails, AccountResponse, BlockHeightUpdateTimestamp, BlockRangeAmountState, ChainBlockRangeAmountState } from "./types";
import axios from "axios";
import { logger } from "./utils/logger";

// Holds the watcher account state
export let watcherAccount: AccountDetails;

// Holds the state for the block range amounts
export let blockRangeAmountState: BlockRangeAmountState = {};

// Holds timestamp of latest block for a chain
export let blockHeightUpdateTimestampState: BlockHeightUpdateTimestamp = {}

/**
 * Fetches account details from the specified endpoint and extracts
 * the account number and sequence.
 * 
 * @returns An object containing the account number and sequence
 * @throws An error if the request fails or the response format is invalid
 */
export const getAgoricWatcherAccountDetails = async (): Promise<AccountDetails> => {
    try {
        const response = await axios.get<AccountResponse>(`${AGORIC_LCD_URL}/cosmos/auth/v1beta1/accounts/${WATCHER_WALLET_ADDRESS}`);
        const account = response.data.account;

        if (!account || !account.account_number || !account.sequence) {
            throw new Error("Invalid response format when getting Agoric watcher account: missing account_number or sequence.");
        }
        watcherAccount = {
            accountNumber: Number(account.account_number),
            sequence: Number(account.sequence),
        };
        logger.debug(`Setting watcher account details to ${JSON.stringify(watcherAccount)}`)
    } catch (error) {
        console.error("Error fetching Agoric watcher account details:", error);
        process.exit(1)
    }

    return {
        accountNumber: 0,
        sequence: 0
    }
};

/**
 * Increments the watcher sequence srquence number
 */
export const incrementWatcherAccountSequenceNumber = () => {
    watcherAccount.sequence++;
}

/**
 * Sets the watcher account sequence number
 * @param newSequence new sequence number to set
 */
export const setWatcherAccountSequenceNumber = (newSequence: number) => {
    watcherAccount.sequence = newSequence;
}

/**
 * Calculates the sum of all entries for a specific chain.
 * If the chain doesn't exist, it returns 0.
 *
 * @param data - The BlockSumMap object to query.
 * @param chain - The chain name (string) to calculate the sum for.
 * @returns The total sum of all entries for the specified chain.
 */
export function getTotalSumForChainBlockRangeAmount(chain: string): number {
    if (!blockRangeAmountState[chain]) {
        return 0;
    }

    return blockRangeAmountState[chain].entries.reduce((total, entry) => total + entry.sum, 0);
}

/**
 * Adds a new entry with the given block number and sum 0 for a specific chain.
 * If the chain doesn't exist, it initializes it with an empty entries array.
 * Removes the first entry if the number of entries exceeds the max limit.
 *
 * @param data - The BlockSumMap object to update.
 * @param chain - The chain name (string) where the new entry will be added.
 * @param block - The block number for the new entry.
 * @param maxEntries - The maximum number of entries allowed for a chain. If exceeded, the oldest entry is removed.
 */
export function addBlockRangeStateEntry(
    chain: string,
    block: number,
    maxEntries: number
): void {
    if (!blockRangeAmountState[chain]) {
        blockRangeAmountState[chain] = { entries: [] };
    }

    // Add the new entry
    blockRangeAmountState[chain].entries.push({ block, sum: 0 });

    // Remove the first entry if the maximum limit is exceeded
    if (blockRangeAmountState[chain].entries.length > maxEntries) {
        blockRangeAmountState[chain].entries.shift();
    }
}

/**
 * Increments the sum for a specific block in the entries of a given chain.
 * If the block doesn't exist, it creates the entry and initializes the sum with the increment value.
 *
 * @param data - The BlockSumMap object to update.
 * @param chain - The chain name where the block entry exists or should be created.
 * @param block - The block number whose sum needs to be incremented.
 * @param incrementValue - The value to increment the sum by.
 */
export function incrementOrCreateBlock(
    chain: string,
    block: number,
    incrementValue: number
): void {
    // Ensure the chain exists, or initialize it
    if (!blockRangeAmountState[chain]) {
        blockRangeAmountState[chain] = { entries: [] };
    }

    // Find the entry for the specified block
    let entry = blockRangeAmountState[chain].entries.find((entry) => entry.block === block);

    // If the block does not exist, create it with the initial incrementValue
    if (!entry) {
        entry = { block, sum: incrementValue };
        blockRangeAmountState[chain].entries.push(entry);
    } else {
        // Increment the sum if the block exists
        entry.sum += incrementValue;
    }
}

/**
 * Replaces all entries for a specific chain with new entries.
 *
 * @param chain - The chain name
 * @param entries - An array of entries where each entry is an object with a block number and sum.
 */
export function setChainEntries(chain: string, entries: ChainBlockRangeAmountState[]): void {
    if (!blockRangeAmountState[chain]) {
        blockRangeAmountState[chain] = { entries: [] };
    }
    // Replace the existing entries with the new entries
    blockRangeAmountState[chain].entries = entries;
}

/**
 * Sets the time for a height update for a chain
 * @param chain chain name
 */
export const setBlockHeightUpdateTimestamp = (chain: string) => {
    let now = new Date()
    blockHeightUpdateTimestampState[chain] = now.getTime();
}

/**
 * Checks if the last block height update happened more than 1 minutes ago
 * @param chain chain name
 * @returns true if the last block height update happened more than 1 minutes ago
 */
export const isChainBlockHeightStale = (chain: string) => {
    let now = new Date()
    // 1 minutes
    const interval = 1 * 60 * 1000
    
    let lastRPCUpdate = blockHeightUpdateTimestampState[chain] || 0

    if((now.getTime() - interval) > lastRPCUpdate){
        logger.debug(`${chain} RPC height is currently stalled. Now: ${now.getTime()}, lastRPCUpdateTimestamp: ${lastRPCUpdate}`)
        return true
    }

    return false;
}