/**
 * Measures actual synchronous waveform/index/cache seams under Node. React
 * effects and native I/O are isolated; these are neither React commit timings
 * nor Android decoder/RAM/scroll measurements. Payload and bridge bytes are
 * calculated from the real serializers. Medians vary with host contention.
 *
 * node scripts/benchmarks/waveformPerformance.cjs --revision dad2af1d --output docs/review/auftrag-2-waveform-before.json
 * node scripts/benchmarks/waveformPerformance.cjs --output docs/review/auftrag-2-waveform-after.json
 * Use the repository's Node version (currently 22) for comparable runs.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { performance } = require('perf_hooks');
const root = path.resolve(__dirname, '../..');
const { execFileSync } = require('child_process');
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const revision = argument('--revision');
const outputPath = argument('--output');
const sourceAt = filename => revision
  ? execFileSync('git', ['show', `${revision}:${path.relative(root, filename).split(path.sep).join('/')}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  : fs.readFileSync(filename, 'utf8');
const hasSource = filename => {
  if (!revision) return fs.existsSync(filename);
  try { execFileSync('git', ['cat-file', '-e', `${revision}:${path.relative(root, filename).split(path.sep).join('/')}`], { cwd: root, stdio: 'ignore' }); return true; }
  catch { return false; }
};
const ts = require(path.join(root, 'node_modules/typescript'));
const store = new Map(); const files = new Map();
const io = { manifestWrites: 0, manifestBytes: 0, fileReads: 0, fileWrites: 0 };
const asyncStorage = {
  getItem: async key => store.get(key) ?? null,
  setItem: async (key, value) => { store.set(key, value); io.manifestWrites++; io.manifestBytes += Buffer.byteLength(value); },
  getAllKeys: async () => [...store.keys()], multiGet: async keys => keys.map(key => [key, store.get(key) ?? null]),
  removeItem: async key => { store.delete(key); },
};
const nativeFs = {
  documentDirectory: 'file:///documents/', makeDirectoryAsync: async () => {},
  readDirectoryAsync: async directory => [...files.keys()].filter(name => name.startsWith(directory)).map(name => name.slice(directory.length)),
  readAsStringAsync: async uri => { io.fileReads++; if (!files.has(uri)) throw Error('missing'); return files.get(uri); },
  writeAsStringAsync: async (uri, value) => { io.fileWrites++; files.set(uri, value); },
  deleteAsync: async uri => { files.delete(uri); }, getInfoAsync: async uri => ({ exists: files.has(uri) }),
};
const fakeReact = { useRef: value => ({ current: value }), useEffect: () => {}, useMemo: fn => fn(), useState: value => [typeof value === 'function' ? value() : value, () => {}] };
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return { __esModule: true, default: asyncStorage };
  if (request === 'expo-file-system/legacy') return nativeFs;
  if (request === 'react') return fakeReact;
  if (request === 'react-native') return { AppState: { currentState: 'active' }, InteractionManager: {} };
  if (request.endsWith('/metadataRefreshActivity')) return { useMetadataRefreshActive: () => false };
  if (request.endsWith('/waveformExtraction')) return { resolveWaveformUri: song => song?.fileInfo?.uri ?? song?.uri, extractNativeWaveform: async () => null };
  if (request.endsWith('/waveformExtractionLifecycle')) return { MAX_WAVEFORM_CONTENTION_RETRIES: 3, WAVEFORM_SCHEDULER_WAIT_TIMEOUT_MS: 30000, waitForWaveformSchedulerAvailability: async () => {} };
  if (request.endsWith('/waveformPreload')) return { MAX_BACKGROUND_WAVEFORM_PRELOAD_DURATION_MS: 1200000 };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (mod, filename) => {
  const code = sourceAt(filename);
  const output = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }, fileName: filename }).outputText;
  mod._compile(output, filename);
};
const generator = require(path.join(root, 'utils/waveformGenerator.ts'));
const manifest = require(path.join(root, 'utils/waveformCacheManifest.ts'));
const cache = require(path.join(root, 'utils/waveformCache.ts'));
const hook = require(path.join(root, 'hooks/useLibraryWaveformPreload.ts'));
const median = values => values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const measure = (fn, count=11) => { const times = []; for (let n=0;n<count;n++) { const start = performance.now(); fn(); times.push(performance.now()-start); } return +median(times).toFixed(4); };
const song = index => ({ id: `benchmark-${index}`, title: `Song ${index}`, artist: 'Benchmark', uri: `file:///music/album/song-${index}.mp3`, duration: 180000, fileInfo: { importedAt: 5000-index, size: 4000000, modificationTime: 1700000000000+index, contentHash: index.toString(16).padStart(32, '0') } });
const rawWaveform = selected => JSON.stringify({ version: 6, ...generator.getWaveformSourceIdentity(selected), points: Array(1024).fill(0.25), bassPoints: Array(3600).fill(0.12), durationMs: 180000, source: 'native', generatedAt: 1 });
(async () => {
  const workloads = [];
  for (const size of [500, 1000, 2000, 5000]) {
    const songs = Array.from({ length: size }, (_, index) => song(index));
    let reads = 0;
    const watched = new Proxy(songs, { get(target, prop, receiver) { if (typeof prop === 'string' && /^\d+$/.test(prop)) reads++; return Reflect.get(target, prop, receiver); } });
    const disabledMs = measure(() => hook.useLibraryWaveformPreload(watched, false));
    const entries = songs.map(selected => { const raw = rawWaveform(selected); return manifest.waveformManifestEntry(JSON.parse(raw), raw); });
    const fitted = manifest.fitWaveformManifest(entries);
    const serialized = manifest.serializeWaveformManifest(fitted.active);
    const result = { songs: size, disabledRenderPureMsMedian: disabledMs, disabledSongReadsPerRender: reads / 11,
      manifestFitMsMedian: measure(() => manifest.fitWaveformManifest(entries)), manifestSerializeMsMedian: measure(() => manifest.serializeWaveformManifest(fitted.active)),
      manifestParseMsMedian: measure(() => manifest.parseWaveformManifest(serialized)), persistedEntries: fitted.active.length,
      persistedBytes: fitted.active.reduce((total, entry) => total+entry.bytes,0), manifestBytes: Buffer.byteLength(serialized) };
    if (hasSource(path.join(root, 'utils/libraryWaveformPreloadIndex.ts'))) {
      const { LibraryWaveformPreloadIndex } = require(path.join(root, 'utils/libraryWaveformPreloadIndex.ts'));
      const index = new LibraryWaveformPreloadIndex(20 * 60 * 1000); index.update(songs);
      result.sameArrayIndexMsMedian = measure(() => index.update(songs));
      let revision = 0;
      result.oneMetadataEditMsMedian = measure(() => { revision++; const edit = songs.slice(); edit[0] = { ...songs[0], title: `Edit ${revision}` }; index.update(edit); });
    }
    workloads.push(result);
  }
  const samples = Array.from({ length: 1000 }, (_, index) => song(index));
  const waveforms = samples.map(selected => JSON.parse(rawWaveform(selected)));
  const entries = waveforms.map(waveform => manifest.waveformManifestEntry(waveform, JSON.stringify(waveform)));
  for (let index=0;index<entries.length;index++) files.set(`file:///documents/waveforms/v6/${entries[index].fileName}`, JSON.stringify(waveforms[index]));
  store.set('@musikplayer:waveform:v6:index', manifest.serializeWaveformManifest(entries));
  await cache.getCachedWaveform(waveforms[0]);
  const availability10000MsMedian = measure(() => { for (let count=0;count<10000;count++) cache.getCachedWaveformAvailability(waveforms[count%1000]); }, 7);
  await cache.setCachedWaveform(waveforms[999]);
  Object.keys(io).forEach(key => io[key]=0);
  const start = performance.now();
  for (let repeat=0;repeat<10;repeat++) await cache.setCachedWaveform(waveforms[999]);
  const repeatedPublication = { repeated: 10, totalMs: +(performance.now()-start).toFixed(4), ...io };
  const result = { source: { revision: revision ?? 'working-tree', baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }, node: process.version, physicalRevisionIdentity: generator.WAVEFORM_PHYSICAL_REVISION_FORMAT ?? 'v6-base-only', fixture: '180-second waveform: 1024 points + 3600 bass buckets; native filesystem and AsyncStorage double, no device timing', workloads, cache1000: { availability10000MsMedian, repeatedPublication, usage: cache.getWaveformCacheUsage() } };
  if (outputPath) fs.writeFileSync(path.resolve(root, outputPath), JSON.stringify(result, null, 2)+'\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode=1; });
