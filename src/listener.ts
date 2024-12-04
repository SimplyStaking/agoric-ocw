import { ethers } from 'ethers';
import { processCCTPBurnEventLog } from './processor';
import { logger } from './utils/logger';
import { submitToAgoric } from './submitter';
import { setRpcAlive, setRpcBlockHeight } from './metrics';
import { ENV, EVENT_ABI, getChainFromConfig } from "./config/config";
import { ChainConfig, DepositForBurnEvent, Hex, TransactionStatus } from './types';
import { ContractEventPayload } from 'ethers';
import { getWsProvider } from './lib/evm-client';
import { vStoragePolicy } from './lib/agoric';
import { getTransactionsToBeSentForChain } from './lib/db';

/**
 * Listens for `DepositForBurn` events and new blocks, and handles reconnections on error.
 * @param chain - Chain configuration containing contract address, chain name, and RPC URL.
 */
export function listen(chain: ChainConfig) {
  const { contractAddress, name, rpcUrl } = chain;

  let wsProvider = getWsProvider(chain)

  const contract = new ethers.Contract(contractAddress, EVENT_ABI, wsProvider);

  logger.debug(`Listening for events on contract ${contractAddress} on ${name}`)

  // Listen for `DepositForBurn` events and process them
  contract.on("DepositForBurn",
    async (amount, mintRecipient, destinationDomain, destinationTokenMessenger, destinationCaller, event: ContractEventPayload) => {
      try {
        if (Number(destinationDomain) === 4) { // Filter by specific destination domain
          setRpcAlive(name, true);

          // Create a log object with details needed for processing
          const log: DepositForBurnEvent = {
            amount, mintRecipient, destinationDomain, destinationTokenMessenger,
            transactionHash: event.log.transactionHash as Hex,
            blockHash: event.log.blockHash as Hex,
            blockNumber: BigInt(event.log.blockNumber),
            removed: event.log.removed,
            blockTimestamp: BigInt(Date.now())
          };

          // Process the event and submit if evidence is found
          await processCCTPBurnEventLog(log, name);
        }
        else {
          logger.debug(`NOT FOR NOBLE from ${chain.name}: ${event.log.transactionHash}`)
        }
      } catch (err) {
        logger.error("Error while handling logs:", err);
      }
    });

  // Listen for new blocks
  wsProvider.on("block", async (blockNumber) => {
    setRpcAlive(name, true);
    setRpcBlockHeight(name, blockNumber)
    logger.debug(`New block from ${chain.name}: ${blockNumber}`)

    let transactions = await getTransactionsToBeSentForChain(chain.name, blockNumber)
    // For each transaction to be submitted, submit
    for (let transaction of transactions) {
      let evidence = {
        amount: transaction.amount,
        status: TransactionStatus.CONFIRMED,
        blockHash: transaction.blockHash,
        blockNumber: transaction.blockNumber,
        forwardingAddress: transaction.forwardingAddress,
        forwardingChannel: transaction.forwardingChannel,
        recipientAddress: transaction.recipientAddress,
        txHash: transaction.transactionHash,
        chainId: vStoragePolicy.chainPolicies[transaction.chain].chainId,
        blockTimestamp: transaction.blockTimestamp
      }
      await submitToAgoric(evidence)
    }
  });

}

/**
 * Initializes listeners for multiple blockchain networks.
 */
export async function startMultiChainListener() {
  for (let chain in vStoragePolicy.chainPolicies) {
    let chainDetails = getChainFromConfig(chain)
    if (chainDetails) {
      chainDetails.contractAddress = ENV == "prod" ? vStoragePolicy.chainPolicies[chain].nobleContractAddress : chainDetails.contractAddress
      listen(chainDetails)
    }
    else {
      logger.error(`DID NOT FIND CHAIN CONFIG FOR ${chain}`)
    }
  }
}