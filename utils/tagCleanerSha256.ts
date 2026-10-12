import { DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES } from './tagWriterLimits';
import type { CleanerReadAdapter } from './tagCleanerReadTypes';
import { cleanerReadAdapter } from './tagCleanerRead';
import { withTimeout } from './withTimeout';
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotate = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
const compress = (state: Uint32Array, bytes: Uint8Array): void => {
  const words = new Uint32Array(64);
  for (let i = 0; i < 16; i += 1) words[i] = ((bytes[i*4]<<24) | (bytes[i*4+1]<<16) | (bytes[i*4+2]<<8) | bytes[i*4+3]) >>> 0;
  for (let i = 16; i < 64; i += 1) {
    const x = words[i-15], y = words[i-2];
    const s0 = rotate(x,7) ^ rotate(x,18) ^ (x>>>3);
    const s1 = rotate(y,17) ^ rotate(y,19) ^ (y>>>10);
    words[i] = (words[i-16] + s0 + words[i-7] + s1) >>> 0;
  }
  let [a,b,c,d,e,f,g,h] = state;
  for (let i = 0; i < 64; i += 1) {
    const s1 = rotate(e,6) ^ rotate(e,11) ^ rotate(e,25);
    const choice = (e&f) ^ (~e&g);
    const t1 = (h+s1+choice+K[i]+words[i]) >>> 0;
    const s0 = rotate(a,2) ^ rotate(a,13) ^ rotate(a,22);
    const t2 = (s0+((a&b)^(a&c)^(b&c))) >>> 0;
    h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  [a,b,c,d,e,f,g,h].forEach((word,i) => {state[i]=(state[i]+word)>>>0;});
};
export const createCleanerSha256 = () => {
  const state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const block = new Uint8Array(64);
  let buffered = 0, total = 0, finished = false;
  const update = (bytes: Uint8Array): void => {
    if (finished) throw new Error('SHA-256 bereits abgeschlossen.');
    total += bytes.length;
    for (const byte of bytes) {
      block[buffered++] = byte;
      if (buffered === 64) { compress(state,block); buffered=0; }
    }
  };
  const digest = (): string => {
    if (finished) throw new Error('SHA-256 bereits abgeschlossen.');
    const bits = total * 8;
    const padding = new Uint8Array(buffered < 56 ? 64-buffered : 128-buffered);
    padding[0] = 128;
    const view = new DataView(padding.buffer);
    view.setUint32(padding.length-8, Math.floor(bits/4294967296));
    view.setUint32(padding.length-4, bits>>>0);
    update(padding); finished=true;
    return Array.from(state, word => word.toString(16).padStart(8,'0')).join('');
  };
  return { update, digest };
};
export const hashCleanerSource = async (uri: string, adapter: CleanerReadAdapter = cleanerReadAdapter): Promise<{ size: number; sha256: string; modificationTime?: number }> => {
  const before = await withTimeout(adapter.info(uri), 10000, 'Quellgröße nicht bestätigt.');
  const size = before.size;
  if (!before.exists || before.isDirectory || !Number.isSafeInteger(size) || size! < 1 || size! > DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES)
    throw new Error('Quelle nicht innerhalb des 50-MiB-Schreiblimits bestätigt.');
  const hash = createCleanerSha256();
  for (let position = 0; position < size!; position += 65536) {
    const length = Math.min(65536, size! - position);
    const bytes = await withTimeout(adapter.range(uri, position, length), 10000, 'SHA-256-Quellread nicht bestätigt.');
    if (bytes.length !== length) throw new Error('Provider bestätigte SHA-256-Lesebereich nicht.');
    hash.update(bytes);
    // Yield between bounded chunks so playback/UI remain responsive.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const after = await withTimeout(adapter.info(uri), 10000, 'Quellgröße nach SHA-256 nicht bestätigt.');
  if (!after.exists || after.size !== size || after.modificationTime !== before.modificationTime)
    throw new Error('Quelle während SHA-256 geändert.');
  return { size: size!, sha256: hash.digest(), modificationTime: after.modificationTime };
};
