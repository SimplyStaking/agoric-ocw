"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepositForBurnEvent = void 0;
exports.listen = listen;
var viem_1 = require("viem");
var evm_client_1 = require("./lib/evm-client");
exports.DepositForBurnEvent = (0, viem_1.parseAbiItem)('event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)');
/**
 * Listens for real-time events on a blockchain and optionally fetches missed events.
 *
 * @param client - The client instance to use for connecting to the blockchain.
 * @param contractAddress - The address of the contract to listen for events on.
 * @param chainName - The name of the blockchain network (e.g., "mainnet").
 * @param enableFallback - This will enable an extra check for logs
 * @return A function to stop the event listener.
 */
function listen(client, contractAddress, chainName, enableFallback) {
    return __awaiter(this, void 0, void 0, function () {
        var unwatch;
        var _this = this;
        return __generator(this, function (_a) {
            console.log("Starting listener for ".concat(chainName, " on ").concat(contractAddress));
            unwatch = client.watchContractEvent(client, {
                address: contractAddress,
                abi: [exports.DepositForBurnEvent]
            }, function (event) {
                console.log("New Transfer event on ".concat(chainName, ":"), event);
            });
            /**
             * If fallback is enabled, periodically fetch logs to capture missed events
             */
            if (enableFallback) {
                setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                    var currentBlockHeight, logs, error_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 3, , 4]);
                                return [4 /*yield*/, (0, evm_client_1.fetchCurrentBlockNumber)(client, chainName)];
                            case 1:
                                currentBlockHeight = _a.sent();
                                return [4 /*yield*/, client.getLogs(client, {
                                        address: contractAddress,
                                        abi: [exports.DepositForBurnEvent],
                                        fromBlock: currentBlockHeight - BigInt(1000),
                                        toBlock: 'latest',
                                    })];
                            case 2:
                                logs = _a.sent();
                                logs.forEach(function (log) {
                                    console.log("Fetched missed Transfer event on ".concat(chainName, ":"), log);
                                });
                                return [3 /*break*/, 4];
                            case 3:
                                error_1 = _a.sent();
                                console.error("Error fetching logs on ".concat(chainName, ":"), error_1);
                                return [3 /*break*/, 4];
                            case 4: return [2 /*return*/];
                        }
                    });
                }); }, 600000); // Poll every 10 minutes
            }
            return [2 /*return*/, unwatch];
        });
    });
}
/**
 * Initializes listeners for multiple blockchain networks.
 *
 * @return A function that stops all listeners across all configured networks.
 */
//   async function startMultiChainListeners() {
//     // Initialise clients
//     const clients = {};
//     const unwatchers = await Promise.all(
//       Object.entries(clients).map(([chainName, client]) =>
//       listen(client, contractAddresses[chainName as keyof typeof contractAddresses], chainName, false)
//       )
//     );
//     console.log('Multi-chain listeners are running!');
//     // Returns a function to stop all listeners by calling each unwatch function
//     return () => unwatchers.forEach((unwatch) => unwatch());
//   }
