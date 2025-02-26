import { ACTIVE_AGORIC_RPC_INDEX, AGORIC_NETWORK, AGORIC_RPCS, AGORIC_WS_RPCS, ENV, MAX_OFFERS_TO_LOOP, QUERY_PARAMS_INTERVAL, RPC_RECONNECT_DELAY, WATCHER_WALLET_ADDRESS, chainConfig, nextActiveAgoricRPC } from "../config/config";
import { logger } from "../utils/logger";
import WebSocket from 'ws';
import { execSync } from 'child_process';
import { makeVstorageKit } from '@agoric/client-utils';
import { AgoricSubmissionResponse, CctpTxSubmission, NetworkConfig, NobleAddress, OCWForwardingAccount, SubmissionStatus, TransactionStatus, VStorage } from "../types";
import { BridgeAction } from '@agoric/smart-wallet/src/smartWallet.js'
import {
    iterateReverse,
    makeFollower,
    makeLeader,
} from '@agoric/casting';
import axios from "axios";
import { setRpcBlockHeight, setWatcherLastOfferId } from "../metrics";
import { addNobleAccount, getExpiredTransactionsWithInflightStatus, getLastOfferId, setLastOfferId, updateSubmissionStatus } from "./db";
import { submissionQueue } from "../queue";
import { EXPECTED_NOBLE_CHANNEL_ID, MARSHALLER, NFA_WORKER_ENDPOINT, PROD, TESTING_NOBLE_FA, TESTING_NOBLE_FA_ADDR, TESTING_NOBLE_FA_RECIPIENT } from "@src/constants";
import { makeClientMarshaller } from "@src/utils/marshaller";
import { decodeAddressHook } from "@agoric/cosmic-proto/address-hooks.js";

// Holds the vstorage policy obtained from Agoric
export let vStoragePolicy: VStorage = {
    chainPolicies: {},
    eventFilter: '',
    nobleAgoricChannelId: '',
    nobleDomainId: 0
}

// Holds fast USDC settlement account
export let settlementAccount: string = ""

// Holds the watcher invitation ID
export let watcherInvitation: string = ""

// Holds the Agoric WS Provider
export let agoricWsProvider: WebSocket;

// Holds the last visited offer ID
export let lastOfferId: string | null;

const clientMarshaller = makeClientMarshaller();

const emptyCurrentRecord = {
    purses: [],
    offerToUsedInvitation: [],
    offerToPublicSubscriberPaths: [],
    liveOffers: [],
};

/**
 * Creates a websocket to be used for the websocket provider for Agoric
 */
export const createAgoricWebSocket = () => {
    let url = AGORIC_WS_RPCS[ACTIVE_AGORIC_RPC_INDEX]
    agoricWsProvider = new WebSocket(url);

    agoricWsProvider.on("open", () => {
        logger.debug(`Connected to Agoric on ${url}`);
        agoricWsProvider.send(` { "jsonrpc": "2.0", "method": "subscribe", "id": 0, "params": { "query": "tm.event='NewBlock'" } }`)
    });

    // Listen for new blocks
    agoricWsProvider.on('message', async (message: string) => {
        const msgJSON = JSON.parse(message)
        if (msgJSON.result.data) {
            const newHeight = Number(msgJSON.result.data.value.block.header.height)
            setRpcBlockHeight("agoric", newHeight)
            const newOffers = await getNewOffers()

            // Loop through each offer and set them to submitted
            for (const offer of newOffers) {
                await updateSubmissionStatus(offer.txHash, false, SubmissionStatus.SUBMITTED)
            }

            // Check for offers to be resubmitted
            const expiredTransactions = await getExpiredTransactionsWithInflightStatus(newHeight)
            // Loop though these and resubmit
            for (const transaction of expiredTransactions) {
                const evidence = {
                    amount: transaction.amount,
                    status: TransactionStatus.CONFIRMED,
                    blockHash: transaction.blockHash,
                    blockNumber: transaction.blockNumber,
                    forwardingAddress: transaction.forwardingAddress,
                    forwardingChannel: transaction.forwardingChannel,
                    recipientAddress: transaction.recipientAddress,
                    txHash: transaction.transactionHash,
                    chainId: vStoragePolicy.chainPolicies[transaction.chain].chainId,
                    sender: transaction.sender,
                    blockTimestamp: transaction.blockTimestamp
                }
                submissionQueue.addToQueue(evidence, transaction.risksIdentified)
            }

            logger.debug(`New block from agoric: ${newHeight}`);

        }
    });

    agoricWsProvider.on("close", () => {
        logger.error(`Disconnected on Agoric. Reconnecting...`);

        setTimeout(() => {
            // Go to next RPC in list
            nextActiveAgoricRPC();
            createAgoricWebSocket();
        }, RPC_RECONNECT_DELAY * 1000);
    });

    agoricWsProvider.on("error", (error: any) => {
        logger.error(`WebSocket error on Agoric: ${error}`);
    });
}

