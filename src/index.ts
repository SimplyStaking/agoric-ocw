import express from 'express';
import { intialiseGauges, register, saveRPCStates } from './metrics';
import { startMultiChainListener } from "./listener";
import { logger } from "./utils/logger";
import { backfill } from "./backfill";

const app = express();
const PORT = 3011;

// Endpoint to expose Prometheus metrics
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

const main = async () => {
  app.listen(PORT, () => {
    logger.debug(`Prometheus metrics available at http://localhost:${PORT}/metrics`);
  });

  // Initialise gauges
  await intialiseGauges()

  // Perform backfill
  await backfill()


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
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.stack);
});

// process.on('unhandledRejection', async (reason: any, promise) => {
//   console.log(reason)
//   if (reason.name == "UnknownRpcError") {
//     if (reason.details) {
//       let details = reason.details.split(" ")
//       let endpoint = details[details.length - 1]
//       let chain = getChainFromEndpoint(endpoint)
//       if (chain) {
//         setTimeout(async () => {
//           await startChainListener(nobleLCD, chain)
//         }, 5000)

//         console.log(`Failed to connect to ${endpoint}`)
//       }

//     }
    
//   }
//   else if (reason.name == "WebSocketRequestError") {
//     let errMsg = reason.metaMessages[0]
//     let msgSplit = errMsg.split(" ")
//     let endpoint = msgSplit[msgSplit.length - 1].slice(0, -1);
//     let chain = getChainFromEndpoint(endpoint)
//     if (chain) {
//       unwatchChain(chain?.name)
//       setTimeout(async () => {
//         await startChainListener(nobleLCD, chain)
//       }, 5000)

//     }
//   }

//   // console.error('Unhandled rejection for:', reason);
// });

