import { ethers } from 'ethers';
import { processCCTPBurnEventLog } from './processor';
import { logger } from './utils/logger';
import { submitToAgoric } from './submitter';
import { setRpcAlive, setRpcBlockHeight } from './metrics';
import { ENV, EVENT_ABI, getChainFromConfig } from "./config/config";
import { ChainConfig, DepositForBurnEvent, Hex, TransactionStatus } from './types';
import { ContractEventPayload } from 'ethers';
import { getWsProvider } from './lib/evm-client';
import { getLatestBlockHeight, vStoragePolicy } from './lib/agoric';
import { getAllHeights, getTransactionsToBeSentForChain, setHeightForChain } from './lib/db';
import { backfillChain } from './backfill';
import { PROD } from './constants';
import { addBlockRangeStateEntry, blockRangeAmountState } from './state';
import { submissionQueue } from './queue';

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
    async (nonce, burnToken, amount, depositor, mintRecipient, destinationDomain, destinationTokenMessenger, destinationCaller, event: ContractEventPayload) => {
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
            blockTimestamp: BigInt(Date.now()),
            sender: depositor
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
    logger.debug(`New block from ${chain.name}: ${blockNumber}`)

    let currentHeights = await getAllHeights()
    let currentHeight = currentHeights ? currentHeights[chain.name] : 0;

    // Only perform backfill if the WS subsription skips a hieght
    if (blockNumber > currentHeight + 1) {
      logger.info(`Backfilling for ${chain.name} from ${currentHeight + 1}. This happened because there were missed blocks from WS before block ${blockNumber}.`)
      let chainConfig = await getChainFromConfig(chain.name)
      await backfillChain(chainConfig!, currentHeight + 1)
    }

    let transactions = await getTransactionsToBeSentForChain(chain.name, blockNumber)

    // At this point, backfilling is complete and transactions are added to the DB
    // We can set the height here before the submissions just in case submissions is slow to avoid backfilling again if a new block comes in before submissions are finished
    setRpcAlive(name, true);
    setRpcBlockHeight(name, blockNumber)

    // Set height in DB
    await setHeightForChain(chain.name, blockNumber);

    let agoricRPCStatus = await getLatestBlockHeight()

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
        sender: transaction.sender,
        blockTimestamp: transaction.blockTimestamp
      }
      submissionQueue.addToQueue(evidence, transaction.risksIdentified)
    }

    // Update block range state with new block
    addBlockRangeStateEntry(chain.name, blockNumber, vStoragePolicy.chainPolicies[chain.name].blockWindowSize)
  });

}

/**
 * Initializes listeners for multiple blockchain networks.
 */
export async function startMultiChainListener() {
  for (let chain in vStoragePolicy.chainPolicies) {
    let chainDetails = getChainFromConfig(chain)
    if (chainDetails) {
      chainDetails.contractAddress = ENV == PROD ? vStoragePolicy.chainPolicies[chain].cctpTokenMessengerAddress : chainDetails.contractAddress
      listen(chainDetails)
    }
    else {
      logger.error(`DID NOT FIND CHAIN CONFIG FOR ${chain}`)
      process.exit(1);
    }
  }
}