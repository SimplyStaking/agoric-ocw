import '@endo/init/pre.js'; // needed only for the next line
import '@endo/init/pre-remoting.js';
import '@endo/init/unsafe-fast.js';
import { makeVstorageKit, boardSlottingMarshaller } from '@agoric/client-utils';
import { ACTIVE_AGORIC_RPC, AGORIC_NETWORK } from '../src/config/config';

/**
 * @import {BridgeAction} from '@agoric/smart-wallet/src/smartWallet.js';
 */

const marshaller = boardSlottingMarshaller();
export const INVITATION_MAKERS_DESC = 'oracle operator invitation';

/**
 * @param {BridgeAction} bridgeAction
 * @param {Pick<import('stream').Writable,'write'>} stdout
 */
const outputAction = (bridgeAction: any, stdout: any) => {
    const capData = marshaller.toCapData(harden(bridgeAction));
    stdout.write(JSON.stringify(capData));
    stdout.write('\n');
};

export const accept = async () => {
    const vsk = await makeVstorageKit({ fetch }, {
        rpcAddrs: [ACTIVE_AGORIC_RPC], network: AGORIC_NETWORK
    });
    const instance = vsk.agoricNames.instance.fastUsdc;
    assert(instance, 'fastUsdc instance not in agoricNames');

    /** @type {OfferSpec} */
    let offerId = `watcherAccept-${Date.now()}`
    const offer = {
        id: offerId,
        invitationSpec: {
            source: 'purse',
            instance,
            description: INVITATION_MAKERS_DESC,
        },
        proposal: {},
    };

    /** @type {ExecuteOfferAction} */
    const bridgeAction = {
        method: 'executeOffer',
        offer,
    };

    outputAction(bridgeAction, process.stdout);
}


(async () => {
    await accept()
})();