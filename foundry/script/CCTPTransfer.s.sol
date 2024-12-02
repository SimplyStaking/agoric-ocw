// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICCTPWrapper {
    function requestCCTPTransferWithCaller(
        uint256 transferAmount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        uint256 feeAmount,
        bytes32 destinationCaller
    ) external;
}

contract CCTPTransferScript is Script {
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address constant NOBLE_CCTP = 0xBC8552339dA68EB65C8b88B414B5854E0E366cFc;

    function run(bytes32 mintRecipient, uint256 transferAmount) external {
        uint256 privateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        //uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address account = vm.addr(privateKey);
        console.log("Using account:", account);
        
        // Fixed parameters
        uint32 destinationDomain = 0x04;        // 4
        address burnToken = address(USDC);
        uint256 feeAmount = 0x4e20;            // 20,000
        bytes32 destinationCaller = 0x000000000000000000000000691cf4641D5608f085b2c1921172120bb603d074;

        uint256 totalAmount = transferAmount + feeAmount;
        
        console.log("Mint recipient (bytes32):", vm.toString(mintRecipient));
        console.log("Transfer amount:", transferAmount);
        console.log("Fee amount:", feeAmount);
        console.log("Total amount needed:", totalAmount);
        
        vm.startBroadcast(privateKey);

        // Debug balance
        uint256 balance = USDC.balanceOf(account);
        console.log("USDC balance:", balance);

        // Approval for exact amount
        console.log("Approving USDC spending...");
        USDC.approve(NOBLE_CCTP, totalAmount);

        // CCTP transfer
        console.log("Executing CCTP transfer...");
        ICCTPWrapper(NOBLE_CCTP).requestCCTPTransferWithCaller(
            transferAmount,
            destinationDomain,
            mintRecipient,
            burnToken,
            feeAmount,
            destinationCaller
        );

        vm.stopBroadcast();
    }
}
