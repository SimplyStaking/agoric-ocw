import type { NobleAddress, QueryAccountError, QueryAccountResponse } from '@src/types.js';
import type {
  NobleLCD,
} from '@src/lib/noble-lcd.js';
import { TESTING_NOBLE_FA } from '@src/constants.js';

export const SCENARIOS: Record<string, NobleAddress> = {
  AGORIC_PLUS_ADDR: 'noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd',
  NON_AGORIC_FORWARDING: 'noble1k5gef0mg2n9wyxy9umamhs0aa9wzxl6tpqvjtg',
  NOBLE_BASE_ACCT: 'noble1t83v48e3ql0hll7u6vas74ln4em4cctezars6l',
  NOT_FOUND: 'noble1epztxndz7tzeqhrwn779dujsxzy30x6lxz6q7u',
  INVALID_CHECKSUM: 'noble1epztxndz7tzeqhrwn779dujsxzy30x6lxz6zzz',
};

/**
 * Returns mocked responses from Noble LCD. Built based on observed values from
 * mainnet adapted for testing.
 */
export const makeFakeNobleLCD = () =>
  ({
    queryAccount: async (
      address: NobleAddress,
    ): Promise<QueryAccountResponse | QueryAccountError> => {

      switch (address) {
        // forwarding account to agoric1+osmosis BaseAccount (plus address)
        case 'noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd': {
          return Promise.resolve({
            account: TESTING_NOBLE_FA
          });
        }

        // forwarding account to non-agoric chain
        case 'noble1k5gef0mg2n9wyxy9umamhs0aa9wzxl6tpqvjtg': {
          return Promise.resolve({
            account: {
              '@type': '/noble.forwarding.v1.ForwardingAccount',
              base_account: {
                address: 'noble1k5gef0mg2n9wyxy9umamhs0aa9wzxl6tpqvjtg',
                pub_key: null,
                account_number: '123',
                sequence: '0',
              },
              channel: 'channel-33',
              recipient: 'dydx1cfu69lg80ddgdn72nrt8nxajh0lw23zce6g6lq',
              created_at: '10599523',
            },
          });
        }
        // noble base account
        case 'noble1t83v48e3ql0hll7u6vas74ln4em4cctezars6l': {
          return Promise.resolve({
            account: {
              '@type': '/cosmos.auth.v1beta1.BaseAccount',
              address: 'noble1t83v48e3ql0hll7u6vas74ln4em4cctezars6l',
              pub_key: {
                '@type': '/cosmos.crypto.secp256k1.PubKey',
                key: 'abc/123',
              },
              account_number: '2939',
              sequence: '1234',
            },
          });
        }

        // error: forwarding account not yet registered
        case 'noble1epztxndz7tzeqhrwn779dujsxzy30x6lxz6q7u': {
          return Promise.resolve({
            code: 5,
            message:
              'rpc error: code = NotFound desc = account noble1epztxndz7tzeqhrwn779dujsxzy30x6lxz6q7u not found: key not found',
            details: [],
          });
        }

        // error: invalid address provided
        case 'noble1epztxndz7tzeqhrwn779dujsxzy30x6lxz6zzz': {
          return Promise.resolve({
            code: 3,
            message:
              'decoding bech32 failed: invalid checksum (expected xz6q7u got xz6zzz): invalid request',
            details: [],
          });
        }
        default: {
          throw new Error(`No fixture for address: ${address}`);
        }
      }
    },
  }) satisfies NobleLCD;
