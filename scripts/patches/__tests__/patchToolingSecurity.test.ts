import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patchTooling, verifyTooling } = require('../patchToolingSecurity.cjs') as {
  patchTooling: (directory: string) => number;
  verifyTooling: (directory: string) => string[];
};

const root = path.resolve(__dirname, '..', '..', '..');
const nodes = path.join(root, 'node_modules');
let temporary: string;
beforeEach(() => { temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'verified-tooling-')); });
afterEach(() => { fs.rmSync(temporary, { recursive: true, force: true }); });
function copyPackages() {
  for (const name of ['node-forge', 'braces']) fs.cpSync(path.join(nodes, name), path.join(temporary, name), { recursive: true });
}

describe('exact installed tooling patches', () => {
  it('passes the independent Node/OpenSSL signer and DER corpus on all three Forge entry points', () => {
    const result = JSON.parse(execFileSync(process.execPath,
      [path.join(__dirname, '..', 'tooling-security', 'regressionCases.cjs')], { cwd: root }).toString()) as { name: string; passed: boolean; message?: string }[];
    expect(result).toHaveLength(142);
    expect(result.filter(row => !row.passed)).toEqual([]);
  });

  it('is idempotent for the verified installed payload', () => {
    expect(patchTooling(nodes)).toBe(0);
    expect(verifyTooling(nodes)).toEqual(['node-forge@1.4.0', 'braces@3.0.3']);
  });

  it.each(['braces/lib/compile', 'braces/lib/assert-depth', 'node-forge/lib/rsa'])('rejects extensionless require shadowing: %s', filename => {
    copyPackages();
    fs.writeFileSync(path.join(temporary, filename), 'module.exports = () => true;');
    expect(() => patchTooling(temporary)).toThrow(/unexpected package file/);
    expect(() => verifyTooling(temporary)).toThrow(/unexpected package file/);
  });

  it('rejects a modified payload file before writing any package', () => {
    copyPackages();
    fs.appendFileSync(path.join(temporary, 'node-forge', 'lib', 'rsa.js'), '\n// unexpected\n');
    expect(() => patchTooling(temporary)).toThrow(/unsupported source fingerprint/);
  });

  it('rejects a missing distributed entry point', () => {
    copyPackages();
    fs.unlinkSync(path.join(temporary, 'node-forge', 'dist', 'forge.all.min.js'));
    expect(() => verifyTooling(temporary)).toThrow(/required package file is missing/);
  });

  it('rejects package symlinks and version drift', () => {
    copyPackages();
    fs.symlinkSync(path.join(temporary, 'braces', 'lib', 'compile.js'), path.join(temporary, 'braces', 'shadow'));
    expect(() => patchTooling(temporary)).toThrow(/symlinks are unsupported/);
    fs.unlinkSync(path.join(temporary, 'braces', 'shadow'));
    const filename = path.join(temporary, 'braces', 'package.json');
    const metadata = JSON.parse(fs.readFileSync(filename, 'utf8'));
    metadata.version = '3.0.4';
    fs.writeFileSync(filename, JSON.stringify(metadata));
    expect(() => patchTooling(temporary)).toThrow(/unsupported package version/);
  });
});
