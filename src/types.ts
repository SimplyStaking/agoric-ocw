export type NobleAddress = `noble1${string}`;
export type AgoricAddress = `agoric${string}`;
export type IBCChannelID = `channel-${number}`;
export type Hex = `0x${string}`

export type CCTPTxEvidence = {
  amount: bigint;
  status: TransactionStatus,
  blockHash: Hex;
  blockNumber: bigint;
  blockTimestamp: bigint;
  forwardingAddress: NobleAddress;
  forwardingChannel: IBCChannelID;
  recipientAddress: string;
  txHash: Hex;
  chainId: number;
};

export type CCTPReOrgEvidence = {
  txHash: Hex;
};

export enum TransactionStatus {
  CONFIRMED = 'CONFIRMED',
  FINALIZED = 'FINALIZED',
  REORGED = 'REORGED',
}

export enum SubmissionStatus {
  INFLIGHT = 'INFLIGHT',
  SUBMITTED = 'SUBMITTED',
  CANCELLED = 'CANCELLED',
}

export type DepositForBurnEvent = {
  transactionHash: Hex,
  blockHash: Hex,
  blockNumber: bigint,
  blockTimestamp: bigint,
  removed: boolean,
  amount: bigint,
  mintRecipient: string,
  destinationDomain: number,
  destinationTokenMessenger: string
}

export type ChainConfig = {
  contractAddress: string;
  name: string;
  rpcUrl: string;
}

export type AgoricRPCStatus = {
  height: number;
  syncing: boolean;
}

export type ChainPolicy = {
  cctpTokenMessengerAddress: string;
  chainId: number;
  confirmations: number;
  nobleContractAddress: string;
};

export type VStorage = {
  chainPolicies: {
    [chainName: string]: ChainPolicy;
  };
  nobleAgoricChannelId: string;
  nobleDomainId: number;
};

export interface CctpTxSubmission {
  aux: {
    forwardingChannel: IBCChannelID;
    recipientAddress: AgoricAddress;
  };
  blockHash: Hex;
  blockNumber: bigint;
  blockTimestamp: bigint;
  chainId: number;
  tx: {
    amount: bigint;
    forwardingAddress: NobleAddress;
  };
  txHash: Hex;
}

export type AgoricOCWOfferTemplate = {
  invitationSpec: any;
  proposal: {};
}

export type AgoricOCWOffer = AgoricOCWOfferTemplate & {
  id: number;
};

export type WatcherStatus = {
  offers: any,
  balances: any
}

export type NetworkConfig = {
  rpcAddrs: string[],
  chainName: string
}

export type AgoricSubmissionResponse = {
  txhash: string,
  raw_log: string,
  code: number
}