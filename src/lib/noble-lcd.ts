import { add } from 'winston';
import { ENV, MINUTES_HOLDING_UNKNOWN_FA, NOBLE_LCD_URL, NOBLE_RPC_URL, NOBLE_RPC_WS_URL, RPC_RECONNECT_DELAY } from '../config/config';
import { EXPECTED_NOBLE_CHANNEL_ID, PROD, TESTING_NOBLE_FA, TESTING_NOBLE_FA_ADDR, UNKNOWN_FA } from '../constants';
import { incrementEventsCount, incrementMissedNFAs, incrementTotalAmount, setRpcBlockHeight } from '../metrics';
import type { ForwardingAccount, NobleAddress, QueryAccountError, QueryAccountResponse } from '../types';
import { logger } from '../utils/logger';
import { decodeAddress, vStoragePolicy } from './agoric';
import { addNobleAccount, getNobleAccount, getUnknownFATransactionsSince, removeTransaction, updateTransactionRecipientandChannel } from './db';
import WebSocket from 'ws';

// Holds the Noble WS Provider
export let nobleWsProvider: WebSocket;

export const makeNobleLCD = ({
  fetch = globalThis.fetch,
  apiAddr = 'https://noble-api.polkachu.com',
} = {}) => ({
  /**
   * Queries an account on the Noble chain
   *
   * @param address - The Noble address to query
   * @returns The account information
   * @throws {QueryAccountError} When the account doesn't exist or address is
   *   invalid
   */
  queryAccount: async (
    address: NobleAddress,
  ): Promise<QueryAccountResponse | QueryAccountError> => {
    if (address == TESTING_NOBLE_FA_ADDR && ENV != PROD) {
      return {
        account: TESTING_NOBLE_FA
      }
    }
    try {
      const res = await fetch(
        `${apiAddr}/cosmos/auth/v1beta1/accounts/${address}`,
      );
      const data = (await res.json()) as unknown as
        | QueryAccountResponse
        | QueryAccountError;
      if (!('account' in data) && !('code' in data)) {
        throw new Error(`Unexpected response shape ${JSON.stringify(data)}`);
      }
      return data;
    } catch (e) {
      logger.error(e);
      throw e;
    }
  },
});

export type NobleLCD = ReturnType<typeof makeNobleLCD>;

/**
 * Gets an agoric forwarding account from a noble address
 * @param nobleLCD nobleLCD to query noble
 * @returns A forwarding account or null if its not an agoric forwarding account
 */
export const getForwardingAccount =
  async (nobleLCD: NobleLCD, address: NobleAddress): Promise<ForwardingAccount | null> => {
    // query LCD client for account details
    try {
      const res = await nobleLCD.queryAccount(address);
      if (!('account' in res)) throw new Error(res.message);

      const accountDetails = (res as QueryAccountResponse).account;
      logger.debug(`Fetched account details: ${JSON.stringify(accountDetails)}`);

      // we are only interested in ForwardingAccounts
      if (accountDetails['@type'] !== '/noble.forwarding.v1.ForwardingAccount') {
        logger.debug(`${accountDetails.address} is not a forwarding account.`);
        await addNobleAccount({
          nobleAddress: address,
          isAgoricForwardingAcct: false
        })
        return null;
      }

      const expectedChannelId = ENV == PROD ? vStoragePolicy.nobleAgoricChannelId : EXPECTED_NOBLE_CHANNEL_ID
      // we are only interested in agoric plus address accounts
      if (
        (!accountDetails.recipient.startsWith('agoric') &&
          !accountDetails.recipient.includes('+')) ||
        accountDetails.channel != expectedChannelId
      ) {
        logger.debug(
          `${accountDetails.recipient} is not an Agoric forwarding address.`,
        );
        await addNobleAccount({
          nobleAddress: address,
          isAgoricForwardingAcct: false
        })
        return null;
      }

      // Check for EUD parameter
      const decodedAddress = decodeAddress(accountDetails.recipient)
      if (!decodedAddress) {
        await addNobleAccount({
          nobleAddress: address,
          isAgoricForwardingAcct: false
        })
        return null
      }

      await addNobleAccount({
        nobleAddress: address,
        account: accountDetails,
        isAgoricForwardingAcct: true
      })
      await incrementMissedNFAs();
      return accountDetails;

    } catch (err) {
      logger.error(`Failed to query noble to get forwarding account ${address}: ${err}`)
      return {
        '@type': '/noble.forwarding.v1.ForwardingAccount',
        base_account: {
          address: 'noble1',
          pub_key: null,
          account_number: "",
          sequence: "",
        },
        channel: "channel-0",
        recipient: UNKNOWN_FA,
        created_at: ""
      }
    }

  };

