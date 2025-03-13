import mongoose, { Document, Schema } from 'mongoose';
import { DB_URL } from '../config/config';  // Import your DB connection URL from config
import { ChainBlockRangeAmountState, ForwardingAccount, SubmissionStatus, TransactionStatus } from '../types';
import { logger } from '../utils/logger';
import { vStoragePolicy } from './agoric';
import { UNKNOWN_FA } from '../constants';
import { Hex } from 'viem';

let isConnected = false; // Variable to track the connection status

// MongoDB Connection setup
const connectDB = async (): Promise<void> => {
    if (isConnected) {
        logger.debug('MongoDB is already connected.');
        return;
    }

    try {
        // Connect to MongoDB using the connection string from config or fallback to localhost
        await mongoose.connect(DB_URL || 'mongodb://localhost:27017/agoricOCW');
        isConnected = true;  // Set connection flag to true once connected
        logger.debug('Connected to MongoDB');
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error);
        process.exit(1); // Exit process if connection fails
    }
};

/**
 * INTERFACES
 */

interface ITransactionDetails {
    chain: string;
    blockNumber: number;
    status: TransactionStatus;
    transactionHash: string;
    amount: number;
    recipientAddress: string;
    forwardingAddress: string;
    forwardingChannel: string;
    blockHash: string;
    risksIdentified: string[];
    blockTimestamp: number;
    confirmationBlockNumber: number;
    sender: Hex,
    depositor: Hex,
    created: number;
}

interface ITransaction extends Document, ITransactionDetails { }

interface ISubmission extends Document {
    offerId: string;
    transactionHash: string;
    reorged: boolean;
    submissionStatus: SubmissionStatus;
    timeoutHeight: number;
}

interface IRemovedTX extends Document {
    transactionHash: string;
    chain: string;
    created: Number;
}

interface INobleAccount {
    nobleAddress: string;
    account?: ForwardingAccount,
    isAgoricForwardingAcct: boolean;
}

export interface GaugesState {
    eventsCount: Map<string, number>;
    revertedTxsCount: Map<string, number>;
    totalAmount: Map<string, number>;
}

export interface IState extends Document {
    lastOfferId: string;
    lastHeights: Map<string, number>; // Map to store heights for any network name
    gauges: GaugesState;
    updatedAt: Date;
}

/**
 * SCEMAS
 */

const transactionSchema = new Schema<ITransaction>({
    chain: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    transactionHash: { type: String, required: true },
    status: { type: String, enum: Object.values(TransactionStatus), required: true },
    amount: { type: Number, required: true },
    recipientAddress: { type: String, required: true },
    forwardingAddress: { type: String, required: true },
    forwardingChannel: { type: String, required: true },
    blockHash: { type: String, required: true },
    blockTimestamp: { type: Number, required: true },
    risksIdentified: { type: [String], required: true },
    confirmationBlockNumber: { type: Number, required: true },
    sender: { type: String, required: true },
    created: { type: Number, required: true },
});

const submissionSchema = new Schema<ISubmission>({
    offerId: { type: String, required: true, unique: true },
    transactionHash: { type: String, required: true },
    reorged: { type: Boolean, required: true, default: false },
    submissionStatus: { type: String, enum: Object.values(SubmissionStatus), required: true },
    timeoutHeight: { type: Number, required: true },
});

const removedTXSchema = new Schema<IRemovedTX>({
    transactionHash: { type: String, required: true },
    chain: { type: String, required: true },
    created: { type: Number, required: true },
});

const stateSchema: Schema = new Schema({
    _id: { type: String, required: true },
    lastHeights: {
        type: Map,
        of: Number,
        required: true,
    },
    lastOfferId: { type: String },
    gauges: {
        eventsCount: {
            type: Map,
            of: Number,
            required: true,
        },
        revertedTxsCount: {
            type: Map,
            of: Number,
            required: true,
        },
        totalAmount: {
            type: Map,
            of: Number,
            required: true,
        },
    },
    updatedAt: { type: Date, default: Date.now },
});

