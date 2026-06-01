export const textEncoder = new TextEncoder();

export const readU32 = (b: Uint8Array, o: number): number =>
  ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

export const writeU32 = (b: Uint8Array, o: number, value: number): void => {
  b[o] = (value >>> 24) & 0xff;
  b[o + 1] = (value >>> 16) & 0xff;
  b[o + 2] = (value >>> 8) & 0xff;
  b[o + 3] = value & 0xff;
};

export const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

export const areBytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);
