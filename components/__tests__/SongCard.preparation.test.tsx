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
import { beginSongProcessing } from '../../utils/songProcessingActivity';

jest.mock('../../utils/libraryWaveformPreparation', () => ({ retrySongPreparation: jest.fn().mockResolvedValue(true) }));
let mockReducedMotion = false;
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { primary: '#eee', surfaceGlass: '#222', border: '#333',
    primaryGlow: '#444', borderStrong: '#555', text: { primary: '#fff', secondary: '#ccc', muted: '#aaa' } } } }),
}));
const song = { id: 'pending', title: 'New track', artist: 'Artist', uri: 'file:///new.mp3', duration: 60000 };
const fingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
beforeEach(async () => {
  mockReducedMotion = false;
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
  expect(view.getByTestId('song-preparation-progress-pending').props.accessibilityValue).toBeUndefined();
  act(() => setWaveformProgress(fingerprint, 0.43));
  const progress = view.getByTestId('song-preparation-progress-pending');
  expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 43 });
  expect(StyleSheet.flatten(progress.props.style)).toMatchObject({ position: 'absolute', bottom: 1, height: 3 });
  expect(progress.props.pointerEvents).toBe('none');
  expect(StyleSheet.flatten(content().props.style).opacity ?? 1).toBe(1);
  fireEvent.press(row());
  expect(onPress).toHaveBeenCalledTimes(2);
  await act(async () => { await markSongPrepared(fingerprint); });
  // A history marker alone must not claim that an analyzing waveform is ready.
  expect(view.getByTestId('song-preparation-progress-pending')).toBeTruthy();
  act(() => setWaveformStatus(fingerprint, 'ready'));
  expect(view.queryByTestId('song-preparation-progress-pending')).toBeNull();
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
  expect(view.queryByTestId('song-preparation-progress-pending')).toBeNull();
  view.rerender(<SongCard song={replacement} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />);
  expect(view.getByTestId('song-preparation-progress-pending')).toBeTruthy();
  fireEvent.press(view.getByTestId('song-card-pending'));
  expect(onPressSong).toHaveBeenLastCalledWith(replacement);
});

test('shows only the affected title during capture, audio info, metadata and cover processing', () => {
  const other = { ...song, id: 'other', uri: 'file:///other.mp3' };
  const onPressSong = jest.fn();
  const view = render(<>
    <SongCard song={song} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />
    <SongCard song={other} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />
  </>);
  const active = () => view.getByTestId('song-preparation-progress-pending');
  let endCapture!: () => void;
  let endAudio!: () => void;
  let endMetadata!: () => void;
  let endCover!: () => void;
  act(() => { endCapture = beginSongProcessing(song.uri, 'capture'); });
  expect(active().props.accessibilityLabel).toBe('Titel wird erfasst · New track');
  act(() => { endAudio = beginSongProcessing(song.uri, 'audioInfo'); });
  expect(active().props.accessibilityLabel).toBe('Audioinformationen werden gelesen · New track');
  act(() => { endMetadata = beginSongProcessing(song.uri, 'metadata'); });
  expect(active().props.accessibilityLabel).toBe('Metadaten werden gelesen · New track');
  act(() => { endCover = beginSongProcessing(song.uri, 'cover'); });
  expect(active().props.accessibilityLabel).toBe('Cover wird gelesen · New track');
  expect(active().props.accessibilityValue).toBeUndefined();
  expect(view.queryByTestId('song-preparation-progress-other')).toBeNull();
  act(() => { endCapture(); endAudio(); endCover(); });
  expect(active().props.accessibilityLabel).toBe('Metadaten werden gelesen · New track');
  act(() => { endMetadata(); });
  expect(view.queryByTestId('song-preparation-progress-pending')).toBeNull();
});

test('uses a static bar in reduced motion and retains real progress values', () => {
  mockReducedMotion = true;
  setWaveformStatus(fingerprint, 'analyzing');
  const view = render(<SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
  const track = () => view.getByTestId('song-preparation-progress-pending');
  const fill = () => StyleSheet.flatten(view.getByTestId('song-preparation-progress-fill-pending').props.style);
  fireEvent(track(), 'layout', { nativeEvent: { layout: { width: 260 } } });
  expect(fill()).toMatchObject({ width: '35%', alignSelf: 'center' });
  expect(fill().transform).toBeUndefined();
  expect(track().props.accessibilityValue).toBeUndefined();
  act(() => setWaveformProgress(fingerprint, 0.5));
  expect(fill()).toMatchObject({ width: '50%' });
  expect(fill().transform).toBeUndefined();
  expect(track().props.accessibilityValue.now).toBe(50);
});


test.each(['row', 'banner', 'tile'] as const)('reserves separate %s slots for analysis retry and the song menu', variant => {
  setWaveformStatus(fingerprint, 'unavailable');
  const onPress = jest.fn(); const onInfo = jest.fn();
  const view = render(<SongCard song={song} onPressSong={onPress} onInfoSong={onInfo}
    isCurrent={false} isPlaying={false} variant={variant} />);
  const status = view.getByTestId('song-waveform-status-pending');
  const menu = view.getByTestId('song-card-info-pending');
  expect(StyleSheet.flatten(status.props.style).position).not.toBe('absolute');
  expect(StyleSheet.flatten(menu.props.style).position).not.toBe('absolute');
  expect(StyleSheet.flatten(menu.props.style).width).toBeGreaterThanOrEqual(48);
  expect(StyleSheet.flatten(view.getByLabelText('Vorbereitung für New track erneut versuchen').props.style).minHeight).toBeGreaterThanOrEqual(48);
  fireEvent.press(menu);
  expect(onInfo).toHaveBeenCalledWith(song);
  fireEvent.press(view.getByLabelText('Vorbereitung für New track erneut versuchen'));
  expect(retrySongPreparation).toHaveBeenCalledWith(song);
  expect(onPress).not.toHaveBeenCalled();
});
