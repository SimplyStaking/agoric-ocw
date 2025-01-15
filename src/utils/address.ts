import { decodeAddressHook } from '@agoric/cosmic-proto/address-hooks.js';
import { bech32 } from 'bech32';
import { logger } from './logger';

/**
 * Convert a Bech32 address to a padded hexadecimal format
 * @param address Bech32 address to decode
 * @returns A string containing the address in a padded hexadecimal format
 */
export function encode(address: string): string {
  // Decode the Bech32 address
  const { words } = bech32.decode(address);
  const rawAddress = Buffer.from(bech32.fromWords(words));

  // Pad the address to 32 bytes
  const padded = Buffer.alloc(32);
  padded.set(rawAddress, 32 - rawAddress.length);

  // Convert to hex string with 0x prefix
  return '0x' + padded.toString('hex');
}

/**
 * Convert the padded hexadecimal format back to a noble Bech32 address
 * @param address the padded hexadecimal format address
 * @returns A string containing the address in a noble Bech32 address
 */
export function decodeToNoble(encodedAddress: string): string {
  // Remove the '0x' prefix
  const hexString = encodedAddress.startsWith('0x') ? encodedAddress.slice(2) : encodedAddress;

  // Convert hex string back to bytes
  const decoded = Buffer.from(hexString, 'hex');

  // Find the first non-zero byte to strip leading padding
  let nonZeroIndex = 0;
  while (nonZeroIndex < decoded.length && decoded[nonZeroIndex] === 0) {
    nonZeroIndex++;
  }
  const rawAddress = decoded.slice(nonZeroIndex);

  // Re-encode as Bech32
  const words = bech32.toWords(rawAddress);
  return bech32.encode('noble', words);
}