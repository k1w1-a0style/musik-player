// eslint-disable-next-line @typescript-eslint/no-require-imports -- Isolated native filesystem test double.
jest.mock('expo-file-system/legacy', () => require('../../utils/__tests__/waveformFileSystemMock'));
import { resetWaveformFileSystem } from '../../utils/__tests__/waveformFileSystemMock';
beforeEach(() => resetWaveformFileSystem());

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SongCard from '../SongCard';
import { getWaveformSourceIdentity } from '../../utils/waveformGenerator';
import { resetWaveformCacheStateForTests } from '../../utils/waveformCache';
import { setWaveformProgress, setWaveformStatus } from '../../utils/waveformStatus';
import { markSongPrepared, resetSongPreparationForTests } from '../../utils/songPreparationStore';
import { retrySongPreparation } from '../../utils/libraryWaveformPreparation';

jest.mock('../../utils/libraryWaveformPreparation', () => ({ retrySongPreparation: jest.fn().mockResolvedValue(true) }));
jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { primary: '#eee', surfaceGlass: '#222', border: '#333',
    primaryGlow: '#444', borderStrong: '#555', text: { primary: '#fff', secondary: '#ccc', muted: '#aaa' } } } }),
}));
const song = { id: 'pending', title: 'New track', artist: 'Artist', uri: 'file:///new.mp3', duration: 60000 };
const fingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
beforeEach(async () => {
  resetSongPreparationForTests(); resetWaveformCacheStateForTests(); await AsyncStorage.clear();
  jest.clearAllMocks();
});

test.each(['row', 'banner', 'tile'] as const)('allows %s audio taps while waveform analysis is pending or running', async variant => {
  const onPress = jest.fn();
  const onInfo = jest.fn();
  const view = render(<SongCard song={song} onPressSong={onPress} onInfoSong={onInfo}
    isCurrent={false} isPlaying={false} variant={variant} />);
  const row = () => view.getByTestId('song-card-pending');
  const content = () => view.getByTestId('song-card-content-pending');
  expect(row().props.accessibilityState.disabled).not.toBe(true);
  expect(StyleSheet.flatten(content().props.style).opacity ?? 1).toBe(1);
  fireEvent.press(row());
  expect(onPress).toHaveBeenCalledWith(song);
  act(() => setWaveformStatus(fingerprint, 'analyzing'));
  act(() => setWaveformProgress(fingerprint, 0.43));
  expect(view.getByTestId('song-scan-animation-pending')).toBeTruthy();
  expect(StyleSheet.flatten(content().props.style).opacity ?? 1).toBe(1);
  fireEvent.press(row());
  expect(onPress).toHaveBeenCalledTimes(2);
  await act(async () => { await markSongPrepared(fingerprint); });
  // A history marker alone must not claim that an analyzing waveform is ready.
  expect(view.getByTestId('song-scan-animation-pending')).toBeTruthy();
  act(() => setWaveformStatus(fingerprint, 'ready'));
  expect(view.queryByTestId('song-scan-animation-pending')).toBeNull();
});

test('offers analysis retry without disabling audio after a decoder failure', () => {
  setWaveformStatus(fingerprint, 'unavailable');
  const onPress = jest.fn();
  const view = render(<SongCard song={song} onPressSong={onPress} isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).not.toBe(true);
  fireEvent.press(view.getByLabelText('Vorbereitung für New track erneut versuchen'));
  expect(retrySongPreparation).toHaveBeenCalledWith(song);
  expect(onPress).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('song-card-pending'));
  expect(onPress).toHaveBeenCalledWith(song);
});

test('keeps both completed and replacement sources playable across a fresh JS session', async () => {
  await markSongPrepared(fingerprint);
  resetSongPreparationForTests(); resetWaveformCacheStateForTests();
  const onPress = jest.fn();
  const view = render(<SongCard song={song} onPressSong={onPress} isCurrent={false} isPlaying={false} />);
  await waitFor(() => expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).not.toBe(true));
  const replacement = { ...song, uri: 'file:///replaced.mp3' };
  view.rerender(<SongCard song={replacement} onPressSong={onPress} isCurrent={false} isPlaying={false} />);
  fireEvent.press(view.getByTestId('song-card-pending'));
  expect(onPress).toHaveBeenCalledWith(replacement);
});

test('reports known preparation failure even if historical completion is recorded', async () => {
  await markSongPrepared(fingerprint);
  setWaveformStatus(fingerprint, 'unavailable');
  const view = render(<SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).not.toBe(true);
  expect(view.getByLabelText('Vorbereitung für New track erneut versuchen')).toBeTruthy();
});

test.each(['modificationTime', 'contentHash'] as const)('replaces the waveform subscription when only %s changes', field => {
  const base = { ...song, fileInfo: { uri: song.uri, size: 100, modificationTime: 1, contentHash: 'old' } };
  const replacement = { ...base, fileInfo: { ...base.fileInfo, [field]: field === 'modificationTime' ? 2 : 'new' } };
  const oldFingerprint = getWaveformSourceIdentity(base).sourceFingerprint;
  const newFingerprint = getWaveformSourceIdentity(replacement).sourceFingerprint;
  expect(newFingerprint).not.toBe(oldFingerprint);
  setWaveformStatus(oldFingerprint, 'ready');
  setWaveformStatus(newFingerprint, 'analyzing');
  const onPressSong = jest.fn();
  const view = render(<SongCard song={base} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />);
  expect(view.queryByTestId('song-scan-animation-pending')).toBeNull();
  view.rerender(<SongCard song={replacement} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-scan-animation-pending')).toBeTruthy();
  fireEvent.press(view.getByTestId('song-card-pending'));
  expect(onPressSong).toHaveBeenLastCalledWith(replacement);
});
