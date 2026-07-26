import fs from 'fs';
import os from 'os';
import path from 'path';

const script = path.join(__dirname, '..', 'checkSourceNulBytes.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findNulByteOffsets, scanSourceNulBytes } = require(script) as {
  findNulByteOffsets: (buffer: Buffer) => number[];
  scanSourceNulBytes: (root: string) => Array<{ file: string; offsets: number[] }>;
};

describe('source NUL-byte gate', () => {
  test('distinguishes a literal escape sequence from an actual NUL byte', () => {
    expect(findNulByteOffsets(Buffer.from("'\\u0000'", 'utf8'))).toEqual([]);
    expect(findNulByteOffsets(Buffer.from([0x41, 0x00, 0x42]))).toEqual([1]);
  });

  test('reports NUL bytes in nested Android source and ignores dependency directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-nul-gate-'));
    try {
      fs.writeFileSync(path.join(root, 'valid.ts'), "export const marker = '\\u0000';\n");
      fs.mkdirSync(path.join(root, 'modules', 'example', 'android', 'src', 'main'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'modules', 'example', 'android', 'src', 'main', 'Broken.kt'),
        Buffer.from([0x61, 0x00, 0x62]),
      );
      fs.mkdirSync(path.join(root, 'node_modules'));
      fs.writeFileSync(path.join(root, 'node_modules', 'ignored.js'), Buffer.from([0x00]));

      expect(scanSourceNulBytes(root)).toEqual([
        { file: path.join('modules', 'example', 'android', 'src', 'main', 'Broken.kt'), offsets: [1] },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
