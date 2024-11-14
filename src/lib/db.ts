import mongoose, { Document, Schema } from 'mongoose';
import { DB_URL } from '../config/config';  // Import your DB connection URL from config
import { SubmissionStatus, TransactionStatus } from '../types';
import { logger } from '../utils/logger';

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

// Interface and Schema for Transaction Model
interface ITransaction extends Document {
    chain: string;
    blockNumber: number;
    status: TransactionStatus;
    transactionHash: string;
    amount: number;
    recipientAddress: string;
}

const transactionSchema = new Schema<ITransaction>({
    chain: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    transactionHash: { type: String, required: true, unique: true },
    status: { type: String, enum: Object.values(TransactionStatus), required: true },
    amount: { type: Number, required: true },
    recipientAddress: { type: String, required: true },
});

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

// Interface and Schema for Submission Model
interface ISubmission extends Document {
    transactionHash: string;
    reorged: boolean;
    submissionStatus: SubmissionStatus;
}

const submissionSchema = new Schema<ISubmission>({
    transactionHash: { type: String, required: true, unique: true },
    reorged: { type: Boolean, required: true, default: false },
    submissionStatus: { type: String, enum: Object.values(SubmissionStatus), required: true },
});

export const Submission = mongoose.model<ISubmission>('Submission', submissionSchema);

// Interface and Schema for State Model (Tracking gauges and heights)
export interface IState extends Document {
    lastHeights: Map<string, number>; // Map to store heights for any network name
    gauges: {
        eventsCount: Map<string, number>;
        revertedTxsCount: Map<string, number>;
        totalAmount: Map<string, number>;
    };
    updatedAt: Date;
}

// State Schema that holds node state for multiple networks
const stateSchema: Schema = new Schema({
    _id: { type: String, required: true },
    lastHeights: {
        type: Map,
        of: Number,
        required: true,
    },
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

const State = mongoose.model<IState>('State', stateSchema);

/**
 * Adds a new transaction to the database.
 * @param {Object} data - Transaction details to add.
 * @returns {Promise<ITransaction>} - The newly created transaction.
 */
export const addTransaction = async (data: {
    chain: string;
    blockNumber: number;
    transactionHash: string;
    status: TransactionStatus;
    amount: number;
    recipientAddress: string;
}): Promise<ITransaction> => {
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
 * Adds a new submission to the database.
 * @param {string} transactionHash - The transaction hash.
 * @param {boolean} reorged - The reorg status.
 * @param {SubmissionStatus} submissionStatus - The submission status.
 * @returns {Promise<ISubmission>} - The newly created submission.
 */
export const addSubmission = async (
    transactionHash: string,
    reorged: boolean,
    submissionStatus: SubmissionStatus
): Promise<ISubmission> => {
    const submission = new Submission({
        transactionHash,
        reorged,
        submissionStatus,
    });
    return await submission.save();
};

/**
 * Updates the submission status by transaction hash.
 * @param {string} transactionHash - The transaction hash to find the submission.
 * @param {boolean} reorged - The reorged status.
 * @param {SubmissionStatus} submissionStatus - The new status of submission.
 * @returns {Promise<ISubmission | null>} - The updated submission document or null.
 */
export const updateSubmissionStatus = async (
    transactionHash: string,
    reorged: boolean,
    submissionStatus: SubmissionStatus
): Promise<ISubmission | null> => {
    return await Submission.findOneAndUpdate(
        { transactionHash, reorged },
        { submissionStatus },
        { new: true }
    );
};

/**
 * Fetches the submission status based on transaction hash and reorg status.
 * @param {string} transactionHash - The transaction hash.
 * @param {boolean} reorged - The reorg status.
 * @returns {Promise<SubmissionStatus | null>} - The submission status, or null.
 */
export const getSubmissionStatus = async (
    transactionHash: string,
    reorged: boolean
): Promise<SubmissionStatus | null> => {
    const submission = await Submission.findOne({ transactionHash, reorged });
    return submission ? submission.submissionStatus : null;
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
 * Retrieves all gauges from the state document.
 * @returns {Promise<Object | null>} - The gauges object or null if not found.
 */
export const getAllGauges = async (): Promise<Object | null> => {
    const result = await State.findOne({ _id: 'node-state' }, { gauges: 1, _id: 0 });
    return result ? result.gauges : null;
};

/**
 * Retrieves all block heights from the state document.
 * @returns {Promise<Object | null>} - The heights object or null if not found.
 */
export const getAllHeights = async (): Promise<Object | null> => {
    let result = await State.findOne({ _id: 'node-state' }, { lastHeights: 1, _id: 0 });
    let jsonRes = result?.toJSON()
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

// Initialize DB connection on app start
connectDB();
