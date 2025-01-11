import { InvitationSpec } from "@agoric/smart-wallet/src/invitations";

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
  sender: Hex;
  chainId: number;
};

export type SubmissionQueueEvidence = {
  evidence: CCTPTxEvidence
  risksIdentified: string[]
}

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
  destinationTokenMessenger: string,
  sender: string
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

export type TxThreshold = { maxAmount: number; confirmations: number };

export type ChainPolicy = {
  attenuatedCttpBridgeAddresses: Hex[];
  cctpTokenMessengerAddress: string;
  chainId: number;
  confirmations: number;
  tx: number;
  blockWindow: number;
  blockWindowSize: number;
  txThresholds: TxThreshold[]
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
  invitationSpec: InvitationSpec;
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

export type ChainBlockRangeAmountState = {
  block: number;
  sum: number;
};

export type BlockRangeAmountState = Record<string, { entries: ChainBlockRangeAmountState[] }>;

export type AccountResponse = {
  account: {
    "@type": string;
    address: string;
    pub_key?: {
      "@type": string;
      key: string;
    };
    account_number: string;
    sequence: string;
  };
}

export type AccountDetails = {
  accountNumber: number;
  sequence: number;
}