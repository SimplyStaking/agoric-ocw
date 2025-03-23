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

  // Extract the last 20 bytes (this is the actual address)
  const addressBytes = Buffer.allocUnsafe(20);
  decoded.copy(addressBytes, 0, decoded.length - 20);

  // Convert to bech32 words
  const words = bech32.toWords(addressBytes);

  // Convert to bech32 address
  return bech32.encode('noble', words);
}