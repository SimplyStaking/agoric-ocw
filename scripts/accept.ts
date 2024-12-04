import '@endo/init/pre.js'; // needed only for the next line
import '@endo/init/pre-remoting.js';
import '@endo/init/unsafe-fast.js';
import { makeVstorageKit, boardSlottingMarshaller } from '@agoric/client-utils';
import { ACTIVE_AGORIC_RPC, AGORIC_NETWORK } from '../src/config/config';
import { ExecuteOfferAction } from '@agoric/smart-wallet/src/smartWallet';
import { OfferSpec } from '@agoric/smart-wallet/src/offers';

const marshaller = boardSlottingMarshaller();
export const INVITATION_MAKERS_DESC = 'oracle operator invitation';

/**
 * TOutputs the action to be executed
 * @param {BridgeAction} bridgeAction
 * @param {Pick<import('stream').Writable,'write'>} stdout
 */
const outputAction = (bridgeAction: any, stdout: any) => {
    const capData = marshaller.toCapData(harden(bridgeAction));
    stdout.write(JSON.stringify(capData));
    stdout.write('\n');
};

/**
 * Function to create offer args to accept a watcher invitation
 */
export const accept = async () => {
    const vsk = await makeVstorageKit({ fetch }, {
        rpcAddrs: [ACTIVE_AGORIC_RPC], network: AGORIC_NETWORK
    });
    const instance = vsk.agoricNames.instance.fastUsdc;
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