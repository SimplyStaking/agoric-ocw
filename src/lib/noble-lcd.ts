import { NOBLE_LCD_URL } from '../config/config.js';
import type { IBCChannelID, NobleAddress } from '../types.js';
import { logger } from '../utils/logger';

export type BaseAccount = {
  '@type': '/cosmos.auth.v1beta1.BaseAccount';
  address: NobleAddress;
  pub_key: {
    '@type': string;
    key: string;
  } | null;
  account_number: string;
  sequence: string;
};

export type ForwardingAccount = {
  '@type': '/noble.forwarding.v1.ForwardingAccount';
  base_account: Omit<BaseAccount, '@type'>;
  channel: IBCChannelID;
  recipient: string; // e.g. agoric1234+osmos123
  created_at: string;
};

export type QueryAccountResponse = {
  account: BaseAccount | ForwardingAccount;
};

export type QueryAccountError = {
  code: number;
  message: string;
  details: string[];
};

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

type CacheEntry =
  | ({ isAgoricForwardingAcct: true } & ForwardingAccount)
  | { isAgoricForwardingAcct: false };

/**
 * in-memory map to cache address lookup queries
 */
const accountCache = new Map<NobleAddress, CacheEntry>();

/**
 * Gets an agoric forwarding account from a noble address
 * @param nobleLCD nobleLCD to query noble
 * @returns A forwarding account or null if its not an agoric forwarding account
 */
export const getForwardingAccount =
  async (nobleLCD: NobleLCD, address: NobleAddress): Promise<ForwardingAccount | null> => {
    // Forwarding target derivation requires a query to a Noble LCD or RPC node.
    // The response is deterministic, so let's cache any results.
    const cached = accountCache.get(address);
    if (cached) {
      logger.debug('Retrieved address details from cache.');
      const { isAgoricForwardingAcct, ...details } = cached;
      if (!isAgoricForwardingAcct) {
        logger.debug(`${address} is not an Agoric forwarding account.`);
        return null;
      }
      return details as ForwardingAccount;
    }

    // query LCD client for account details
    try {
      const res = await nobleLCD.queryAccount(address);
      if (!('account' in res)) throw new Error(res.message);

      const accountDetails = (res as QueryAccountResponse).account;
      logger.debug('Fetched account details:', JSON.stringify(accountDetails));

      // we are only interested in ForwardingAccounts
      if (accountDetails['@type'] !== '/noble.forwarding.v1.ForwardingAccount') {
        logger.debug(`${accountDetails.address} is not a forwarding account.`);
        accountCache.set(address, { isAgoricForwardingAcct: false });
        return null;
      }
      // we are only interested in agoric plus address accounts
      // TODO use actual Agoric settlement LCA address
      if (
        (!accountDetails.recipient.startsWith('agoric') &&
          !accountDetails.recipient.includes('+')) ||
        accountDetails.channel != "channel-21"
      ) {
        logger.debug(
          `${accountDetails.recipient} is not an Agoric forwarding address.`,
        );
        accountCache.set(address, { isAgoricForwardingAcct: false });
        return null;
      }
      accountCache.set(address, {
        ...accountDetails,
        isAgoricForwardingAcct: true,
      });
      return accountDetails;

    } catch (err) {
      logger.error(`Failed to query noble to get forwarding account: ${err}`)
      return null;
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