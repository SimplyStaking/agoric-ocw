import { boardSlottingMarshaller } from "@agoric/client-utils";
import { BaseAccount, ForwardingAccount } from "./types";

export const UNKNOWN_FA = "UNKNOWN";
export const NOBLE_CCTP_DOMAIN = 4;
export const PROD = "PROD";
export const EXPECTED_NOBLE_CHANNEL_ID = "channel-21";
export const TESTING_NOBLE_FA_ADDR = "noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd";
export const TESTING_NOBLE_FA_RECIPIENT = "agoric10rchphk2al7nk87vwfyu87pjxwyxnw7aw98hkv4fdd2heurszf8n06wy8az423padaek6me38qekget2vdhx66mtvy6kg7nrw5uhsaekd4uhwufswqex6dtsv44hxv3cd4jkuqpq54ew3p"
export const TESTING_SETTLEMENT_ADDR = "agoric139rzngvjxghadprms96tk7fxssqwrhlpmz48gvwqxv5djwaz7fyqcx9tq9";
export const TESTING_NOBLE_FA: ForwardingAccount | BaseAccount = {
    '@type': '/noble.forwarding.v1.ForwardingAccount',
    base_account: {
        account_number: '121',
        address: 'noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd',
        pub_key: null,
        sequence: '0',
    },
    channel: EXPECTED_NOBLE_CHANNEL_ID,
    created_at: '10599524',
    recipient: TESTING_NOBLE_FA_RECIPIENT,
};

export const PORT = 3011;
export const MARSHALLER = boardSlottingMarshaller();
export const INVITATION_MAKERS_DESC = 'oracle operator invitation';
export const NFA_WORKER_ENDPOINT = 'https://fastusdc-map.agoric-core.workers.dev';