// A singleton instance of the NobleLCD client
let nobleLCDInstance: NobleLCD | null = null;

/**
 * Get the singleton instance of the NobleLCD client
 * @returns The NobleLCD client instance
 */
export const getNobleLCDClient = (): NobleLCD => {
  if (!nobleLCDInstance) {
    logger.debug('Creating new NobleLCD client instance.');
    nobleLCDInstance = makeNobleLCD({
      fetch: globalThis.fetch,
      apiAddr: NOBLE_LCD_URL || 'https://noble-api.polkachu.com', // You can change the API address if needed
    });
  } else {
    logger.debug('Using existing NobleLCD client instance.');
  }

  return nobleLCDInstance;
};

/**
 * Creates a websocket to be used for the websocket provider for Noble
 */
export function createNobleWebSocket() {
  nobleWsProvider = new WebSocket(NOBLE_RPC_WS_URL);

  nobleWsProvider.on("open", () => {
    logger.debug(`Connected to Noble on ${NOBLE_RPC_WS_URL}`);
    nobleWsProvider.send(` { "jsonrpc": "2.0", "method": "subscribe", "id": 0, "params": { "query": "tm.event='NewBlock'" } }`)
  });

  // Listen for new blocks
  nobleWsProvider.on('message', async (message: string) => {
    const msgJSON = JSON.parse(message)
    if (msgJSON.result.data) {
      const newHeight = Number(msgJSON.result.data.value.block.header.height)
      setRpcBlockHeight("Noble", newHeight)
      logger.debug(`New block from Noble: ${newHeight}`);

      // Get unknown transactions and query their forwarding address
      const since = Date.now() - (MINUTES_HOLDING_UNKNOWN_FA * 60 * 1000)
      const txs = await getUnknownFATransactionsSince(since)
      const nobleClient = getNobleLCDClient()

      // For each transaction query the noble forwarding account
      for (const tx of txs) {
        const forwardingAddress = tx.forwardingAddress
        const forwardingAccount = await getForwardingAccount(nobleClient, forwardingAddress as NobleAddress)

        // If null, discard the tx because it is not an agoric fa
        if (!forwardingAccount) {
          logger.debug(`TX (${tx.transactionHash}) is being removed as the recipient was found to be a non-Agoric address. FA was newly created after TX`)
          // Remove tx
          await removeTransaction(tx._id as string)
          return
        }

        // If an agoric forwarding account, update TX in db
        if (forwardingAccount?.recipient != UNKNOWN_FA) {
          logger.debug(`Recipient address for TX (${tx.transactionHash}) was updated to ${forwardingAccount?.recipient}. FA was newly created after TX`)
          incrementEventsCount(tx.chain)
          incrementTotalAmount(tx.chain, tx.amount)

          // Update tx FA
          await updateTransactionRecipientandChannel(tx._id as string, forwardingAccount?.recipient as string, forwardingAccount?.channel as string)
          return
        }

        logger.debug(`Forwarding account for ${forwardingAddress} is yet to be created`)
      }
    }
  });

  nobleWsProvider.on("close", () => {
    logger.error(`Disconnected on Noble. Reconnecting...`);

    setTimeout(() => {
      // Go to next RPC in list
      createNobleWebSocket();
    }, RPC_RECONNECT_DELAY * 1000);
  });

  nobleWsProvider.on("error", (error: any) => {
    logger.error(`WebSocket error on Noble: ${error}`);
  });
}