const baseAccountSchema = new Schema({
    address: { type: String, required: true },
    pub_key: {
        type: {
            '@type': { type: String, required: true },
            key: { type: String, required: true },
        },
        required: false,
    },
    account_number: { type: String, required: true },
    sequence: { type: String, required: true },
});

const forwardingAccountSchema = new Schema<ForwardingAccount>({
    base_account: { type: baseAccountSchema },
    channel: { type: String, required: true },
    recipient: { type: String, required: true },
    created_at: { type: String },
});

const nobleAccountSchema = new Schema<INobleAccount>({
    nobleAddress: { type: String, required: true, unique: true },
    account: { type: forwardingAccountSchema },
    isAgoricForwardingAcct: { type: Boolean, required: true },
});


export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
export const Submission = mongoose.model<ISubmission>('Submission', submissionSchema);
export const RemovedTX = mongoose.model<IRemovedTX>('RemovedTX', removedTXSchema);
const State = mongoose.model<IState>('State', stateSchema);
const NobleAccount = mongoose.model<INobleAccount>('NobleAccount', nobleAccountSchema);

/**
 * Adds a new transaction to the database.
 * @param {ITransactionDetails} data - Transaction details to add.
 * @returns {Promise<ITransactionDetails>} - The newly created transaction.
 */
export const addTransaction = async (data: ITransactionDetails): Promise<ITransactionDetails> => {
    const transaction = new Transaction(data);
    return await transaction.save();
};

/**
 * Updates the status of a transaction based on its hash.
 * @param {string} transactionHash - The hash of the transaction to update.
 * @param {string} chain - The chain of the transaction.
 * @param {TransactionStatus} status - The new status to update.
 * @returns {Promise<ITransaction | null>} - The updated transaction, or null if not found.
 */
export const updateTransactionStatus = async (
    transactionHash: string,
    chain: string,
    status: TransactionStatus
): Promise<ITransaction | null> => {
    return await Transaction.findOneAndUpdate(
        { transactionHash, chain },
        { status },
        { new: true }
    );
};

/**
 * Updates the forwarding account and channel of a transaction based on its _id.
 * @param {string} _id - The id of the transaction to update.
 * @param {string} forwardingChannel - The new channel address to update.
 * @param {string} recipientAddress - The new recipient address to update.
 * @returns {Promise<ITransaction | null>} - The updated transaction, or null if not found.
 */
export const updateTransactionRecipientandChannel = async (
    _id: string,
    recipientAddress: string,
    forwardingChannel: string
): Promise<ITransaction | null> => {
    return await Transaction.findOneAndUpdate(
        { _id },
        { recipientAddress, forwardingChannel }
    );
};

/**
 * Adds a new submission to the database.
 * @param {string} transactionHash - The transaction hash.
 * @param {string} chain - The chain of the tx.
 * @returns {Promise<IRemovedTX>} - The newly created submission.
 */
export const addRemovedTX = async (
    transactionHash: string,
    chain: string,
): Promise<IRemovedTX> => {
    const removedTX = new RemovedTX({
        transactionHash,
        chain,
        created: Date.now()
    });
    return await removedTX.save();
};

/**
 * Gets removed transactions created since a particular timestamp
 * @param {Number} timestamp - The timestamps since when to get.
 * @returns {Promise<IRemovedTX[] | null>} - The transactions created since the passed timestamp
 */
export const getRemovedTransactionsSince = async (
    timestamp: Number,
): Promise<IRemovedTX[] | null> => {
    return await RemovedTX.find({ created: { $gte: timestamp } }).select('-_id');;
};

/**
 * Adds a new removed TX to the database.
 * @param {string} offerId - The offer ID for the submission.
 * @param {string} transactionHash - The transaction hash.
 * @param {string} transactionHash - The transaction hash.
 * @param {SubmissionStatus} submissionStatus - The submission status.
 * @param {number} timeoutHeight - The timeout height for the tx.
 * @returns {Promise<ISubmission>} - The newly created submission.
 */
