import { BaseAccount, ForwardingAccount } from "./types";

export const UNKNOWN_FA = "UNKNOWN";
export const NOBLE_CCTP_DOMAIN = 4;
export const PROD = "PROD";
export const EXPECTED_NOBLE_CHANNEL_ID = "channel-21";
export const TESTING_NOBLE_FA_ADDR = "noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd";
export const TESTING_NOBLE_FA: BaseAccount | ForwardingAccount = {
    '@type': '/noble.forwarding.v1.ForwardingAccount',
    base_account: {
        account_number: '121',
        address: 'noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd',
        pub_key: null,
        sequence: '0',
    },
    channel: EXPECTED_NOBLE_CHANNEL_ID,
    created_at: '10599524',
    recipient:
        'agoric16kv2g7snfc4q24vg3pjdlnnqgngtjpwtetd2h689nz09lcklvh5s8u37ek+osmo183dejcnmkka5dzcu9xw6mywq0p2m5peks28men',
};