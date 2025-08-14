import { refreshAgoricConnection, vStoragePolicy } from "./lib/agoric";
import { refreshConnection } from "./lib/evm-client";
import { refreshNobleConnection } from "./lib/noble-lcd";
import { setRpcAlive } from "./metrics";
import { isChainBlockHeightStale } from "./state";

/**
 * This function checks if there were new blocks in the past X minutes for each chain
 * and if not, it attempts a reconnection
 */
export const startRPCChecker = () => {
    setInterval(() => {
      // For each chain
      for (const chain in vStoragePolicy.chainPolicies) {
        if(isChainBlockHeightStale(chain)){
            setRpcAlive(chain, false)
            refreshConnection(chain);
        }
      }

      // Check agoric
      if(isChainBlockHeightStale("agoric")){
        setRpcAlive("agoric", false)
        refreshAgoricConnection();
      }

      // Check noble
      if(isChainBlockHeightStale("Noble")){
        setRpcAlive("Noble", false)
        refreshNobleConnection();
      }

    }, 60 * 1000)
  }