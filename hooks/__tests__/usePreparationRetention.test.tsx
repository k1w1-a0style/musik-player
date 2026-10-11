import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Song } from '../../types/Song';
import * as sourceIdentity from '../../utils/waveformGenerator';
import { flushPreparedSources, markSongPrepared, queueSongPrepared, resetSongPreparationForTests, wasSongPrepared } from '../../utils/songPreparationStore';
import { getWaveformStatus, resetWaveformStatusForTests, setWaveformStatus } from '../../utils/waveformStatus';
import { usePreparationRetention } from '../usePreparationRetention';

const track = (id: string): Song => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });
const fingerprint = (song: Song): string => sourceIdentity.getWaveformSourceIdentity(song).sourceFingerprint;
beforeEach(async () => { resetSongPreparationForTests(); resetWaveformStatusForTests(); await AsyncStorage.clear(); jest.clearAllMocks(); });
afterEach(async () => { await flushPreparedSources(); resetSongPreparationForTests(); resetWaveformStatusForTests(); jest.restoreAllMocks(); });

test('keeps startup history until the library is ready, then prunes old immutable revisions', async () => {
  const first = track('first'); const old = track('old');
  await Promise.all([markSongPrepared(fingerprint(first)), markSongPrepared(fingerprint(old))]);
  setWaveformStatus(fingerprint(old), 'ready');
  const keys = jest.spyOn(sourceIdentity, 'getCompatibleWaveformSourceIdentities');
  const view = renderHook(({ ready, songs }: { ready: boolean; songs: Song[] }) => usePreparationRetention(ready, songs),
    { initialProps: { ready: false, songs: [] as Song[] } });
  expect(wasSongPrepared(fingerprint(old))).toBe(true); expect(keys).not.toHaveBeenCalled();
  view.rerender({ ready: true, songs: [first, old] });
  expect(keys).toHaveBeenCalledTimes(2);
  const changed = { ...old, uri: 'file:///new-revision.mp3' };
  view.rerender({ ready: true, songs: [first, changed] });
  expect(keys).toHaveBeenCalledTimes(3);
  expect(wasSongPrepared(fingerprint(old))).toBe(false);
  expect(wasSongPrepared(fingerprint(first))).toBe(true);
  expect(getWaveformStatus(fingerprint(old))).toBe('pending');
  view.unmount(); await flushPreparedSources();
});

test('flushes queued history on background and removes the AppState listener on unmount', async () => {
  let change!: (state: string) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = listener as (state: string) => void; return { remove };
  });
  const song = track('background');
  const view = renderHook(() => usePreparationRetention(true, [song]));
  queueSongPrepared(fingerprint(song));
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => { change('background'); await flushPreparedSources(); });
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  view.unmount(); expect(remove).toHaveBeenCalledTimes(1);
});