/**
 * Function to returns a network config
 * @returns {NetworkConfig} the current network config
 */
export const getNetworkConfig = (): NetworkConfig => {
    return { rpcAddrs: [AGORIC_RPCS[ACTIVE_AGORIC_RPC_INDEX]], chainName: AGORIC_NETWORK }
}

/**
 * SECURITY: closes over process and child_process
 *
 * @param {string} swingsetArgs
 * @param {import('./rpc').MinimalNetworkConfig} net
 * @param {string} from
 * @param {boolean} [dryRun]
 * @param {{home: string, backend: string}} [keyring]
 * @return {AgoricSubmissionResponse} response from command
 */
export const execSwingsetTransaction = (
    swingsetArgs: string,
    from: string,
    keyring: any = undefined,
): AgoricSubmissionResponse => {

    const homeOpt = keyring?.home ? `--home=${keyring.home}` : '';
    const backendOpt = keyring?.backend
        ? `--keyring-backend=${keyring.backend}`
        : '';
    const cmd = `agd --node=${AGORIC_RPCS[ACTIVE_AGORIC_RPC_INDEX]} --chain-id=${AGORIC_NETWORK} ${homeOpt} ${backendOpt} --from=${from} tx swingset ${swingsetArgs} --output=json --yes`;
    logger.debug(`Executing ${cmd}`);
    const response = JSON.parse(execSync(cmd).toString());
    return {
        code: response.code,
        raw_log: response.raw_log,
        txhash: response.txhash,
    }
};

/**
 * @param {string} addr
 * @param {Pick<VstorageKit, 'readPublished'>} io
 * @returns {Promise<import('@agoric/smart-wallet/src/smartWallet.js').CurrentWalletRecord>}
 */
export const getCurrent = async (addr: string, { readPublished }: any) => {
    // Partial because older writes may not have had all properties
    // NB: assumes changes are only additions
    let current = await readPublished(`wallet.${addr}.current`)
    if (current === undefined) {
        throw Error(`undefined current node for ${addr}`);
    }

    // Repair a type misunderstanding seen in the wild.
    // See https://github.com/Agoric/agoric-sdk/pull/7139
    let offerToUsedInvitation = current.offerToUsedInvitation;
    if (
        offerToUsedInvitation &&
        typeof offerToUsedInvitation === 'object' &&
        !Array.isArray(offerToUsedInvitation)
    ) {
        offerToUsedInvitation = Object.entries(offerToUsedInvitation);
        current = harden({
            ...current,
            offerToUsedInvitation,
        });
    }

    // override full empty record with defined values from published one
    return { ...emptyCurrentRecord, ...current };
};

/**
 * Gets the fastUsdc invitation for the address
 */
export const getInvitation = async () => {

    const { readPublished, agoricNames } = await makeVstorageKit(
        {
            fetch,
        },
        getNetworkConfig()
    );

    const fastUsdcBoardId = agoricNames.instance["fastUsdc"].getBoardId()

    const current = await getCurrent(WATCHER_WALLET_ADDRESS, { readPublished });
    const invitations = current.offerToUsedInvitation;
    for (const inv of invitations) {
        const invitationId = inv[0]
        const invitationDetails = inv[1]

        //if there is a value
        if (invitationDetails.value && invitationDetails.value.length > 0) {
            const boardId = invitationDetails.value[0].instance.getBoardId();
            if (boardId == fastUsdcBoardId) {
                watcherInvitation = invitationId
                logger.info(`Found Watcher Invitiation ${watcherInvitation} for ${WATCHER_WALLET_ADDRESS}`)
            }
        }
    }

    return watcherInvitation
}


/**
 * Queries chain parameters from vstorage
 * @returns {VStorage} the value from vstorage
 */
export const queryParams = async () => {
    // Read value from vstorage
    const { vstorage } = await makeVstorageKit(
        {
            fetch,
        },
        getNetworkConfig()
    );

    try {
        let capDataStr = await vstorage.readLatest("published.fastUsdc.feedPolicy")
        const { value } = JSON.parse(capDataStr);
        const specimen = JSON.parse(value);
        const { values } = specimen;
        const chainPolicyCapDataStr = values.map((s: any) => JSON.parse(s));
        capDataStr = await vstorage.readLatest("published.fastUsdc")
        const settlementAddressCapDataStr = JSON.parse(JSON.parse(capDataStr).value).values.map((s: any) => JSON.parse(s))
        const chainPolicy = clientMarshaller.fromCapData(chainPolicyCapDataStr.at(-1)) as VStorage
        const policy = {
            chainPolicy: chainPolicy as VStorage,
            settlementAccount: settlementAddressCapDataStr.at(-1).settlementAccount
        }
        return policy;
    } catch (err) {
        logger.error(`Failed to parse CapData for queryParams: ${err}`);
        return null
    }
}

