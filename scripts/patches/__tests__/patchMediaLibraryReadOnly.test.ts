import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const script = path.resolve(__dirname, '../patchMediaLibraryReadOnly.cjs');
const plan = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../media-library-read-only.json'), 'utf8'));
const installed = path.resolve(__dirname, '../../../node_modules/expo-media-library');
const helper = 'android/src/main/java/expo/modules/medialibrary/AudioReadPermissionPolicy.kt';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const roots: string[] = [];
const fixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-read-patch-')); roots.push(root);
  let source = fs.readFileSync(path.join(installed, plan.path), 'utf8');
  if (hash(source) === plan.patchedSha256) source = source.replace(plan.to, plan.from);
  if (hash(source) !== plan.upstreamSha256) throw new Error('Fixture source is not verified upstream.');
  fs.mkdirSync(path.dirname(path.join(root, plan.path)), { recursive: true });
  fs.writeFileSync(path.join(root, plan.path), source);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'expo-media-library', version: plan.version }));
  return root;
};
const run = (root: string) => execFileSync(process.execPath, [script, root], { encoding: 'utf8', stdio: 'pipe' });
test('builds patched MediaLibrary from source instead of the unpatched Maven publication', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'));
  expect(config.expo.autolinking?.android?.buildFromSource).toContain('expo-media-library');
});
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

test('patches verified native read guard, installs the tested helper and is idempotent', () => {
  const root = fixture();
  const before = fs.readFileSync(path.join(root, plan.path), 'utf8');
  expect(before).toContain('arrayOf(READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE)');
  expect(run(root)).toContain('1 source files patched');
  const patched = fs.readFileSync(path.join(root, plan.path), 'utf8');
  expect(hash(patched)).toBe(plan.patchedSha256);
  expect(patched).toContain('AudioReadPermissionPolicy.isMissing(Build.VERSION.SDK_INT)');
  expect(patched.replace(plan.to, plan.from)).toBe(before); // All write guards and query code remain exact upstream.
  expect(hash(fs.readFileSync(path.join(root, helper), 'utf8'))).toBe(plan.helperSha256);
  expect(run(root)).toContain('0 source files patched');
});

test.each(['version', 'source', 'installed-helper'])('rejects %s drift before changing the module', drift => {
  const root = fixture();
  if (drift === 'version') fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'expo-media-library', version: '57.0.6' }));
  if (drift === 'source') fs.appendFileSync(path.join(root, plan.path), '\n// unknown drift\n');
  if (drift === 'installed-helper') fs.writeFileSync(path.join(root, helper), '// unverified helper\n');
  const before = fs.readFileSync(path.join(root, plan.path), 'utf8');
  expect(() => run(root)).toThrow();
  expect(fs.readFileSync(path.join(root, plan.path), 'utf8')).toBe(before);
});
