// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SwapETHtoUSDC is Script {
    // Mainnet addresses
    IUniswapV2Router02 constant router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    function run() external {
        // First Anvil account private key
        uint256 privateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address account = vm.addr(privateKey);

        console.log("Using account:", account);
        console.log("Initial ETH balance:", account.balance);
        console.log("Initial USDC balance:", USDC.balanceOf(account));

        vm.startBroadcast(privateKey);

        // Approve router to spend USDC
        USDC.approve(address(router), type(uint256).max);

        // Swap 1 ETH for USDC
        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = address(USDC);

        uint amountIn = 1 ether;
        router.swapExactETHForTokens{value: amountIn}(
            0, // Accept any amount of USDC
            path,
            account,
            block.timestamp + 15 minutes
        );

        console.log("Final ETH balance:", account.balance);
        console.log("Final USDC balance:", USDC.balanceOf(account));

        vm.stopBroadcast();
    }
}
