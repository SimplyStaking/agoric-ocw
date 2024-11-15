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