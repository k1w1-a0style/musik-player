'use strict';
const fs = require('fs');
const path = require('path');
const { digest, verifyPackage } = require('./tooling-security/packageIntegrity.cjs');
const plan = require('./tooling-security/patches.json');
const { replaceOnce } = require('./patchRntpV5.cjs');

function preparePatch(packageDir, patch) {
  const filename = path.join(packageDir, patch.path);
  if (fs.existsSync(filename) && digest(fs.readFileSync(filename)) === patch.patchedSha256) return null;
  let source = patch.upstreamSha256 === null ? '' : fs.readFileSync(filename, 'utf8');
  for (const edit of patch.edits) source = edit.from === null ? edit.to : replaceOnce(source, edit.from, edit.to, patch.path);
  if (digest(source) !== patch.patchedSha256) throw new Error(`${patch.path}: patched checksum mismatch`);
  return { filename, source };
}

function patchTooling(nodeModulesDir) {
  // Verify all payload files, including extensionless require() shadow files,
  // before the first write. Known old and known patched installs are accepted.
  for (const entry of plan.packages) verifyPackage(path.join(nodeModulesDir, entry.name), entry);
  const writes = plan.packages.flatMap(entry => entry.patches
    .map(patch => preparePatch(path.join(nodeModulesDir, entry.name), patch)).filter(Boolean));
  for (const { filename, source } of writes) fs.writeFileSync(filename, source, 'utf8');
  verifyTooling(nodeModulesDir);
  return writes.length;
}

function verifyTooling(nodeModulesDir) {
  for (const entry of plan.packages) verifyPackage(path.join(nodeModulesDir, entry.name), entry, true);
  return plan.packages.map(entry => `${entry.name}@${entry.version}`);
}

module.exports = { patchTooling, verifyTooling, plan };
if (require.main === module) {
  try {
    const nodeModulesDir = process.argv[2] || path.join(__dirname, '..', '..', 'node_modules');
    console.log(`[patch-tooling-security] Verified bounded braces AST and canonical Forge DigestInfo; ${patchTooling(nodeModulesDir)} files patched.`);
  } catch (error) {
    console.error(`[patch-tooling-security] ${error.message}`);
    process.exitCode = 1;
  }
}
