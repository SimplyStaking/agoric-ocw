
## Initial Setup

```sh
# setup foundry
curl -L https://foundry.paradigm.xyz | bash

# install foundry deps. This will add `anvil`, `forge`, and `cast` to your path
foundryup
```

## Run Anvil (local fork)

```sh
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

anvil --fork-url $RPC_URL
```

This will fork Ethereum Mainnet and setup test accounts. We will use the first test account, `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.


## Check ETH Balance

```sh
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

## Swap ETH for USDC

This will execute a solidity script that swaps ETH for USDC on Uniswap
```sh
forge script foundry/script/SwapETHtoUSDC.s.sol --broadcast --rpc-url http://localhost:8545
```

## Check USDC Balance

```sh
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```


## Encode Noble Address for Contract

```sh
node_modules/.bin/tsx scripts/address-encoder.ts noble14lwerrcfzkzrv626w49pkzgna4dtga8c5x479h
```

## Initiate CCTP Transfer
```sh
# transfer 10 USDC
RECIPIENT=$(node_modules/.bin/tsx scripts/address-encoder.ts noble14lwerrcfzkzrv626w49pkzgna4dtga8c5x479h)
forge script foundry/script/CCTPTransfer.s.sol \
    --sig "run(bytes32,uint256)" \
    --rpc-url http://localhost:8545 \
    --broadcast \
    "$RECIPIENT" 10000000
```
