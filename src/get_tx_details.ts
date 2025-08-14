import "@endo/init/pre.js"; // needed only for the next line
import "@endo/init/pre-remoting.js";
import "@endo/init/unsafe-fast.js";
import { ethers } from "ethers";
import {
  ChainPolicy,
  DepositForBurnEvent,
  NobleAddress,
  TransactionStatus,
} from "./types"; // adjust paths if needed
import { EVENT_ABI, getChainFromConfig } from "./config/config";
import {
  getBlockTimestamp,
  getTxSender,
  getWsProvider,
} from "./lib/evm-client";
import { Hex } from "viem";
import { logger } from "./utils/logger";
import { getOCWForwardingAccount } from "./processor";
import { decodeToNoble } from "./utils/address";
import { decodeAddress, initChainPolicyScraper, vStoragePolicy } from "./lib/agoric";
import { getNobleLCDClient } from "./lib/noble-lcd";
import { UNKNOWN_FA } from "./constants";

export async function processEventFromTxHash(
  chain: string,
  txHash: string,
  contractAddress: string
) {
  const chainConfig = getChainFromConfig(chain);
  const provider = getWsProvider(chainConfig!);

  const contract = new ethers.Contract(contractAddress, EVENT_ABI, provider);
  const iface = contract.interface;

  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      logger.warn(`No receipt found for tx ${txHash}`);
      return;
    }

    for (const log of receipt.logs) {
      // Only process logs from our contract
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;

      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog?.name !== "DepositForBurn") continue;

        const {
          nonce,
          burnToken,
          amount,
          depositor,
          mintRecipient,
          destinationDomain,
          destinationTokenMessenger,
          destinationCaller,
        } = parsedLog.args;

        if (Number(destinationDomain) !== 4) {
          logger.debug(`NOT FOR NOBLE from ${name}: ${txHash}`);
          continue;
        }

        const timestamp = await getBlockTimestamp(
          provider,
          log.blockNumber,
          chainConfig?.name!
        );
        const sender = await getTxSender(provider, txHash, chainConfig?.name!);

        const burnEvent: DepositForBurnEvent = {
          amount,
          mintRecipient,
          destinationDomain,
          destinationTokenMessenger,
          transactionHash: txHash as Hex,
          blockHash: log.blockHash as Hex,
          blockNumber: BigInt(log.blockNumber),
          removed: log.removed || false,
          blockTimestamp: BigInt(timestamp),
          depositor,
          sender,
        };

        await processCCTPBurnEventLogTxDetails(burnEvent, chainConfig?.name!);
        logger.info(`Processed DepositForBurn from tx ${txHash}`);
      } catch (err) {
        logger.warn(`Failed to parse or process log from tx ${txHash}:`, err);
      }
    }
  } catch (err) {
    logger.error(`Error processing tx ${txHash}:`, err);
  }
}

/**
 * Function to get the confirmations needed for an amount
 * @param amount The amount for the TX
 * @param policy The chain policy
 * @returns a number of confirmations or -1 if above the threshold
 */
function getConfirmations(amount: number, policy: ChainPolicy): number {
    console.log("Policy", policy)
  const txThresholds = policy.txThresholds;
  if (!txThresholds || txThresholds.length == 0) {
    return policy.confirmations;
  }

  // Sort thresholds by maxAmount in ascending order
  const sortedThresholds = [...txThresholds].sort(
    (a, b) => a.maxAmount - b.maxAmount
  );

  // Find the first threshold where the amount is less than or equal to maxAmount
  const threshold = sortedThresholds.find((t) => amount <= t.maxAmount);

  // Return the confirmations or a default value (e.g., -1) if no threshold is matched
  return threshold ? threshold.confirmations : -1;
}

