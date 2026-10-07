import { fitWaveformManifest, MAX_PERSISTED_WAVEFORM_BYTES, MAX_WAVEFORM_PAYLOAD_BYTES,
  parseWaveformManifest, serializeWaveformManifest, waveformManifestEntry, waveformPayloadBytes } from '../waveformCacheManifest';
import type { SongWaveform } from '../waveformTypes';

const waveform = (seed: number): SongWaveform => ({ version: 6, points: [0, 0.2, 1], bassPoints: [0, 0.8, 0],
  durationMs: 1000, source: 'native', generatedAt: seed, sourceKey: `s${seed}`,
  sourceFingerprint: `wf6:${seed.toString(16).padStart(32, '0')}` });

test('records the full-fidelity payload identity and independent bass availability', () => {
  const source = waveform(1); const raw = JSON.stringify(source);
  const entry = waveformManifestEntry(source, raw);
  expect(entry).toMatchObject({ sourceKey: 's1', bytes: raw.length, hasBass: true, generatedAt: 1 });
  expect(parseWaveformManifest(serializeWaveformManifest([entry]))).toEqual([entry]);
  expect(waveformManifestEntry({ ...source, bassPoints: undefined }, JSON.stringify(source)).hasBass).toBe(false);
});

test('bounds persistence by bytes, preserving thousands of small entries instead of a song-count limit', () => {
  const entries = Array.from({ length: 2000 }, (_, index) => waveformManifestEntry(waveform(index + 1), JSON.stringify(waveform(index + 1))));
  const result = fitWaveformManifest(entries);
  expect(result.active).toHaveLength(2000);
  expect(result.stale).toHaveLength(0);
  const largest = entries.slice(0, 200).map(entry => ({ ...entry, bytes: MAX_WAVEFORM_PAYLOAD_BYTES }));
  const bounded = fitWaveformManifest(largest);
  expect(bounded.active.length * MAX_WAVEFORM_PAYLOAD_BYTES).toBe(MAX_PERSISTED_WAVEFORM_BYTES);
  expect(bounded.stale[0]).toEqual(largest[128]);
});

test('rejects corrupt manifests, duplicate source keys, unsafe paths and excess byte claims', () => {
  const entry = waveformManifestEntry(waveform(1), JSON.stringify(waveform(1)));
  expect(parseWaveformManifest('{broken')).toBeNull();
  expect(parseWaveformManifest(JSON.stringify([entry]))).toBeNull();
  expect(parseWaveformManifest(serializeWaveformManifest([entry, entry]))).toBeNull();
  expect(parseWaveformManifest(serializeWaveformManifest([{ ...entry, fileName: '../music.mp3' }]))).toBeNull();
  expect(parseWaveformManifest(serializeWaveformManifest([{ ...entry, bytes: MAX_WAVEFORM_PAYLOAD_BYTES + 1 }]))).toBeNull();
  const raw = serializeWaveformManifest([entry]);
  expect(parseWaveformManifest(raw.replace('"hasBass":true', '"hasBass":false'))).toBeNull();
});

test('counts UTF-8 payload bytes including imported Unicode keys', () => {
  expect(waveformPayloadBytes('a€😀')).toBe(8);
});
