require('dotenv').config();

import { processCCTPBurnEventLog } from "../../src/processor";
import { CCTPTxEvidence, TransactionStatus } from "../../src/types";
import { updateTransactionStatus } from "../../src/lib/db";
import { DEPOSIT_FOR_BURN_EVENTS } from "../fixtures/deposit-for-burn-events";
import { SCENARIOS, makeFakeNobleLCD } from "../mocks/fake-noble-lcd";

jest.mock('./../../src/lib/db', () => ({
  addTransaction: jest.fn(),
  getTransactionByHash: jest.fn(),
  updateTransactionStatus: jest.fn(),
}));

jest.mock('./../../src/metrics', () => ({
  setGaugeValue: jest.fn(),
  incrementEventsCount: jest.fn(),
  incrementTotalAmount: jest.fn(),
  incrementRevertedCount: jest.fn(),
}));

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
    let evidence = await processCCTPBurnEventLog(DEPOSIT_FOR_BURN_EVENTS['noble-base-acct'], "Ethereum", fakeNobleLCD);
    // Should not report non-forwarding accounts
    expect(evidence).toBe(null);
  });

  test('processes event for dydx forwarding account without reporting', async () => {
    let evidence = await processCCTPBurnEventLog(DEPOSIT_FOR_BURN_EVENTS['dydx-forwarding'], "Ethereum", fakeNobleLCD);
    // Should not report non-Agoric forwarding accounts
    expect(evidence).toBe(null);
  });

  test('processes event for agoric plus address with reporting', async () => {
    let evidence = await processCCTPBurnEventLog(DEPOSIT_FOR_BURN_EVENTS['agoric-forwarding-acct'], "Ethereum", fakeNobleLCD);

    const expectedEvidence: CCTPTxEvidence = {
      amount: 150000000n,
      status: TransactionStatus.CONFIRMED,
      blockHash:
        '0x90d7343e04f8160892e94f02d6a9b9f255663ed0ac34caca98544c8143fee665',
      blockNumber: 21037663n,
      forwardingAddress: SCENARIOS.AGORIC_PLUS_ADDR,
      forwardingChannel: 'channel-21',
      recipientAddress:
        'agoric16kv2g7snfc4q24vg3pjdlnnqgngtjpwtetd2h689nz09lcklvh5s8u37ek+osmo183dejcnmkka5dzcu9xw6mywq0p2m5peks28men',
      txHash:
        '0xc81bc6105b60a234c7c50ac17816ebcd5561d366df8bf3be59ff387552761702',
    };
    
    expect(JSON.stringify(evidence)).toEqual(JSON.stringify(expectedEvidence));
  });

  test('handles non-noble domain', async () => {
    const nonNobleEvent = {
      ...DEPOSIT_FOR_BURN_EVENTS['agoric-forwarding-acct'],
      destinationDomain: 3
    };

    let evidence = await processCCTPBurnEventLog(nonNobleEvent, "Ethereum", fakeNobleLCD);

    // Should not report for non-Noble domains
    expect(evidence).toBe(null);
  });
});
