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

test.each(['row', 'banner', 'tile'] as const)('locks and dims an unfinished %s, then unlocks without a checkmark', async variant => {
  const onPress = jest.fn();
  const view = render(<SongCard song={song} onPressSong={onPress} isCurrent={false} isPlaying={false} variant={variant} />);
  const row = () => view.getByTestId('song-card-pending');
  const content = () => view.getByTestId('song-card-content-pending');
  expect(row().props.accessibilityState.disabled).toBe(true);
  expect(StyleSheet.flatten(content().props.style).opacity).toBeLessThan(1);
  expect(StyleSheet.flatten(row().props.style).opacity ?? 1).toBe(1);
  fireEvent.press(row());
  expect(onPress).not.toHaveBeenCalled();
  expect(view.getByTestId('song-preparation-progress-pending')).toBeTruthy();
  expect(content().findAllByProps({ testID: 'song-preparation-progress-pending' })).toHaveLength(0);
  expect(row().findAllByProps({ testID: 'song-preparation-progress-pending' })).toHaveLength(0);
  expect(view.getByTestId('song-card-slot-pending').findAllByProps({ testID: 'song-preparation-progress-pending' })).not.toHaveLength(0);

  act(() => setWaveformStatus(fingerprint, 'analyzing'));
  expect(row().props.accessibilityState.busy).toBe(true);
  expect(StyleSheet.flatten(content().props.style).opacity).toBeLessThan(1);
  act(() => setWaveformProgress(fingerprint, 0.43));
  expect(view.getByTestId('song-preparation-progress-pending').props.accessibilityValue.now).toBe(43);
  await act(async () => { await markSongPrepared(fingerprint); });
  expect(row().props.accessibilityState.disabled).toBe(false);
  expect(view.queryByTestId('song-preparation-progress-pending')).toBeNull();
  expect(StyleSheet.flatten(content().props.style).opacity ?? 1).toBe(1);
  expect(view.queryByText('✓')).toBeNull();
  fireEvent.press(row());
  expect(onPress).toHaveBeenCalledWith(song);
});

test('failed preparation stays locked and can be retried without playing', () => {
  setWaveformStatus(fingerprint, 'unavailable');
  const onPress = jest.fn();
  const view = render(<SongCard song={song} onPressSong={onPress} isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(view.getByLabelText('Vorbereitung für New track erneut versuchen'));
  expect(retrySongPreparation).toHaveBeenCalledWith(song);
  expect(onPress).not.toHaveBeenCalled();
});

test('keeps a completed track selectable after cache eviction and a fresh JS session', async () => {
  await markSongPrepared(fingerprint);
  resetSongPreparationForTests(); resetWaveformCacheStateForTests();
  const view = render(<SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
  await waitFor(() => expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).toBe(false));
  view.rerender(<SongCard song={{ ...song, uri: 'file:///replaced.mp3' }} onPressSong={jest.fn()}
    isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).toBe(true);
});

test('a known preparation failure takes priority over historical completion', async () => {
  await markSongPrepared(fingerprint);
  setWaveformStatus(fingerprint, 'unavailable');
  const view = render(<SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-card-pending').props.accessibilityState.disabled).toBe(true);
  expect(view.getByText('Scan fehlgeschlagen')).toBeTruthy();
});
