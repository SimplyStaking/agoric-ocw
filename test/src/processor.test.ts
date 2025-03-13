require('dotenv').config({ path: '.env.test' });

import { EXPECTED_NOBLE_CHANNEL_ID, TESTING_NOBLE_FA_ADDR, TESTING_NOBLE_FA_RECIPIENT, TESTING_SETTLEMENT_ADDR } from "../../src/constants";
import { processCCTPBurnEventLog } from "../../src/processor";
import { TransactionStatus } from "../../src/types";
import { DEPOSIT_FOR_BURN_EVENTS } from "../fixtures/deposit-for-burn-events";
import { SCENARIOS, makeFakeNobleLCD } from "../mocks/fake-noble-lcd";

function safeJSONStringify(obj: any) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  );
}

jest.mock('./../../src/lib/agoric', () => ({
  vStoragePolicy: {
    chainPolicies: {
      "Ethereum": {
        attenuatedCttpBridgeAddresses: ["0x19330d10D9Cc8751218eaf51E8885D058642E08A"],
        chainId: 1,
        nobleContractAddress: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
        rateLimits: {
          tx: 1000,
          blockWindow: 10000,
          blockWindowSize: 10,
        }
      }
    }, nobleAgoricChannelId: 'channel-2a', nobleDomainId: 4
  },
  initChainPolicyScraper: jest.fn(),
  initAgoricState: jest.fn(),
  getInvitation: jest.fn(),
  createAgoricWebSocket: jest.fn(),
  queryWorkerForNFA: jest.fn((address) => {
    if (address === TESTING_NOBLE_FA_ADDR){
      return {
        recipient: TESTING_NOBLE_FA_RECIPIENT,
        channel: EXPECTED_NOBLE_CHANNEL_ID,
      }
    };
    return null;
  }),
  settlementAccount: TESTING_SETTLEMENT_ADDR,
  decodeAddress: jest.fn().mockReturnValue({
    baseAddress: 'agoric139rzngvjxghadprms96tk7fxssqwrhlpmz48gvwqxv5djwaz7fyqcx9tq9',
    query: { EUD: 'osmo183dejcnmkka5dzcu9xw6mywq0p2m5peks28men' }
  })
}));
jest.mock('./../../src/lib/db', () => ({
  addTransaction: jest.fn(),
  getTransactionByHash: jest.fn(),
  updateTransactionStatus: jest.fn(),
  getAllHeights: jest.fn(),
  getNobleAccount: jest.fn().mockReturnValue(null),
  addNobleAccount: jest.fn(),
}));

jest.mock('./../../src/metrics', () => ({
  setGaugeValue: jest.fn(),
  incrementEventsCount: jest.fn(),
  incrementTotalAmount: jest.fn(),
  incrementRevertedCount: jest.fn(),
  intialiseGauges: jest.fn(),
  getNobleAccount: jest.fn(),
  setRpcAlive: jest.fn(),
  setCurrentBlockRangeAmount: jest.fn(),
}));

jest.mock('./../../src/state', () => ({
  getTotalSumForChainBlockRangeAmount: jest.fn().mockReturnValue(0),
  incrementOrCreateBlock: jest.fn(),
  getAgoricWatcherAccountDetails: jest.fn().mockReturnValue({
    accountNumber: 1,
    sequence: 1
  }),
}));

jest.mock('@endo/init/pre.js', () => {
  return {};
});

jest.mock('@endo/init/pre-remoting.js', () => {
  return {};
});


jest.mock('@endo/init/unsafe-fast.js', () => {
  return {};
});


jest.mock('@agoric/cosmic-proto/address-hooks.js', () => {
  return {
    decodeAddressHook: jest.fn().mockReturnValue({
      baseAddress: 'agoric139rzngvjxghadprms96tk7fxssqwrhlpmz48gvwqxv5djwaz7fyqcx9tq9',
      query: { EUD: 'osmo183dejcnmkka5dzcu9xw6mywq0p2m5peks28men' }
    })
  };
});