export const addSubmission = async (
    offerId: string,
    transactionHash: string,
    reorged: boolean,
    submissionStatus: SubmissionStatus,
    timeoutHeight: number
): Promise<ISubmission> => {
    const submissionData = {
        offerId,
        transactionHash,
        reorged,
        submissionStatus,
        timeoutHeight
    };

    // Find a submission with the same transactionHash and update it, or insert if not found
    const submission = await Submission.findOneAndUpdate(
        { transactionHash },  // Find submission by transactionHash
        submissionData,        // Update fields
        { upsert: true, new: true }  // `upsert: true` will insert if no matching record is found
    );

    return submission;
};

/**
 * Updates the submission status by transaction hash.
 * @param {string} transactionHash - The transaction hash to find the submission.
 * @param {boolean} reorged - The reorged status.
 * @param {SubmissionStatus} submissionStatus - The new status of submission.
 * @param {number} timeoutHeight - The new timeout height for the tx.
 * @returns {Promise<ISubmission | null>} - The updated submission document or null.
 */
export const updateSubmissionStatus = async (
    transactionHash: string,
    reorged: boolean,
    submissionStatus: SubmissionStatus,
    timeoutHeight?: number
): Promise<ISubmission | null> => {
    const newValue: any = {
        submissionStatus
    }

    if (timeoutHeight) {
        newValue.timeoutHeight = timeoutHeight
    }
    return await Submission.findOneAndUpdate(
        { transactionHash, reorged },
        newValue,
        { new: true, upsert: true }
    );
};

/**
 * Fetches the submission status based on transaction hash and reorg status.
 * @param {string} transactionHash - The transaction hash.
 * @param {boolean} reorged - The reorg status.
 * @returns {Promise<Sub | null>} - The submission status, or null.
 */
export const getSubmission = async (
    transactionHash: string,
    reorged: boolean
): Promise<ISubmission | null> => {
    logger.debug(`Getting submission with txHash ${transactionHash} from DB`);
    const submission = await Submission.findOne({ transactionHash, reorged });
    return submission ? submission : null;
};

/**
 * Checks if a transaction exists based on hash and chain.
 * @param {string} transactionHash - The transaction hash to search for.
 * @param {string} chain - The blockchain network of the transaction.
 * @returns {Promise<ITransaction | null>} - The existing transaction or null.
 */
export const getTransactionByHash = async (
    transactionHash: string,
    chain: string
): Promise<ITransaction | null> => {
    return await Transaction.findOne({ transactionHash, chain });
};

/**
 * Gets transactions created since a particular timestamp
 * @param {Number} timestamp - The timestamps since when to get.
 * @returns {Promise<ITransaction[] | null>} - The transactions created since the passed timestamp
 */
export const getTransactionsSince = async (
    timestamp: Number,
): Promise<ITransaction[]> => {
    return await Transaction.find({ created: { $gte: timestamp } }).select('-_id');
};

/**
 * Gets transactions with unknown forwarding address created since a particular timestamp
 * @param {Number} timestamp - The timestamps since when to get.
 * @returns {Promise<ITransaction[] | null>} - The transactions created since the passed timestamp
 */
export const getUnknownFATransactionsSince = async (
    timestamp: Number,
): Promise<ITransaction[]> => {
    return await Transaction.find({ created: { $gte: timestamp }, recipientAddress: UNKNOWN_FA })
};

/**
 * Removes transaction from DB
 * @param _id id of the tx to remove
 */
export const removeTransaction = async (_id: string) => {
    await Transaction.findOneAndDelete({ _id });
}

/**
 * Retrieves all gauges from the state document.
 * @returns {Promise<Object | null>} - The gauges object or null if not found.
 */
export const getAllGauges = async () => {
    const result = await State.findOne({ _id: 'node-state' }, { gauges: 1, _id: 0 });
    const jsonResult = result?.toJSON()
    return jsonResult ? jsonResult.gauges : null;
};

/**
 * Retrieves all block heights from the state document.
 * @returns {Promise<Object | null>} - The heights object or null if not found.
 */
