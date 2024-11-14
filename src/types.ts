
export type NobleAddress = `noble1${string}`;
export type IBCChannelID = `channel-${number}`;
export type Hex = `0x${string}`

export type CCTPTxEvidence = {
  amount: bigint;
  status: TransactionStatus,
  blockHash: Hex;
  blockNumber: bigint;
  forwardingAddress: NobleAddress;
  forwardingChannel: IBCChannelID;
  recipientAddress: string;
  txHash: Hex;
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