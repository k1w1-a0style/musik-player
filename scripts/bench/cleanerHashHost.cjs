#!/usr/bin/env node
'use strict';
// Host-only synthetic baseline. Not an Android/provider/UI-jank measurement.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => {
    if (name === './tagCleanerRead') return { cleanerReadAdapter: undefined };
    if (!name.startsWith('.')) throw new Error('Unexpected benchmark dependency ' + name);
    return load(path.resolve(path.dirname(file), name + '.ts'));
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
(async () => {
  const { hashCleanerSource } = load(path.join(root, 'utils/tagCleanerSha256.ts'));
  const cases = [];
  for (const mib of [10, 25, 50]) {
    const size = mib * 1024 * 1024;
    const chunk = new Uint8Array(65536).fill(90);
    const reference = crypto.createHash('sha256');
    for (let p = 0; p < size; p += chunk.length) reference.update(chunk);
    let reads = 0, stats = 0, maxRange = 0, peakHeap = process.memoryUsage().heapUsed, maxHostTimerLagMs = 0;
    const adapter = {
      info: async () => { stats++; return { exists: true, size, modificationTime: 1 }; },
      range: async (_uri, _position, length) => { reads++; maxRange = Math.max(maxRange, length); peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed); return chunk.subarray(0, length); },
    };
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); maxHostTimerLagMs = Math.max(maxHostTimerLagMs, now - previous - 10); previous = now; }, 10);
    const cpu = process.cpuUsage(), start = performance.now();
    let result;
    try { result = await hashCleanerSource('synthetic://host-only', adapter); } finally { clearInterval(timer); }
    const elapsedMs = performance.now() - start, used = process.cpuUsage(cpu);
    if (result.sha256 !== reference.digest('hex') || reads !== size / 65536 || stats !== 2 || maxRange > 65536) throw new Error('Baseline correctness/read-bound regression');
    cases.push({ mib, reads, stats, maxRange, elapsedMs, cpuMs: (used.user + used.system) / 1000, sampledPeakHeapBytes: peakHeap, maxHostTimerLagMs, sha256: result.sha256 });
  }
  const report = { scope: 'Node host synthetic in-memory adapter; NOT Android, Hermes, SAF-provider or frame-jank evidence', node: process.version, measuredAt: new Date().toISOString(), cases };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
})().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
