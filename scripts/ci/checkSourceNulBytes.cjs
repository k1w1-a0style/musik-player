#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_EXTENSIONS = new Set([
  '.cjs', '.css', '.gradle', '.html', '.java', '.js', '.json', '.kt', '.kts',
  '.md', '.mjs', '.properties', '.sh', '.ts', '.tsx', '.xml', '.yaml', '.yml',
]);
const SOURCE_FILENAMES = new Set(['Dockerfile', 'Gemfile', 'Podfile']);
const SKIPPED_DIRECTORIES = new Set([
  '.git', '.gradle', '.idea', '.expo', 'android', 'artifacts', 'build', 'coverage',
  'dist', 'node_modules', 'vendor',
]);

const isSourceFile = filePath => {
  const basename = path.basename(filePath);
  return SOURCE_FILENAMES.has(basename) || SOURCE_EXTENSIONS.has(path.extname(basename).toLowerCase());
};

const collectSourceFiles = root => {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) visit(absolute);
        continue;
      }
      if (entry.isFile() && isSourceFile(absolute)) files.push(absolute);
    }
  };
  visit(root);
  return files.sort();
};

const findNulByteOffsets = buffer => {
  const offsets = [];
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) offsets.push(index);
  }
  return offsets;
};

const scanSourceNulBytes = root => collectSourceFiles(root).flatMap(file => {
  const offsets = findNulByteOffsets(fs.readFileSync(file));
  return offsets.length > 0 ? [{ file: path.relative(root, file), offsets }] : [];
});

const main = () => {
  const root = path.resolve(process.argv[2] || '.');
  const findings = scanSourceNulBytes(root);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`Forbidden NUL byte in ${finding.file} at byte offset(s): ${finding.offsets.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(`Source NUL-byte gate passed (${collectSourceFiles(root).length} text source files scanned).`);
};

if (require.main === module) main();

module.exports = {
  collectSourceFiles,
  findNulByteOffsets,
  isSourceFile,
  scanSourceNulBytes,
};
