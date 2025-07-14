import '@endo/init/pre.js'; // needed only for the next line
import '@endo/init/pre-remoting.js';
import '@endo/init/unsafe-fast.js';
import { makeVstorageKit } from '@agoric/client-utils';
import { ACTIVE_AGORIC_RPC_INDEX, AGORIC_NETWORK, AGORIC_RPCS } from '../src/config/config';
import { BridgeAction, ExecuteOfferAction } from '@agoric/smart-wallet/src/smartWallet';
import { OfferSpec } from '@agoric/smart-wallet/src/offers';
import { INVITATION_MAKERS_DESC, MARSHALLER } from '../src/constants';
import { RemotableObject } from '@endo/pass-style';

/**
 * TOutputs the action to be executed
 * @param {BridgeAction} bridgeAction
 * @param {Pick<import('stream').Writable,'write'>} stdout
 */
const outputAction = (bridgeAction: BridgeAction, stdout: any) => {
    const capData = MARSHALLER.toCapData(harden(bridgeAction));
    stdout.write(JSON.stringify(capData));
    stdout.write('\n');
};

/**
 * Function to create offer args to accept a watcher invitation
 */
export const accept = async () => {
    const vsk = await makeVstorageKit({ fetch }, {
        rpcAddrs: [AGORIC_RPCS[ACTIVE_AGORIC_RPC_INDEX]], network: AGORIC_NETWORK
    });
    const namedInstances = await vsk.readPublished('agoricNames.instance');
    const instance = namedInstances.find(
      ([label, _instance]: [string, RemotableObject<any>]) => label === 'fastUsdc',
    )?.[1];
    assert(instance, 'fastUsdc instance not in agoricNames');

    let offerId = `watcherAccept-${Date.now()}`
    const offer: OfferSpec = {
        id: offerId,
        invitationSpec: {
            source: 'purse',
            instance,
            description: INVITATION_MAKERS_DESC,
        },
        proposal: {},
    };

    const bridgeAction: ExecuteOfferAction = {
        method: 'executeOffer',
        offer,
    };

    outputAction(bridgeAction, process.stdout);
}

// Execute offer
(async () => {
    await accept()
})();