export const getAllHeights = async (): Promise<Record<string, number> | null> => {
    const result = await State.findOne({ _id: 'node-state' }, { lastHeights: 1, _id: 0 });
    const jsonRes = result?.toJSON()
    return jsonRes ? jsonRes.lastHeights : null;
};

/**
 * Sets the block height for a specific network.
 * @param {string} chain - The blockchain network (e.g., 'ethereum').
 * @param {number} height - The block height to set.
 * @returns {Promise<boolean>} - Returns true if updated or created; false otherwise.
 */
export const setHeightForChain = async (chain: string, height: number): Promise<boolean> => {
    const updateResult = await State.updateOne(
        { _id: 'node-state' },
        {
            $set: { [`lastHeights.${chain}`]: height, updatedAt: new Date() }
        },
        { upsert: true }
    );
    return updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0;
};

/**
 * Gets the last read offer ID.
 * @returns {Promis<string>} The last visited offer Id
 */
export const getLastOfferId = async () => {
    const result = await State.findOne({ _id: 'node-state' }, { lastOfferId: 1, _id: 0 });
    const jsonRes = result?.toJSON()
    return jsonRes ? jsonRes.lastOfferId : null;
};

/**
 * Sets the last read offer ID.
 * @param {string} offerId - The latest offer ID
 */
export const setLastOfferId = async (offerId: string) => {
    await State.updateOne(
        { _id: 'node-state' },
        {
            $set: { lastOfferId: offerId, updatedAt: new Date() }
        },
        { upsert: true }
    );
};

/**
 * Sets a specific gauge value in the state document.
 * @param {keyof IState['gauges']} gauge - The gauge to update (eventsCount, revertedTxsCount, totalAmount).
 * @param {string} network - The network label for the gauge.
 * @param {number} value - The new value for the gauge.
 * @returns {Promise<void>} - Void, resolves when done.
 */
export const setGaugeValue = async (
    gauge: keyof IState['gauges'],
    network: string,
    value: number
): Promise<void> => {
    await State.updateOne(
        {},
        { $set: { [`gauges.${gauge}.${network}`]: value, updatedAt: new Date() } },
        { upsert: true }
    );
};

/**
 * Gets the transactions which should be submitted according to the confirmations which have not been submitted
 * @param chain the chain to check for
 * @param currentHeight the current height of the chain
 * @returns Transactions which should be submitted to Agoric
 */
export const getTransactionsToBeSentForChain = async (chain: string, currentHeight: number) => {

    // Aggregation pipeline
    logger.debug(`Getting unsubmitted TXs on ${chain} that should have been submitted before block ${currentHeight}`)
    const transactions = await Transaction.aggregate([
        {
            $match: {
                chain: chain,
                confirmationBlockNumber: { $lte: currentHeight },
            },
        },
        {
            $lookup: {
                from: 'submissions',
                localField: 'transactionHash',
                foreignField: 'transactionHash',
                as: 'submissionDetails',
            },
        },
        {
            $match: {
                submissionDetails: { $eq: [] }, // Exclude transactions with matching txHash in submissions
            },
        },
    ]);

    return transactions;
}

/**
 * Gets the transactions with transaction hashes of submissions that have a status of "INFLIGHT"
 * and a timeoutHeight less than the given argument, regardless of the chain.
 *
 * @param maxTimeoutHeight The maximum timeout height to check against
 * @returns Transactions that meet the criteria
 */
export const getExpiredTransactionsWithInflightStatus = async (maxTimeoutHeight: number) => {
    // Aggregation pipeline
    const transactions = await Transaction.aggregate([
        {
            $lookup: {
                from: 'submissions', // Join with the submissions collection
                localField: 'transactionHash', // Match transaction hashes
                foreignField: 'transactionHash',
                as: 'submissionDetails',
            },
        },
        {
            $unwind: '$submissionDetails', // Deconstruct the submissionDetails array
        },
        {
            $match: {
                'submissionDetails.submissionStatus': 'INFLIGHT', // Match status "INFLIGHT"
                'submissionDetails.timeoutHeight': { $lt: maxTimeoutHeight }, // timeoutHeight less than the given argument
            },
        },
    ]);

    return transactions;
};

