/**
 * Actual import bookkeeping seams at a fixed logical clock. Native metadata,
 * cover/file I/O, React rendering and physical storage are excluded. Checkpoint
 * acknowledgements use a boundary double; durability has real-storage tests.
 * These host CPU/heap values are not Android import-time/RAM/jank measurements.
 * node --expose-gc scripts/benchmarks/importPerformance.cjs --revision 8ca07752 --output docs/review/auftrag-2-a1-before.json
 * node --expose-gc scripts/benchmarks/importPerformance.cjs --output docs/review/auftrag-2-a1-after.json
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { performance } = require('perf_hooks');
const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const root = path.resolve(__dirname, '../..');
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const revision = argument('--revision');
const outputPath = argument('--output');
const sourceAt = filename => revision
  ? execFileSync('git', ['show', `${revision}:${path.relative(root, filename).split(path.sep).join('/')}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  : fs.readFileSync(filename, 'utf8');
const ts = require(path.join(root, 'node_modules/typescript'));
const originalLoad = Module._load;
require.extensions['.png'] = mod => { mod.exports = 0; };
Module._load = function(request, parent, isMain) {
  if (request.endsWith('/mediaLibraryImport')) return { deriveFolderNameFromUri: () => '' };
  if (request.endsWith('/songCoverProtectionLifecycle')) return { protectAcceptedSongCovers: () => {} };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (mod, filename) => {
  const code = ts.transpileModule(sourceAt(filename), { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, esModuleInterop: true }, fileName: filename }).outputText;
  mod._compile(code, filename);
};
const { createImportCheckpointReporter } = require(path.join(root, 'utils/libraryImportCheckpoint.ts'));
const { createImportProgressCallbacks } = require(path.join(root, 'utils/libraryImportProgressCallbacks.ts'));
const { createImportSongReconciler } = require(path.join(root, 'utils/libraryImportReconciliation.ts'));
const { buildImportedSongsUpdate } = require(path.join(root, 'utils/libraryImportFlow.ts'));
const newState = revision ? null : require(path.join(root, 'contexts/songLibraryState.ts')).createSongLibraryState;
const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const fixture = count => Array.from({ length: count }, (_, index) => ({ id: `bench-${index}`,
  title: `${['Äther', 'Żółw', 'Bass', 'Alpha'][index % 4]} ${String((index * 7919) % count).padStart(5, '0')}`,
  artist: 'Benchmark', album: `Album ${index % 20}`, uri: `file:///music/track-${index}.mp3`, duration: 180000,
  fileInfo: { filename: `track-${index}.mp3`, size: 4000000, modificationTime: 1700000000000 + index, contentHash: String(index) } }));
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const run = async songs => {
  let current = [];
  let publications = 0;
  let acknowledgements = 0;
  const generation = { controller: new AbortController() };
  const state = newState?.();
  if (state) {
    state.configurePersistence(async read => { acknowledgements++; return read(); });
    state.subscribe(() => { publications++; });
  }
  const reconcile = createImportSongReconciler([]);
  const callbacks = createImportProgressCallbacks({ songs: [], signal: generation.controller.signal,
    activity: () => {}, onFileProgress: () => {},
    onApply: state ? update => state.commitImport(update, generation) : update => {
      current = reconcile(current, update.importedSongs); publications++; return current;
    }, onPublish: () => state?.publishImport() });
  const reporter = createImportCheckpointReporter(callbacks.onCheckpoint, generation.controller.signal);
  for (let index = 0; index < songs.length; index++) await reporter.add(songs[index], index + 1, songs.length);
  await reporter.flush(songs.length, songs.length);
  callbacks.close();
  // Production flows perform one final-result replay. Keep that work in both
  // versions and assert that it cannot change the already-confirmed outcome.
  const final = buildImportedSongsUpdate(callbacks.getSongs(), songs, []);
  if (state) { await state.commitImport(final, generation); state.publishImport(); current = state.getSnapshot(); }
  else { current = reconcile(current, final.importedSongs); publications++; }
  return { publications, acknowledgements, finalSongs: current.length,
    checksum: createHash('sha256').update(canonical(current)).digest('hex') };
};
(async () => {
  const realNow = Date.now;
  Date.now = () => 0;
  const workloads = [];
  for (const count of [500, 2000, 5000]) {
    const songs = fixture(count);
    await run(songs); // Warm up transformed modules and hot functions.
    const times = [];
    const heaps = [];
    let outcome;
    for (let repeat = 0; repeat < 3; repeat++) {
      global.gc?.();
      const heapBefore = process.memoryUsage().heapUsed;
      const started = performance.now();
      outcome = await run(songs);
      times.push(performance.now() - started);
      heaps.push(process.memoryUsage().heapUsed - heapBefore);
    }
    workloads.push({ songs: count, bookkeepingMsMedian: +median(times).toFixed(3),
      samplesMs: times.map(value => +value.toFixed(3)), transientHostHeapDeltaBytesMedian: median(heaps), ...outcome });
  }
  Date.now = realNow;
  const result = { source: { revision: revision ?? 'working-tree', baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() },
    node: process.version, samples: 3,
    fixture: 'New tracks, multilingual titles; first checkpoint then batches; logical clock fixed at 0 to measure burst-count cadence. Physical I/O, React commits and Android RAM/scroll are excluded.',
    workloads };
  if (outputPath) fs.writeFileSync(path.resolve(root, outputPath), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
