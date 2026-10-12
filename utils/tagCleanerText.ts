/** Strict decoders: never turn malformed bytes into writable replacement text. */
export const decodeCleanerUtf8 = (bytes: Uint8Array): string => {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const text = decoder.decode(bytes);
  if (text.includes('\ufffd')) throw new Error('Ungültiger UTF-8-Text.');
  return text;
};
const validSurrogates = (text: string): boolean => {
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
};
export const decodeCleanerUtf16 = (bytes: Uint8Array, little: boolean): string => {
  if (bytes.length % 2) throw new Error('Abgeschnittener UTF-16-Text.');
  let value = '';
  for (let i = 0; i < bytes.length; i += 2) {
    value += String.fromCharCode(little ? bytes[i] + bytes[i + 1] * 256 : bytes[i] * 256 + bytes[i + 1]);
  }
  if (!validSurrogates(value)) throw new Error('Ungültiger UTF-16-Text.');
  return value;
};
export const decodeCleanerId3Text = (body: Uint8Array): string => {
  const encoding = body[0];
  let bytes = body.subarray(1);
  let value: string;
  if (encoding === 0) value = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  else if (encoding === 3) value = decodeCleanerUtf8(bytes);
  else if (encoding === 2) value = decodeCleanerUtf16(bytes, false);
  else {
    if (encoding !== 1 || bytes.length < 2) throw new Error('Unbekannte ID3-Textcodierung.');
    const little = bytes[0] === 255 && bytes[1] === 254;
    const big = bytes[0] === 254 && bytes[1] === 255;
    if (!little && !big) throw new Error('UTF-16 ohne BOM.');
    bytes = bytes.subarray(2);
    value = decodeCleanerUtf16(bytes, little);
  }
  return value.replace(/\0+$/, '');
};