/**
 * Adds a new noble account to the database.
 * @param {INobleAccount} data - Noble account details to add.
 * @returns {Promise<INobleAccount>} - The newly created noble account.
 */
export const addNobleAccount = async (data: INobleAccount): Promise<INobleAccount> => {
    const nobleAccount = new NobleAccount(data);
    return await nobleAccount.save();
};

/**
 * Function to get noble account
 * @param {string} nobleAddress - The noble address to search for.
 * @returns {Promise<INobleAccount | null>} - The existing noble account or null.
 */
export const getNobleAccount = async (
    nobleAddress: string,
): Promise<INobleAccount | null> => {
    return await NobleAccount.findOne({ nobleAddress });
};

/**
 * Sums the transaction amounts for a specific chain starting from a given block number.
 *
 * @param collection - MongoDB collection containing transaction details.
 * @param chain - The blockchain name to filter transactions (e.g., "Ethereum").
 * @param blockNumber - The minimum block number to consider for the sum.
 * @returns The total transaction amount for the specified chain and block range.
 */
export const sumTransactionAmounts = async (
    chain: string,
    blockNumber: number
): Promise<number> => {
    // Perform an aggregation query to calculate the sum of amounts
    const result = await Transaction.aggregate<{ totalAmount: number }>([
        // Match stage: Filter transactions for the specified chain and blockNumber >= given value
        {
            $match: {
                chain: chain, // Filter by the blockchain name
                blockNumber: { $gte: blockNumber }, // Only include transactions from this block onward
                risksIdentified: { $size: 0 } // With no risks
            },
        },
        // Group stage: Group all matching transactions and calculate the total sum of the "amount" field
        {
            $group: {
                _id: null, // Use null as _id since we don't need to group by a specific field
                totalAmount: { $sum: "$amount" }, // Sum up the "amount" field for all matching documents
            },
        },
    ]);

    // Return the calculated total amount if there are results, otherwise return 0
    return result.length > 0 ? result[0].totalAmount : 0;
}

/**
 * Returns the sums of amounts for a specific block and the previous `x` blocks in the range.
 * If any block in the range is missing, the function returns an empty array.
 * 
 * @param chain - The blockchain name (e.g., Ethereum, Polygon).
 * @param blockNumber - The starting block number for the range.
 * @param blockRange - The number of blocks to include before the given block (including the blockNumber).
 * @returns An object containing `blockSums` (array of block sums) and `totalSum` (sum of all block sums).
 */
export const getBlockSums = async (
    chain: string,
    blockNumber: number,
    blockRange: number
) => {
    // Define the range of blocks to query
    const blocks = Array.from({ length: blockRange }, (_, i) => blockNumber - i).reverse();

    // Perform an aggregation query to get sums for each block in the range
    const result = await Transaction.aggregate<ChainBlockRangeAmountState>([
        {
            $match: {
                chain: chain,
                blockNumber: { $in: blocks },
                risksIdentified: { $size: 0 }, // Only include transactions with no risks
            },
        },
        {
            $group: {
                _id: "$blockNumber", // Group by blockNumber
                sum: { $sum: "$amount" }, // Sum up the amounts for each block
            },
        },
        {
            $project: {
                _id: 0, // Exclude _id field from the result
                block: "$_id",
                sum: 1,
            },
        },
    ]);

    // Create a map for quick lookups
    const resultMap = new Map(result.map((entry) => [entry.block, entry.sum]));

    // Ensure all blocks in the range exist, returning 0 if any are missing
    const blockSums: ChainBlockRangeAmountState[] = blocks.map((block) => ({
        block,
        sum: resultMap.get(block) || 0,
    }));

    // Calculate the total sum
    const totalSum = blockSums.reduce((acc, entry) => acc + entry.sum, 0);

    return { blockSums, totalSum };
};

// Initialize DB connection on app start
connectDB();
