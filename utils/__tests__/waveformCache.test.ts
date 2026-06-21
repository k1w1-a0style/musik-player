import { clearWaveformCache, getCachedWaveform, setCachedWaveform } from '../waveformCache';
import { WAVEFORM_VERSION, type SongWaveform } from '../waveformTypes';

const waveform: SongWaveform = {
  version: WAVEFORM_VERSION,
  points: [0.2, 0.7, 1],
  durationMs: 1000,
  sourceKey: 'source-1',
  source: 'native',
  generatedAt: 1,
};

beforeEach(async () => {
  await clearWaveformCache();
});

test('stores and reads a valid waveform', async () => {
  await setCachedWaveform(waveform);
  await expect(getCachedWaveform('source-1')).resolves.toEqual(waveform);
});

test('returns null for missing waveform', async () => {
  await expect(getCachedWaveform('missing')).resolves.toBeNull();
});

test('clears cached waveforms', async () => {
  await setCachedWaveform(waveform);
  await clearWaveformCache();
  await expect(getCachedWaveform('source-1')).resolves.toBeNull();
});
