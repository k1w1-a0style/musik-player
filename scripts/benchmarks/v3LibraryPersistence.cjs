// Deterministic IO-volume comparison; timings use an in-memory AsyncStorage
// boundary and are not Android latency measurements. Run from any directory with installed project dependencies.
const fs = require('node:fs');
const cp = require('node:child_process');
const { createRequire } = require('node:module');
const { performance } = require('node:perf_hooks');
const path = require('node:path');
const repo = path.resolve(__dirname, '../..');
const projectRequire = createRequire(`${repo}/package.json`);
const ts = projectRequire('typescript');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const hash = { exports: {} };
new Function('module', 'exports', compile(fs.readFileSync(`${repo}/utils/stringHash.ts`, 'utf8')))(hash, hash.exports);

function implementation(source) {
  const data = new Map();
  let stats = { writeUnits: 0, readUnits: 0, writeChunks: 0, readChunks: 0 };
  const native = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    multiGet: async keys => {
      stats.readChunks += keys.length;
      return keys.map(key => {
        const value = data.get(key) ?? null;
        stats.readUnits += value?.length ?? 0;
        return [key, value];
      });
    },
    multiSet: async pairs => {
      stats.writeChunks += pairs.length;
      for (const [key, value] of pairs) {
        stats.writeUnits += value.length;
        data.set(key, value);
      }
    },
    multiRemove: async keys => { keys.forEach(key => data.delete(key)); },
    removeItem: async key => { data.delete(key); },
    getAllKeys: async () => [...data.keys()],
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compile(source))(
    id => id === './stringHash' ? hash.exports : { __esModule: true, default: native },
    loaded, loaded.exports,
  );
  return {
    api: loaded.exports,
    stats: () => ({ ...stats }),
    reset: () => { stats = { writeUnits: 0, readUnits: 0, writeChunks: 0, readChunks: 0 }; },
  };
}

(async () => {
  const sources = {
    old: cp.execFileSync('git', ['show', 'a154070b82534f2c62e8eb7d362d6d96798e1c8c:utils/songLibraryStorage.ts'], { cwd: repo, encoding: 'utf8' }),
    current: fs.readFileSync(`${repo}/utils/songLibraryStorage.ts`, 'utf8'),
  };
  const rows = [];
  for (const count of [500, 2000, 5000]) {
    const songs = Array.from({ length: count }, (_, index) => ({
      id: `song-${index}`, title: `${index}-${'x'.repeat(500)}`, artist: 'Artist', uri: `file:///${index}.mp3`,
    }));
    for (const [name, source] of Object.entries(sources)) {
      for (const change of ['identical', 'edit', 'insert', 'delete']) {
        const probe = implementation(source);
        await probe.api.writeStoredSongLibrary('legacy', JSON.stringify(songs));
        probe.reset();
        const next = change === 'identical' ? songs : change === 'edit'
          ? songs.map((song, index) => index === 0 ? { ...song, title: song.title + 'new tags'.repeat(10) } : song)
          : change === 'insert'
            ? [{ id: 'inserted', title: 'Inserted', artist: 'Artist', uri: 'file:///inserted.mp3' }, ...songs]
            : songs.slice(1);
        const serialized = JSON.stringify(next);
        const start = performance.now();
        await probe.api.writeStoredSongLibrary('legacy', serialized);
        const elapsed = performance.now() - start;
        const measurements = probe.stats();
        if ((await probe.api.readStoredSongLibrary('legacy')).serialized !== serialized) throw new Error('Reconstruction failed');
        rows.push({ count, implementation: name, change, totalUnits: serialized.length,
          ...measurements, cpuMockMs: Number(elapsed.toFixed(2)) });
      }
    }
  }
  console.log(JSON.stringify({ node: process.version, rows }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
