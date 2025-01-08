# Agoric CCTP OCW

This solution listens to CCTP transactions from other chains, and if the mint receiver is an Agoric address, it submits an evidence on Agoric

### What does this solution do?

1. Reads chain policies from Agoric 

2. Creates a websocket connection to multiple chains and has automatic reconnections if the connection gets dropped

3. Listens for ```event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)``` on multiple chains

4. Records a TX in the DB if:
    - The Destination Domain is 4
    - After querying noble to get the forwarding account, the mint receiver is an Agoric address and the channel-id is 21
    - This evidence not already submitted 

5. On every new block from the EVM chain:
    - Gets the transactions which were included in a block with height less than CURRENT_HEIGHT - CONFIRMATIONS_NEEDED
    - If there is no successful submission recorded in the DB, this is posted to Agoric

6. Outputs metrics regarding
    - RPC health 
    - RPC block number
    - Total Events found for Agoric
    - Total ReOrged TXs found which were destined to Agoric
    - Total amounts destined to Agoric
    - The last offer ID for the watcher account

7. On startup, gets the events between the last height recorded by this watcher and the current height and submits evidences for any missed events

8. Be able to resubmit evidences to Agoric if they fail until they succeed with the following resubmission mechanism:

    - Submit tx with SYNC broadcast mode and set a timeout height of TX_TIMEOUT_BLOCKS + current height
    - Have a websocket connection to the agoric node constantly listening to new blocks
    - On every new block
        - get the new offers from the last observed, Set all these offers to CONFIRMED in DB
        - Loop through in flight txs from db whose timeout height is equal or less than the new block's height and retry it

9. Stores TXs of Events with a FA which does not resolve yet (is yet to be created). These are held in the DB for a maximum of MINUTES_HOLDING_UNKNOWN_FA. On every new Noble block, these addresses are queried again.
    - If the FA resolves to a non-Agoric address, the TX is removed from the DB
    - If the FA resolves to an Agoric address, it is processed normally and submitted to Agoric as evidence

10. There is an edge case where a WS Provider can skip some blocks. For example, it provides block 101 before block 100, or it skips block 100. For this reason, we added a check to ensure that the new fetched block is the next in line from what we have in DB's state. If not, we perform a backfill on the skipped blocks

11. The solution has 2 rate limits:
    - A limit per transaction
    - A limit per sliding block window (obtained from chain policy)

12. The sliding block window limit works in this way:
    - On startup when backfilling, on every log, we get the transactions up till that block for that window and we place BLOCK_RANGE_LIMIT_EXCEEDED tag on the transaction if the limit is reached. After we finish backfilling, we make another call to the DB to get the latest amount for the block range

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
./binaries/agoric wallet send --offer acceptWatcher.json --from agoric1ee9hr0jyrxhy999y755mp862ljgycmwyp4pl7q  --keyring-backend="test" --home="./binaries"
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

### How to run

Running the OCW involves the following steps

1. Install agoric and agd
```
git clone https://github.com/Agoric/agoric-sdk.git
cd agoric-sdk
yarn install
yarn build
yarn link-cli ~/bin/agoric
cd packages/cosmic-swingset && make
echo "export PATH=$PATH:$HOME/bin" >> ~/.profile
source ~/.profile
agoric --version
agd version
```

2. Copy the .env file
```
cp .env.sample .env
```

3. Change the RPCs for the EVM chains, Agoric and Noble in .env
4. Change the watcher address to your wallet address in .env

5. Accept the oracle invitation by running the following
```
node_modules/.bin/tsx ./scripts/accept.ts > acceptWatcher.json
~/bin/agoric wallet send --offer acceptWatcher.json --from <YOUR_WALLET_ADDRESS>  --keyring-backend="test" --home="./binaries"
```

6. Run the containers
```
docker compose up -d
```