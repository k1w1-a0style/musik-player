import { getCachedWaveformForSong } from '../waveformSourceCache';
import { extractNativeWaveform } from '../waveformExtraction';
import { prepareLibraryWaveforms, resetWaveformPreparationForTests } from '../libraryWaveformPreparation';
import { queueSongPrepared } from '../songPreparationStore';
import { waitForWaveformSchedulerAvailability } from '../waveformExtractionLifecycle';
import { resetWaveformStatusForTests } from '../waveformStatus';

jest.mock('../waveformSourceCache', () => ({ getCachedWaveformForSong: jest.fn().mockResolvedValue(null) }));
jest.mock('../waveformExtraction', () => ({ extractNativeWaveform: jest.fn().mockResolvedValue(null) }));
jest.mock('../songPreparationStore', () => ({ loadPreparedSources: jest.fn().mockResolvedValue(undefined), queueSongPrepared: jest.fn() }));
jest.mock('../waveformExtractionLifecycle', () => ({
  ...jest.requireActual('../waveformExtractionLifecycle'), waitForWaveformSchedulerAvailability: jest.fn().mockResolvedValue(undefined),
}));
beforeEach(() => { resetWaveformPreparationForTests(); resetWaveformStatusForTests(); jest.clearAllMocks();
  jest.mocked(getCachedWaveformForSong).mockResolvedValue(null); jest.mocked(extractNativeWaveform).mockResolvedValue(null);
});

test.each([500, 2000, 5000])('bounds an uncontended %i-title batch to one cache lookup per source', async count => {
  const songs = Array.from({ length: count }, (_, index) => ({
    id: String(index), title: `Track ${index}`, artist: 'Artist', uri: `file:///track-${index}.mp3`, duration: 1000,
  }));
  await prepareLibraryWaveforms(songs);
  // eslint-disable-next-line no-console -- Reproducible aggregate benchmark counters; no file paths or user data.
  console.info(JSON.stringify({ scope: 'host orchestration with immediate boundary doubles; no device timing claim',
    songs: count, cacheReads: jest.mocked(getCachedWaveformForSong).mock.calls.length,
    decoderRequests: jest.mocked(extractNativeWaveform).mock.calls.length }));
  expect(getCachedWaveformForSong).toHaveBeenCalledTimes(count);
  expect(extractNativeWaveform).toHaveBeenCalledTimes(count);
});

test('a durable cache hit requires neither a decoder nor a completion-history write', async () => {
  jest.mocked(getCachedWaveformForSong).mockResolvedValue({ source: 'native' } as never);
  await prepareLibraryWaveforms([{ id: 'cached', title: 'Cached', artist: 'Artist', uri: 'file:///cached.mp3' }]);
  expect(getCachedWaveformForSong).toHaveBeenCalledTimes(1);
  expect(extractNativeWaveform).not.toHaveBeenCalled();
  expect(queueSongPrepared).not.toHaveBeenCalled();
});

test('rechecks the cache after real scheduler contention to reuse playback work', async () => {
  jest.mocked(getCachedWaveformForSong).mockResolvedValueOnce(null).mockResolvedValueOnce({ source: 'native' } as never);
  jest.mocked(extractNativeWaveform).mockImplementationOnce(async (_song, _duration, options) => {
    options?.onDecision?.({ decision: 'native-scheduler-unavailable' } as never); return null;
  });
  await prepareLibraryWaveforms([{ id: 'contended', title: 'Contended', artist: 'Artist', uri: 'file:///contended.mp3' }]);
  expect(waitForWaveformSchedulerAvailability).toHaveBeenCalledTimes(1);
  expect(getCachedWaveformForSong).toHaveBeenCalledTimes(2);
  expect(extractNativeWaveform).toHaveBeenCalledTimes(1);
});
