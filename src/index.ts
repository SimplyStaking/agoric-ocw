import '@endo/init/pre.js'; // needed only for the next line
import '@endo/init/pre-remoting.js';
import '@endo/init/unsafe-fast.js';
import express from 'express';
import { intialiseGauges, register, saveRPCStates } from './metrics';
import { startMultiChainListener } from "./listener";
import { logger } from "./utils/logger";
import { backfill } from "./backfill";
import { monitorAgoric } from './submitter';

import { createAgoricWebSocket, getInvitation, getLatestOffers, getOfferById, initAgoricState, initChainPolicyScraper, lastOfferId, watcherInvitation, } from './lib/agoric';
import { WATCHER_WALLET_ADDRESS } from './config/config';
import { setLastOfferId } from './lib/db';

const app = express();
const PORT = 3011;

// Endpoint to expose Prometheus metrics
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (error:any) {
    res.status(500).send(error.toString());
  }
});

const main = async () => {
  app.listen(PORT, () => {
    logger.debug(`Prometheus metrics available at http://localhost:${PORT}/metrics`);
  });

  logger.info("Initialising chain policy scraper...")
  await initChainPolicyScraper();
  await initAgoricState();

  await getInvitation();
  if(watcherInvitation == ""){
    logger.error(`Did not find an accepted watcher invitation for ${WATCHER_WALLET_ADDRESS}. Please accept one`)
    process.exit(1)
  }
  createAgoricWebSocket()

  // Initialise gauges
  logger.info("Initialising gauges...")
  await intialiseGauges()

  // Perform backfill
  await backfill()

  // Monitor Agoric RPC
  logger.info("Starting Agoric monitoring...")
  await monitorAgoric()

  // Start multi chain listener
  logger.info("Starting Multi chain listener...")
  await startMultiChainListener()

  
}

try {
  main();
} catch (e) {
  logger.error('Fatal error:', e);
}

function onProcessExit(callback: () => void): void {
  process.on('beforeExit', async () => {
    console.log('Process is about to exit.');
    await callback();
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT. Exiting gracefully...');
    await callback();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Exiting gracefully...');
    await callback();
    process.exit(0);
  });

  process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
  });
}

// On process exit
onProcessExit(async () => {
  await saveRPCStates()
  if(lastOfferId){
    await setLastOfferId(lastOfferId)
  }
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.stack);
});

