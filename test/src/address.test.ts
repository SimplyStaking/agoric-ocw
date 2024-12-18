import { encode, decodeToNoble } from '../../src/utils/address';

describe('encode and decode functions', () => {
  const bech32Address = "noble14lwerrcfzkzrv626w49pkzgna4dtga8c5x479h";
  const expectedHexAddress = '0x000000000000000000000000afdd918f09158436695a754a1b0913ed5ab474f8';

  test('encode should convert a Bech32 address to padded hexadecimal format', () => {
    const result = encode(bech32Address);
    expect(result).toBe(expectedHexAddress);
  });

  test('decode should convert a padded hexadecimal format back to the original Bech32 address', () => {
    const result = decodeToNoble(expectedHexAddress);
    expect(result).toBe(bech32Address);
  });

  test('decode(encode(address)) should return the original Bech32 address', () => {
    const encoded = encode(bech32Address);
    const decoded = decodeToNoble(encoded);
    expect(decoded).toBe(bech32Address);
  });

  test('encode(decode(hex)) should return the original hex address', () => {
    const decoded = decodeToNoble(expectedHexAddress);
    const reEncoded = encode(decoded);
    expect(reEncoded).toBe(expectedHexAddress);
  });
});
