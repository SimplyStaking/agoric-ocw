# Agoric CCTP OCW

This solution listens to CCTP transactions from other chains, and if the mint receiver is an Agoric address, it submits an evidence on Agoric

### What does this solution do?

1. Creates a websocket connection to multiple chains and has automatic reconnections if the connection gets dropped

2. Listens for ```event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)"``` on multiple chains

3. Submits an evidence to Agoric if:
    - The Destination Domain is 4
    - After querying noble to get the forwarding account, the mint receiver is an Agoric address and the channel-id is 21
    - This evidence not already submitted 
    - If the event contains ```removed:false```, which means that tx was reverted from a block reorganisation, a separate evidence is posted on Agoric

4. Outputs metrics regarding
    - RPC health 
    - RPC block number
    - Total Events found for Agoric
    - Total ReOrged TXs found which were destined to Agoric
    - Total amounts destined to Agoric

5. On startup, gets the events between the last height recorded by this watcher and the current height and submits evidences for any missed events

### Resubmission Mechanism

1. Submit tx with SYNC broadcast mode and set a timeout height of TX_TIMEOUT_BLOCKS + current height
2. Have a websocket connection to the agoric node constantly listening to new blocks
3. On every new block
    1. get the new offers from the last observed, Set all these offers to CONFIRMED in DB
    2. Loop through in flight txs from db whose timeout height is equal or less than the new block's height and retry it


### Testing Environment

This section will explain how to setup a testing environment. 
Note: This only works on Linux AMD machines. For other machines, rebuild agd from agoric-sdk and replace the binary

Prerequisites:
1. Docker
2. Anvil
3. Cast
4. agd and agoric in $PATH
5. Yarn

Steps:
1. Install Prerequisites
```
git clone https://github.com/Agoric/agoric-sdk.git 
yarn install
yarn build
yarn link-cli ~/bin/agoric
cd packages/cosmic-swingset && make
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```
1. Run a local agoric chain

```
docker run -d -p 26657:26657 --name agoric-localtestchain \
  -w /usr/src/upgrade-test-scripts \
  --entrypoint /usr/src/upgrade-test-scripts/start_agd.sh \
  simplystaking/agoric-fastusdc-test-chain:test
```

2. Run an Ethereum Fork

```
anvil --fork-url <eth_mainnet_rpc> --block-time 5 --host 0.0.0.0
```

3. Accept watcher invitation
```
node_modules/.bin/tsx ./scripts/accept.ts > acceptWatcher.json
agoric wallet send --offer acceptWatcher.json --from agoric1ee9hr0jyrxhy999y755mp862ljgycmwyp4pl7q  --keyring-backend="test" --home="./binaries"
```

4. Perform CCTP transfers
```
# SWAP
forge script foundry/script/SwapETHtoUSDC.s.sol --broadcast --rpc-url http://localhost:8545

# CCTP Transfer
RECIPIENT=$(node_modules/.bin/tsx scripts/address-encoder.ts noble1x0ydg69dh6fqvr27xjvp6maqmrldam6yfelqkd)
forge script foundry/script/CCTPTransfer.s.sol \
    --sig "run(bytes32,uint256)" \
    --rpc-url http://localhost:8545 \
    --broadcast \
    "$RECIPIENT" 10000000
```

References:
- https://github.com/agoric-labs/fast-usdc-offchain-watcher