/**
 * Queries the parameters from Agoric and updates them
 */
export const setParams = async () => {
    const params = await queryParams();
    if (params) {
        vStoragePolicy = params.chainPolicy;
        settlementAccount = params.settlementAccount
    }
    else {
        logger.error(`Failed to query parameters`)
    }
}

/**
 * Initialises the agoric state for the last offer id
 */
export const initAgoricState = async () => {
    lastOfferId = await getLastOfferId()
}

/**
 * Initialises a routine to scrape the config every 5 minutes
 */
export const initChainPolicyScraper = async () => {
    await setParams()

    if (vStoragePolicy.nobleDomainId == 0) {
        process.exit(1)
    }

    setInterval(async () => {
        await setParams();
    }, Number(QUERY_PARAMS_INTERVAL) * 1000)
}

/**
 * Returns a wallet follower
 * @param address the address to follow
 * @returns {Promise<ValueFollower>} wallet follower
 */
export const makeWalletFollower = async (address: string) => {
    const networkConfig = getNetworkConfig()
    const { unserializer } =
        await makeVstorageKit(
            {
                fetch,
            },
            networkConfig
        );

    const leader = makeLeader(networkConfig.rpcAddrs[0]);
    const follower = await makeFollower(
        `:published.wallet.${address}`,
        leader,
        {
            unserializer,
        },
    );

    return follower
}

/**
 * Function to get the latest offers
 * @returns {Promise<CctpTxSubmission[]>} a list of offers
 */
export const getLatestOffers = async () => {
    const offers: { [key: string]: CctpTxSubmission } = {};
    const follower = await makeWalletFollower(WATCHER_WALLET_ADDRESS)

    let count = 0;
    // Loop through offers, starting from latest
    for await (const followerElement of iterateReverse(follower)) {
        // If we hit max to loop, break out of loop
        if (count == MAX_OFFERS_TO_LOOP) {
            break
        }
        const offer = followerElement as any
        if (offer.value.updated === "offerStatus") {
            // Get id
            const id = offer.value.status.id;

            // If the offer is not errored and it is a SubmitEvidence
            if (!offer.value.status.hasOwnProperty("error") && offer.value.status.invitationSpec.invitationMakerName == "SubmitEvidence") {
                if (!offers[id]) {
                    offers[id] = offer.value.status.invitationSpec.invitationArgs[0]
                }
            }
        }
        count++;

    }
    return Object.values(offers)
};

/**
 * Function to get the latest offers since the last visited id
 * @returns {Promise<CctpTxSubmission[]>} a list of offers
 */
export const getNewOffers = async () => {
    logger.debug(`Getting new offers from ${lastOfferId ? lastOfferId : "start"}`)
    const offers: { [key: string]: CctpTxSubmission } = {};
    const follower = await makeWalletFollower(WATCHER_WALLET_ADDRESS);

    let count = 0;
    let firstId = 0;
    // Loop through offers, starting from latest
    for await (const followerElement of iterateReverse(follower)) {
        // If we hit max to loop, break out of loop
        if (count == MAX_OFFERS_TO_LOOP) {
            break;
        }
        const offer = followerElement as any
        if (offer.value.updated === "offerStatus") {
            // Get id
            const id = offer.value.status.id;

            firstId = !isNaN(id) && id > firstId ? id : firstId;

            // If the last visited ofer id is more recent than the current id
            if (lastOfferId && !isNaN(Number(lastOfferId)) && Number(lastOfferId) >= id) {
                break;
            }

            // If it is a SubmitEvidence
            if(offer.value.status.invitationSpec.invitationMakerName == "SubmitEvidence"){
                // If the offer is not errored  
                if (!offer.value.status.hasOwnProperty("error")) {
                    if (!offers[id]) {
                        offers[id] = offer.value.status.invitationSpec.invitationArgs[0]
                    }
                }
                else if (offer.value.status.error.includes("conflicting evidence")){
                    let details = offer.value.status.invitationSpec.invitationArgs[0]
                    logger.error(`Found conflicting evidence submission for ${details.txHash}`)
                    await updateSubmissionStatus(details.txHash, false, SubmissionStatus.FAILED)

                }
            }
        }
        count++;

    }
    
    const isNan = isNaN(Number(firstId))
    if (!isNan && firstId > 0) {
        await setLastOfferId(String(firstId))
        setWatcherLastOfferId(WATCHER_WALLET_ADDRESS, firstId)
        lastOfferId = String(firstId);
    }
    return Object.values(offers)
};


