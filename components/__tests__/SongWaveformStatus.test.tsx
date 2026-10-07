// eslint-disable-next-line @typescript-eslint/no-require-imports -- Isolated native filesystem test double.
jest.mock('expo-file-system/legacy', () => require('../../utils/__tests__/waveformFileSystemMock'));
import { resetWaveformFileSystem } from '../../utils/__tests__/waveformFileSystemMock';
beforeEach(() => resetWaveformFileSystem());

import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SongWaveformStatus from '../SongWaveformStatus';
import { getWaveformSourceIdentity, buildNativeWaveform } from '../../utils/waveformGenerator';
import { resetWaveformCacheStateForTests, setCachedWaveform } from '../../utils/waveformCache';
import { setWaveformProgress, setWaveformStatus } from '../../utils/waveformStatus';
import { useSongPreparation } from '../../hooks/useSongPreparation';
import { resetSongPreparationForTests } from '../../utils/songPreparationStore';
import type { Song } from '../../types/Song';

const Status = ({ song: source }: { song: Song }) => {
  const status = useSongPreparation(source);
  return <SongWaveformStatus song={source} status={status} />;
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { primary: '#00ff00', text: { muted: '#777777' } } } }),
}));
const song = { id: 'one', title: 'One', artist: 'Artist', uri: 'file:///one.mp3', duration: 1000 };
beforeEach(async () => { resetWaveformCacheStateForTests(); resetSongPreparationForTests(); await AsyncStorage.clear(); });
afterEach(() => resetWaveformCacheStateForTests());

test('only animates the currently scanned track and shows no percentages or bars', () => {
  const second = { ...song, id: 'two', uri: 'file:///two.mp3' };
  const view = render(<><Status song={song} /><Status song={second} /></>);
  expect(view.queryByTestId('song-scan-animation-one')).toBeNull();
  expect(view.queryByTestId('song-scan-animation-two')).toBeNull();
  act(() => { setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'analyzing');
    setWaveformProgress(getWaveformSourceIdentity(song).sourceFingerprint, 0.42); });
  expect(view.getByTestId('song-scan-animation-one')).toBeTruthy();
  expect(view.queryByTestId('song-scan-animation-two')).toBeNull();
  expect(view.queryByTestId('song-preparation-percent-one')).toBeNull();
  expect(view.queryByTestId('song-preparation-progress-one')).toBeNull();
});

test('keeps animating until finalized, then removes the animation; changed sources wait again', async () => {
  const view = render(<Status song={song} />);
  act(() => { setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'analyzing');
    setWaveformProgress(getWaveformSourceIdentity(song).sourceFingerprint, 1); });
  expect(view.getByTestId('song-scan-animation-one')).toBeTruthy();
  await act(async () => setCachedWaveform(buildNativeWaveform(song,
    { points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5], analysis: 'decoded-pcm-v1' }, 1000, 1024)));
  expect(view.queryByTestId('song-waveform-status-one')).toBeNull();
  view.rerender(<Status song={{ ...song, uri: 'file:///replacement.mp3' }} />);
  expect(view.queryByTestId('song-scan-animation-one')).toBeNull();
});

test('recognizes a persisted waveform after the memory cache was cleared', async () => {
  await setCachedWaveform(buildNativeWaveform(song,
    { points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5], analysis: 'decoded-pcm-v1' }, 1000, 1024));
  resetWaveformCacheStateForTests(); resetSongPreparationForTests();
  const view = render(<Status song={song} />);
  await waitFor(() => expect(view.queryByTestId('song-waveform-status-one')).toBeNull());
});