jest.mock('@agoric/client-utils', () => {
  return {
    boardSlottingMarshaller: jest.fn()
  };
});

jest.mock('@agoric/casting', () => {
  return {};
});

jest.mock('mongodb', () => ({
  MongoClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    db: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        insertOne: jest.fn(),
        find: jest.fn(() => ({
          toArray: jest.fn(),
        })),
      }),
    }),
  })),
}));

describe('processor Tests', () => {

  afterAll(async () => {
    jest.clearAllTimers(); // if you’re using timers
  });

  const fakeNobleLCD = makeFakeNobleLCD();
  // updateTransactionStatus.mockResolvedValue(null)

  test('processes event for noble base account without reporting', async () => {
    const evidence = await processCCTPBurnEventLog(DEPOSIT_FOR_BURN_EVENTS['noble-base-acct'], "Ethereum", fakeNobleLCD);
    // Should not report non-forwarding accounts
    expect(evidence).toBe(null);
  });

  test('processes event for dydx forwarding account without reporting', async () => {
    const evidence = await processCCTPBurnEventLog(DEPOSIT_FOR_BURN_EVENTS['dydx-forwarding'], "Ethereum", fakeNobleLCD);
    // Should not report non-Agoric forwarding accounts
    expect(evidence).toBe(null);
  });

  test('handles non-noble domain', async () => {
    const nonNobleEvent = {
      ...DEPOSIT_FOR_BURN_EVENTS['agoric-forwarding-acct'],
      destinationDomain: 3
    };

    const evidence = await processCCTPBurnEventLog(nonNobleEvent, "Ethereum", fakeNobleLCD);

    // Should not report for non-Noble domains
    expect(evidence).toBe(null);
  });

  test('handles non-noble sender', async () => {
    const nonNobleSender = {
      ...DEPOSIT_FOR_BURN_EVENTS['agoric-forwarding-acct'],
      depositor: "0x00000",
      sender: "0x00000"
    };

    const evidence = await processCCTPBurnEventLog(nonNobleSender, "Ethereum", fakeNobleLCD);

    // Should not report for non-Noble domains
    expect(evidence).toBe(null);
  });

  test('handles large tx', async () => {
    const nonNobleSender = {
      ...DEPOSIT_FOR_BURN_EVENTS['agoric-forwarding-acct'],
      sender: "0x00000",
      depositor: "0x00000",
      amount: 100000n
    };

    const evidence = await processCCTPBurnEventLog(nonNobleSender, "Ethereum", fakeNobleLCD);

    // Should not report for non-Noble domains
    expect(evidence).toBe(null);
  });

  test('processes event for agoric plus address with reporting', async () => {
    const evidence = await processCCTPBurnEventLog(DEPOSIT_FOR_BURN_EVENTS['agoric-forwarding-acct'], "Ethereum", fakeNobleLCD);
    const expectedEvidence = {
      amount: 100n,
      status: TransactionStatus.CONFIRMED,
      blockHash:
        '0x90d7343e04f8160892e94f02d6a9b9f255663ed0ac34caca98544c8143fee665',
      blockNumber: 21037663n,
      chainId: 1,
      blockTimestamp: 10000000n,
      forwardingAddress: SCENARIOS.AGORIC_PLUS_ADDR,
      forwardingChannel: EXPECTED_NOBLE_CHANNEL_ID,
      recipientAddress:
        'agoric10rchpn5w8xzcrczpvxvkpw7edh8txcjgpyh4rzu400q8z5mm6ccqz7ew8az423padaek6me38qekget2vdhx66mtvy6kg7nrw5uhsaekd4uhwufswqex6dtsv44hxv3cd4jkuqpqrc9597',
      sender: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
      txHash:
        '0xc81bc6105b60a234c7c50ac17816ebcd5561d366df8bf3be59ff387552761702',
    };

    expect(JSON.parse(safeJSONStringify(evidence))).toEqual(JSON.parse(safeJSONStringify(expectedEvidence)));
  });
});
