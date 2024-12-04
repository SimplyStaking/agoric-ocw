#!/usr/bin/env tsx
import { encode } from "../src/utils/address";

// Get address from command line argument
const address = process.argv[2];

if (!address) {
  console.error('Usage: npx ts-node script.ts <bech32-address>');
  process.exit(1);
}

// Output only the encoded result
console.log(encode(address));