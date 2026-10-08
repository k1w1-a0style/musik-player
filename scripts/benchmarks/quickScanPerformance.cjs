/**
 * Runs the actual SAF discovery, revision selection and file workers. Provider
 * I/O is an immediate boundary double: elapsed/heap values describe this host,
 * never Android storage latency, RAM or scrolling. Metadata/stream/cover calls
 * fail the benchmark because an unchanged Quick Scan must not perform them.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { performance } = require('perf_hooks');
const { execFileSync } = require('child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const revision = argument('--revision');
const output = argument('--output');
let entries = [];
let dated = true;
let calls;
const forbidden = name => async () => { calls[name]++; throw new Error(`Unexpected ${name} in unchanged Quick Scan`); };
const systemAudio = {
  readImportFileStat: async () => { calls.providerStat++; return { size: 4_000_000,
    modificationTime: dated ? 1_700_000_000_000 : undefined }; },
  extractAudioInfo: forbidden('audioInfo'), extractEmbeddedArtwork: forbidden('cover'),
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'expo-media-library/legacy') return {};
  if (request === 'expo-system-audio') return { __esModule: true, default: systemAudio, SystemAudio: systemAudio };
  if (request === 'expo-file-system/legacy') return { getInfoAsync: forbidden('stream'),
    StorageAccessFramework: { readDirectoryAsync: async () => { calls.directory++; return entries; } } };
  if (request === './id3Parser') return { parseId3FromUri: forbidden('tags') };
  if (request === './coverCache') return { cacheBase64Cover: forbidden('coverWrite'),
    cacheLocalCoverFile: forbidden('coverWrite'), isBase64ImageDataUri: () => false };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (mod, filename) => {
  const source = revision ? execFileSync('git', ['show', `${revision}:${path.relative(root, filename)}`],
    { cwd: root, encoding: 'utf8' }) : fs.readFileSync(filename, 'utf8');
  mod._compile(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  }, fileName: filename }).outputText, filename);
};
const { scanFromSafFolders } = require(path.join(root, 'utils/mediaLibraryImport.ts'));
const folder = { id: 'bench', name: 'Benchmark', enabled: true, addedAt: 1, uri: 'content://benchmark/tree/music' };
const fixture = count => Array.from({ length: count }, (_, index) => ({ id: `song-${index}`,
  title: `Track ${index}`, artist: 'Benchmark', uri: `content://benchmark/document/song-${index}.mp3`,
  fileInfo: { size: 4_000_000, modificationTime: dated ? 1_700_000_000_000 : undefined,
    importedAt: 1_700_000_100_000 } }));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const run = async songs => {
  calls = { directory: 0, providerStat: 0, stream: 0, tags: 0, audioInfo: 0, cover: 0, coverWrite: 0, checkpoint: 0 };
  let processed = 0;
  const result = await scanFromSafFolders([folder], { existingSongs: songs,
    onCheckpoint: async () => { calls.checkpoint++; }, onFileProgress: progress => { processed = progress.processed; } });
  const expectedUnverified = dated ? 0 : songs.length;
  if (result.songs.length || result.errors.length || result.completed === false || result.reusedCount !== songs.length
    || (result.unverifiedCount ?? 0) !== expectedUnverified || processed !== songs.length
    || Object.entries(calls).some(([name, value]) => !['directory', 'providerStat'].includes(name) && value)) {
    throw new Error(`Quick Scan contract failed: ${JSON.stringify({ result, processed, calls })}`);
  }
  const expectedStatistics = { newCount: 0, changedCount: 0, unchangedCount: dated ? songs.length : 0,
    unverifiedCount: expectedUnverified, duplicateCount: 0, errorCount: 0 };
  if ((!revision && !result.statistics) || (result.statistics && Object.entries(expectedStatistics)
    .some(([name, value]) => result.statistics[name] !== value))) {
    throw new Error(`Quick Scan statistics failed: ${JSON.stringify(result.statistics)}`);
  }
  return { reused: result.reusedCount, unverified: result.unverifiedCount ?? 0, processed, calls: { ...calls },
    ...(result.statistics ? { statistics: result.statistics } : {}) };
};
(async () => {
  const workloads = [];
  for (dated of [true, false]) {
    for (const count of [500, 2000, 5000]) {
      const songs = fixture(count);
      entries = songs.map(song => song.uri);
      await run(songs);
      const samples = [];
      let outcome;
      for (let sample = 0; sample < 3; sample++) {
        const started = performance.now();
        outcome = await run(songs);
        samples.push(+(performance.now() - started).toFixed(3));
      }
      workloads.push({ songs: count, providerDates: dated, hostMsMedian: median(samples), samplesMs: samples, ...outcome });
    }
  }
  const result = { revision: revision ?? 'working-tree', baseCommit: execFileSync('git', ['rev-parse', 'HEAD'],
    { cwd: root, encoding: 'utf8' }).trim(), node: process.version, samples: 3,
    scope: 'Flat SAF folder. Real JS import path; immediate provider boundary doubles. No physical I/O, React commits, Android RAM/jank or device speed claim.', workloads };
  if (output) fs.writeFileSync(path.resolve(root, output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