export async function processCCTPBurnEventLogTxDetails(
  event: DepositForBurnEvent,
  originChain: string,
  nobleLCD = getNobleLCDClient()
) {
  let chainId: number;
  switch (originChain) {
    case "Ethereum":
      chainId = 1;
      break;
    case "Optimism":
      chainId = 10;
      break;
    case "Base":
      chainId = 8453;
      break;
    case "Arbitrum":
      chainId = 42161;
      break;
    case "Polygon":
      chainId = 137;
      break;
    default:
      logger.error(`Unknown originChain: ${originChain}`);
      return null;
  }

  // If not to noble
  if (event.destinationDomain != 4) {
    logger.debug(`NOT FOR NOBLE from ${originChain}: ${event.transactionHash}`);
    return null;
  }

  logger.info(
    `Found DepositForBurn from ${originChain} to NOBLE (TX: ${event.transactionHash} on block ${event.blockNumber})`
  );

  // Get noble address
  const nobleAddress = decodeToNoble(event.mintRecipient || "");

  const agoricForwardingAcct = await getOCWForwardingAccount(
    nobleLCD,
    nobleAddress as NobleAddress
  );

  // If not an agoric forwarding account
  if (!agoricForwardingAcct) {
    logger.error(
      `(TX ${event.transactionHash}) ${nobleAddress} not an Agoric forwarding account `
    );
    return null;
  }

  logger.info(
    `(TX ${event.transactionHash}) ${nobleAddress} ${
      agoricForwardingAcct.recipient == UNKNOWN_FA ? "could be" : "is"
    } an Agoric forwarding address (${agoricForwardingAcct.channel} -> ${
      agoricForwardingAcct.recipient
    })`
  );

  // If reorged
  if (event.removed) {
    logger.info(`${event.transactionHash} on ${originChain} was REORGED`);

    return {
      amount: event.amount,
      status: TransactionStatus.REORGED,
      blockHash: event.blockHash,
      blockNumber: event.blockNumber,
      blockTimestamp: event.blockTimestamp,
      chainId: chainId,
      forwardingAddress: nobleAddress as NobleAddress,
      forwardingChannel: agoricForwardingAcct.channel,
      recipientAddress: agoricForwardingAcct.recipient,
      txHash: event.transactionHash!,
      sender: event.sender as Hex,
    };
  }

  // Check for settlementAccount
  const decodedAddress = decodeAddress(agoricForwardingAcct.recipient);
  if (!decodedAddress) {
    logger.error(
      `TX ${event.transactionHash} on ${originChain} with address ${agoricForwardingAcct.recipient} could not be decoded`
    );
  }

  const amount = Number(event.amount);
  let evidence = {
    amount: event.amount,
    status: TransactionStatus.CONFIRMED,
    blockHash: event.blockHash,
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    forwardingAddress: nobleAddress as NobleAddress,
    forwardingChannel: agoricForwardingAcct.channel,
    recipientAddress: agoricForwardingAcct.recipient,
    txHash: event.transactionHash!,
    chainId: chainId,
    sender: event.sender as Hex,
  };

  const confirmations = getConfirmations(
    amount,
    vStoragePolicy.chainPolicies[originChain]
  );

  let tx = {
    chain: originChain,
    status: TransactionStatus.CONFIRMED,
    blockNumber: Number(event.blockNumber),
    transactionHash: event.transactionHash,
    amount: amount,
    recipientAddress: agoricForwardingAcct.recipient,
    forwardingAddress: nobleAddress,
    forwardingChannel: vStoragePolicy.nobleAgoricChannelId,
    blockHash: event.blockHash,
    blockTimestamp: Number(event.blockTimestamp),
    risksIdentified: [],
    confirmationBlockNumber: Number(event.blockNumber) + confirmations,
    sender: event.sender as Hex,
    depositor: event.depositor as Hex,
    created: Date.now(),
  };
  console.log(tx);

}

(async () => {
    await initChainPolicyScraper();
  await processEventFromTxHash(
    "Base",
    "0xaf07d40dcc8258564cf0a9c3049949f444b600c378d942bb4c74f1781346fbf1",
    "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962"
  );
})();