/**
 * Function to get an offer by the id
 * @param {string} id The id to look for
 * @returns {Promise<CctpTxSubmission | null>} the offer related to the submission or null
 */
export const getOfferById = async (id: string) => {
    const follower = await makeWalletFollower(WATCHER_WALLET_ADDRESS)

    let count = 0;
    // Loop through offers, starting from latest
    for await (const followerElement of iterateReverse(follower)) {
        // If we hit max to loop, break out of loop
        if (count == MAX_OFFERS_TO_LOOP) {
            break
        }
        const offer = followerElement as any
        if (offer.value.updated === "offerStatus") {
            // Get id
            const offerId = offer.value.status.id;

            // If the offer is not errored, it is a SubmitEvidence and the offerId matches
            if (!offer.value.status.hasOwnProperty("error") && offer.value.status.invitationSpec.invitationMakerName == "SubmitEvidence" && id == offerId) {
                return offer.value.status.invitationSpec.invitationArgs[0]
            }
        }
        count++;

    }
    return null
};

/**
 * A Function to output an action
 * @param bridgeAction bridge action to output
 * @returns Serialized bridge action
 */
export const outputAction = (bridgeAction: BridgeAction) => {
    return MARSHALLER.serialize(harden(bridgeAction));
};

/**
 * Function to get the latest block height and whether the node is syncing
 * @returns {object} A key height which holds the latest block number or 0 if it fails and a key syncing which holds whether the node is still syncing
 */
export const getLatestBlockHeight = async () => {
    try {
        // Construct the URL
        const apiUrl = `${AGORIC_RPCS[ACTIVE_AGORIC_RPC_INDEX]}/status`;

        // Make the GET request
        const response = await axios.get(apiUrl);

        // Parse the JSON response
        const responseData = response.data;

        // Extract the latest_block_height
        const latestBlockHeight = responseData.result.sync_info.latest_block_height;
        const catchingUp = responseData.result.sync_info.catching_up;
        // Calculate time behind 
        const latestBlockTime = new Date(responseData.result.sync_info.latest_block_time);
        const now = new Date();
        // Check if more than 1 minute behind
        const behind = now.getTime() - latestBlockTime.getTime() > (60 * 1000)

        // Convert it to a number
        const latestBlockHeightNumber = Number(latestBlockHeight);

        return {
            height: latestBlockHeightNumber,
            syncing: catchingUp || behind
        };

    } catch (error: any) {
        // Handle errors
        console.error('Failed to get block height:', error.message);
        return {
            height: 0,
            syncing: true
        };
    }
};


/**
 * Fuction to decode address
 * @param string address to decode
 * @returns decoded address
 */
export function decodeAddress(address: string) {
    try {
        const decoded = decodeAddressHook(address);
        if (!decoded.query || !decoded.query.EUD) {
            logger.debug(`No EUD parameter for agoric address ${address}`);
            return null;
        }
        return decoded
    } catch (e) {
        logger.debug(`Could not decode address hook for agoric address ${address}`);
        return null;
    }
}

/**
 * Function which queries recipient for NFA from worker
 * @param address noble address to query
 * @returns the recipient address or null if it does not exist
 */
export async function queryWorkerForNFA(address: NobleAddress) {
    if (address == TESTING_NOBLE_FA_ADDR && ENV != PROD) {
        await addNobleAccount({
            nobleAddress: address,
            account: {
                recipient: TESTING_NOBLE_FA_RECIPIENT,
                channel: EXPECTED_NOBLE_CHANNEL_ID,
            },
            isAgoricForwardingAcct: true
        })
        return {
            channel: EXPECTED_NOBLE_CHANNEL_ID,
            recipient: TESTING_NOBLE_FA_RECIPIENT
        } as OCWForwardingAccount
    }
    try {
        const response = await axios.get(`${NFA_WORKER_ENDPOINT}/lookup/${address}`);
        let res = response.data
        await addNobleAccount({
            nobleAddress: address,
            account: {
                recipient: res.recipient,
                channel: res.channel,
            },
            isAgoricForwardingAcct: true
        })
        return res;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            logger.debug(`Noble address ${address} not found in worker`);
            return null;
        }
        logger.error(`Error querying NFA from worker: ${error}`);
        return null
    }
}