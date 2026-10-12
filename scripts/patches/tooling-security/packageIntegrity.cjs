'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const digest = source => crypto.createHash('sha256').update(source).digest('hex');

function inventory(packageDir) {
  const files = {};
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(packageDir, relative), { withFileTypes: true })) {
      const filename = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`${filename}: package symlinks are unsupported`);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile()) files[filename.split(path.sep).join('/')] = digest(fs.readFileSync(path.join(packageDir, filename)));
      else throw new Error(`${filename}: unexpected package entry`);
    }
  }
  visit('');
  return files;
}

function verifyPackage(packageDir, plan, patchedOnly = false) {
  const metadata = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  if (metadata.name !== plan.name || metadata.version !== plan.version) {
    throw new Error(`${plan.name}: unsupported package version ${metadata.version}`);
  }
  const files = inventory(packageDir);
  const expected = { ...plan.upstreamFiles };
  for (const patch of plan.patches) expected[patch.path] = patch.patchedSha256;
  for (const filename of Object.keys(files)) {
    if (!Object.hasOwn(expected, filename)) throw new Error(`${plan.name}/${filename}: unexpected package file`);
    const accepted = [expected[filename]];
    if (!patchedOnly && Object.hasOwn(plan.upstreamFiles, filename)) accepted.push(plan.upstreamFiles[filename]);
    if (!accepted.includes(files[filename])) throw new Error(`${plan.name}/${filename}: unsupported source fingerprint`);
  }
  for (const filename of Object.keys(expected)) {
    if (!files[filename] && (patchedOnly || Object.hasOwn(plan.upstreamFiles, filename))) {
      throw new Error(`${plan.name}/${filename}: required package file is missing`);
    }
  }
  return files;
}

module.exports = { digest, inventory, verifyPackage };
