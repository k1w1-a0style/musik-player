import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWaveformSourceIdentity } from '../waveformGenerator';
import { loadPreparedSources, markSongPrepared, resetSongPreparationForTests,
  wasSongPrepared } from '../songPreparationStore';

const fingerprint = (id: string) => getWaveformSourceIdentity({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` }).sourceFingerprint;
beforeEach(async () => { resetSongPreparationForTests(); await AsyncStorage.clear(); jest.clearAllMocks(); });

test('merges persisted completion with newly completed tracks without losing either', async () => {
  await markSongPrepared(fingerprint('old'));
  resetSongPreparationForTests();
  await Promise.all([markSongPrepared(fingerprint('new')), loadPreparedSources()]);
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('old'))).toBe(true);
  expect(wasSongPrepared(fingerprint('new'))).toBe(true);
  expect(wasSongPrepared(fingerprint('replacement'))).toBe(false);
});

test('a completion write can recover after storage failure', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage busy'));
  await expect(markSongPrepared(fingerprint('one'))).rejects.toThrow('storage busy');
  await markSongPrepared(fingerprint('one'));
  resetSongPreparationForTests();
  await loadPreparedSources();
  expect(wasSongPrepared(fingerprint('one'))).toBe(true);
});

test('does not rewrite completion when a ready row is remounted repeatedly', async () => {
  await markSongPrepared(fingerprint('one'));
  const count = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
  await Promise.all(Array.from({ length: 20 }, () => markSongPrepared(fingerprint('one'))));
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(count);
});
