import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedWaveformForSong } from '../waveformSourceCache';
import { extractNativeWaveform } from '../waveformExtraction';
import { setCachedWaveform } from '../waveformCache';
import { prepareLibraryWaveforms, resetWaveformPreparationForTests } from '../libraryWaveformPreparation';
import { markSongPrepared, resetSongPreparationForTests } from '../songPreparationStore';
import { getWaveformSourceIdentity } from '../waveformGenerator';

jest.mock('../waveformSourceCache', () => ({ getCachedWaveformForSong: jest.fn().mockResolvedValue(null) }));
jest.mock('../waveformExtraction', () => ({ extractNativeWaveform: jest.fn() }));
jest.mock('../waveformCache', () => ({ setCachedWaveform: jest.fn().mockResolvedValue(undefined) }));
beforeEach(async () => { resetWaveformPreparationForTests(); resetSongPreparationForTests();
  await AsyncStorage.clear(); jest.clearAllMocks();
  jest.mocked(extractNativeWaveform).mockImplementation(async song => ({ ...getWaveformSourceIdentity(song), source: 'native' } as never));
});
afterEach(() => jest.restoreAllMocks());

test.each([500, 2000, 5000])('bounds completion snapshots in a serial %i-source preparation', async count => {
  const songs = Array.from({ length: count }, (_, index) => ({
    id: `history-${index}`, title: `Track ${index}`, artist: 'Artist', uri: `file:///history-${index}.mp3`, duration: 1000,
  }));
  let writes = 0; let serializedCodeUnits = 0; let lastSnapshot = '';
  const write = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (_key, value) => {
    writes += 1; serializedCodeUnits += value.length; lastSnapshot = value;
    // Do not retain O(N²) snapshot strings in Jest's call registry.
    write.mockClear();
  });
  await prepareLibraryWaveforms(songs);
  await markSongPrepared(getWaveformSourceIdentity(songs[count - 1]).sourceFingerprint);
  // eslint-disable-next-line no-console -- Aggregate serialized volume at the real store boundary; no device timing claim.
  console.info(JSON.stringify({ scope: 'host serial preparation; immediate cache/decoder/storage doubles; actual history store',
    songs: count, writes, serializedCodeUnits, retainedEntries: JSON.parse(lastSnapshot).length }));
  expect(getCachedWaveformForSong).toHaveBeenCalledTimes(count);
  expect(setCachedWaveform).toHaveBeenCalledTimes(count);
  expect(JSON.parse(lastSnapshot)).toHaveLength(count);
  expect(writes).toBeLessThanOrEqual(Math.ceil(count / 32) + 1);
}, 30000);
