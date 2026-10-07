// Runs before React Native codegen; all patched upstream boundaries are pinned.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_VERSION = '5.12.1';
const plan = require('./rntp-v5/patches.json');
const digest = source => crypto.createHash('sha256').update(source).digest('hex');

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0 || source.indexOf(from, index + from.length) >= 0) {
    throw new Error(`${label}: upstream patch boundary is missing or ambiguous.`);
  }
  return source.slice(0, index) + to + source.slice(index + from.length);
}

function prepareFile(packageDir, entry) {
  const filename = path.join(packageDir, entry.path);
  const original = fs.readFileSync(filename, 'utf8');
  if (digest(original) === entry.patchedSha256) return null;
  if (digest(original) !== entry.upstreamSha256) {
    throw new Error(`${entry.path}: unsupported upstream source; review the pinned patch before upgrading.`);
  }
  const source = entry.edits.reduce(
    (current, edit) => replaceOnce(current, edit.from, edit.to, entry.path),
    original,
  );
  if (digest(source) !== entry.patchedSha256) {
    throw new Error(`${entry.path}: patched source checksum does not match.`);
  }
  return { filename, source };
}

function patchPackage(packageDir) {
  const metadata = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  if (metadata.name !== '@rntp/player' || metadata.version !== SUPPORTED_VERSION) {
    throw new Error(`Expected @rntp/player@${SUPPORTED_VERSION}; found ${metadata.name}@${metadata.version}.`);
  }
  // Verify every upstream file before touching any source. A partial or unknown
  // install must fail installation rather than silently lose native guarantees.
  const writes = plan.map(entry => prepareFile(packageDir, entry)).filter(Boolean);
  writes.forEach(({ filename, source }) => fs.writeFileSync(filename, source, 'utf8'));
  const testDir = path.join(packageDir, 'android', 'src', 'test', 'java', 'com', 'doublesymmetry', 'trackplayer');
  fs.mkdirSync(testDir, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, 'rntp-v5', 'tests', 'ControllerAcknowledgementTest.kt'),
    path.join(testDir, 'ControllerAcknowledgementTest.kt'),
  );
  return writes.length;
}

module.exports = { SUPPORTED_VERSION, patchPackage, replaceOnce, digest, plan };

if (require.main === module) {
  try {
    const packageDir = process.argv[2] || path.join(__dirname, '..', '..', 'node_modules', '@rntp', 'player');
    const patched = patchPackage(packageDir);
    console.log(`[patch-rntp-v5] Verified @rntp/player@${SUPPORTED_VERSION}; ${patched} source files patched.`);
  } catch (error) {
    console.error(`[patch-rntp-v5] ${error.message}`);
    process.exitCode = 1;
  }
}
