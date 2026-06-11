import {
  Base64DecodeError,
  decodeBase64PrefixToBytes,
  decodeBase64ToBytes,
  encodeBytesToBase64,
  getBase64DecodedByteLength,
  getBase64DecodedByteLengthEstimate,
  validateBase64Payload,
} from '../base64';

const originalAtob = globalThis.atob;
const originalBtoa = globalThis.btoa;

afterEach(() => {
  Object.defineProperty(globalThis, 'atob', { configurable: true, writable: true, value: originalAtob });
  Object.defineProperty(globalThis, 'btoa', { configurable: true, writable: true, value: originalBtoa });
});

test('decodes valid base64', () => {
  expect(Array.from(decodeBase64ToBytes('Y292ZXI='))).toEqual([99, 111, 118, 101, 114]);
});

test('normalizes and measures valid base64 without decoding full payload', () => {
  expect(validateBase64Payload(' Y292\nZXI= ')).toBe('Y292ZXI=');
  expect(getBase64DecodedByteLength(' Y292\nZXI= ')).toBe(5);
  expect(getBase64DecodedByteLengthEstimate('Y292ZXI=')).toBe(5);
});

test('decodes only the requested base64 prefix', () => {
  expect(Array.from(decodeBase64PrefixToBytes('Y292ZXItbG9uZ2VyLXBheWxvYWQ=', 5))).toEqual([99, 111, 118, 101, 114]);
});

test('rejects empty base64', () => {
  expect(() => decodeBase64ToBytes('  ')).toThrow(Base64DecodeError);
});

test('rejects invalid base64 without runtime crashes', () => {
  expect(() => decodeBase64ToBytes('abc')).toThrow(Base64DecodeError);
  expect(() => decodeBase64ToBytes('abcd$===')).toThrow(Base64DecodeError);
});

test('decodes without global Buffer or atob', () => {
  Object.defineProperty(globalThis, 'atob', { configurable: true, writable: true, value: undefined });
  expect(Array.from(decodeBase64ToBytes('cG5n'))).toEqual([112, 110, 103]);
});

test('encodes without global btoa', () => {
  Object.defineProperty(globalThis, 'btoa', { configurable: true, writable: true, value: undefined });
  expect(encodeBytesToBase64(new Uint8Array([112, 110, 103]))).toBe('cG5n');
});
