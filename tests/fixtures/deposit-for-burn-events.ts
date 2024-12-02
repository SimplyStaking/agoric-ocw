import type { Log } from 'viem';
import { DepositForBurnEvent } from '../../src/types';

/**
 * logs extracted from viem
 */
export const DEPOSIT_FOR_BURN_EVENTS = {
  // noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd
  'agoric-forwarding-acct': {
    transactionHash:
      '0xc81bc6105b60a234c7c50ac17816ebcd5561d366df8bf3be59ff387552761702',
    blockHash:
      '0x90d7343e04f8160892e94f02d6a9b9f255663ed0ac34caca98544c8143fee665',
    blockNumber: 21037663n,
    blockTimestamp: 10000000n,
    removed: false,
    amount: 150000000n,
    mintRecipient:
      '0x00000000000000000000000033c8d468adbe92060d5e34981d6fa0d8fedeef44',
    destinationDomain: 4,
    destinationTokenMessenger:
    '0x00000000000000000000000057d4eaf1091577a6b7d121202afbd2808134f117',
  },
  // noble1k5gef0mg2n9wyxy9umamhs0aa9wzxl6tpqvjtg
  'dydx-forwarding': {
    transactionHash:
      '0x227f2e4a6cba920b6214665a39e21763f86619c2d52bebcc54b5663d0bed073a',
    blockHash:
      '0xe2c8685f0c10f45b7a5e69581da4255c83160166add883e04151cae5cc6e1170',
    blockNumber: 21037665n,
    blockTimestamp: 10000000n,
    removed: false,
    amount: 150000000n,
    mintRecipient:
      '0x000000000000000000000000b51194bf6854cae21885e6fbbbc1fde95c237f4b',
    destinationDomain: 4,
    destinationTokenMessenger:
    '0x00000000000000000000000057d4eaf1091577a6b7d121202afbd2808134f117',
  },
  // noble1t83v48e3ql0hll7u6vas74ln4em4cctezars6l
  'noble-base-acct': {
    transactionHash:
      '0xf294da0faeb84d73658c1ce28918fe85abd5f870334e02e21b7fe72518cc11dd',
    blockHash:
      '0xb19ec1dce209525dde152f7763837851c54600c4ceb12cd8345e8c77666cf5c6',
    blockNumber: 21037667n,
    blockTimestamp: 10000000n,
    removed: false,
    amount: 150000000n,
    mintRecipient:
      '0x00000000000000000000000059e2ca9f3107df7fffdcd33b0f57f3ae775c6179',
    destinationDomain: 4,
    destinationTokenMessenger:
    '0x00000000000000000000000057d4eaf1091577a6b7d121202afbd2808134f117',
  },
  // noble1epztxndz7tzeqhrwn779dujsxzy30x6lxz6q7u
  'noble-addr-not-found': {
    transactionHash:
      '0xcd667876de0bd68e5b0fc570a70744db6b799ef1aa56e2687e47d7163ff00637',
    blockHash:
      '0x28ace135c8745a2945dff94ce6318771044feaeb089fcbeefef3f64340d8760a',
    blockNumber: 21037669n,
    blockTimestamp: 10000000n,
    removed: false,
    amount: 150000000n,
    mintRecipient:
      '0x000000000000000000000000c844b34da2f2c5905c6e9fbc56f2503089179b5f',
    destinationDomain: 4,
    destinationTokenMessenger:
    '0x00000000000000000000000057d4eaf1091577a6b7d121202afbd2808134f117',
  },
} as const satisfies Record<string, DepositForBurnEvent>;
