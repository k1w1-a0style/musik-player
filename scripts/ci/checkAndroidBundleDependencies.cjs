#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// These packages are allowed only in build tooling, never in the player bundle.
const TOOL_ONLY_PACKAGES = new Set(['braces', 'micromatch', 'node-forge', 'sprintf-js']);

const sourceEntries = (map) => {
  if (!map || map.version !== 3) throw new Error('Expected a version 3 source map.');
  if (Array.isArray(map.sections)) {
    return map.sections.flatMap(section => sourceEntries(section.map));
  }
  if (!Array.isArray(map.sources) || !map.sources.every(source => typeof source === 'string')) {
    throw new Error('Source map sources must be an array of strings.');
  }
  return map.sources;
};

const evaluateSourceMap = (map) => {
  const sources = sourceEntries(map);
  if (sources.length === 0) throw new Error('Source map contains no sources; dependency boundary is unverified.');
  const blocked = new Set();
  for (const source of sources) {
    const segments = source.replaceAll('\\', '/').split('/');
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (segments[index] === 'node_modules' && TOOL_ONLY_PACKAGES.has(segments[index + 1])) {
        blocked.add(segments[index + 1]);
      }
    }
  }
  return { sourceCount: sources.length, blocked: [...blocked].sort() };
};

const findSourceMaps = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const filename = path.join(directory, entry.name);
  if (entry.isDirectory()) return findSourceMaps(filename);
  return entry.isFile() && entry.name.endsWith('.map') ? [filename] : [];
});

const checkExportDirectory = (directory) => {
  const files = findSourceMaps(directory);
  if (files.length === 0) throw new Error('Android export contains no source maps. Export with --source-maps.');
  let sourceCount = 0;
  for (const filename of files) {
    const result = evaluateSourceMap(JSON.parse(fs.readFileSync(filename, 'utf8')));
    if (result.blocked.length > 0) {
      throw new Error(`Build-only dependencies entered the Android bundle: ${result.blocked.join(', ')}`);
    }
    sourceCount += result.sourceCount;
  }
  return { mapCount: files.length, sourceCount };
};

if (require.main === module) {
  try {
    const result = checkExportDirectory(process.argv[2] || 'ci-android-export');
    console.log(`Android bundle dependency boundary passed: ${result.mapCount} maps, ${result.sourceCount} sources.`);
  } catch (error) {
    console.error(`Android bundle dependency boundary failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { evaluateSourceMap, checkExportDirectory };
