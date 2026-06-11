const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Int16Array(256).fill(-1);
for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
  BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(i)] = i;
}

export class Base64DecodeError extends Error {
  constructor(message = 'Invalid base64 data.') {
    super(message);
    this.name = 'Base64DecodeError';
  }
}

const normalizeBase64 = (value: string): string => value.replace(/\s+/g, '');

const validateBase64 = (value: string): string => {
  const normalized = normalizeBase64(value);
  if (normalized.length === 0) throw new Base64DecodeError('Base64 data is empty.');
  if (normalized.length % 4 !== 0) throw new Base64DecodeError('Invalid base64 length.');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Base64DecodeError('Invalid base64 character.');
  }
  const firstPadding = normalized.indexOf('=');
  if (firstPadding !== -1 && firstPadding < normalized.length - (normalized.endsWith('==') ? 2 : 1)) {
    throw new Base64DecodeError('Invalid base64 padding.');
  }
  return normalized;
};

const decodeBase64Manually = (normalized: string): Uint8Array => {
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((normalized.length / 4) * 3 - padding);
  let outIndex = 0;
  for (let i = 0; i < normalized.length; i += 4) {
    const c0 = BASE64_LOOKUP[normalized.charCodeAt(i)];
    const c1 = BASE64_LOOKUP[normalized.charCodeAt(i + 1)];
    const c2 = normalized[i + 2] === '=' ? 0 : BASE64_LOOKUP[normalized.charCodeAt(i + 2)];
    const c3 = normalized[i + 3] === '=' ? 0 : BASE64_LOOKUP[normalized.charCodeAt(i + 3)];
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) throw new Base64DecodeError('Invalid base64 character.');
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIndex < out.length) out[outIndex] = (triple >> 16) & 0xff;
    outIndex += 1;
    if (outIndex < out.length) out[outIndex] = (triple >> 8) & 0xff;
    outIndex += 1;
    if (outIndex < out.length) out[outIndex] = triple & 0xff;
    outIndex += 1;
  }
  return out;
};

export const decodeBase64ToBytes = (value: string): Uint8Array => {
  const normalized = validateBase64(value);
  const atobFn = globalThis.atob;
  if (typeof atobFn === 'function') {
    try {
      const binary = atobFn(normalized);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i) & 0xff;
      return out;
    } catch (error) {
      throw new Base64DecodeError(error instanceof Error ? error.message : 'Invalid base64 data.');
    }
  }
  return decodeBase64Manually(normalized);
};

export const encodeBytesToBase64 = (bytes: Uint8Array): string => {
  const btoaFn = globalThis.btoa;
  if (typeof btoaFn === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoaFn(binary);
  }

  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }
  return out;
};
