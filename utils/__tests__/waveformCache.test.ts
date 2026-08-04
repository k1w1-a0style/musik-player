import { clearWaveformCache, getCachedWaveform, setCachedWaveform } from '../waveformCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

test('serializes concurrent index updates without losing cache entries', async () => {
  const waveforms = ['a', 'b', 'c', 'd'].map((sourceKey, index): SongWaveform => ({
    ...waveform,
    sourceKey,
    generatedAt: index + 1,
  }));

  await Promise.all(waveforms.map(item => setCachedWaveform(item)));

  const rawIndex = await AsyncStorage.getItem('@musikplayer:waveform:index');
  expect(rawIndex).not.toBeNull();
  expect(new Set(JSON.parse(rawIndex ?? '[]'))).toEqual(new Set(['a', 'b', 'c', 'd']));
  await expect(Promise.all(waveforms.map(item => getCachedWaveform(item.sourceKey))))
    .resolves.toEqual(waveforms);
});

test('a failed mutation does not poison later cache writes', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(setCachedWaveform({ ...waveform, sourceKey: 'broken' })).rejects.toThrow('storage unavailable');

  await expect(setCachedWaveform({ ...waveform, sourceKey: 'recovered' })).resolves.toBeUndefined();
  await expect(getCachedWaveform('recovered')).resolves.toMatchObject({ sourceKey: 'recovered' });
});
