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

test('shows independent progress for the running track and zero for a waiting track', () => {
  const second = { ...song, id: 'two', title: 'Two', uri: 'file:///two.mp3' };
  const firstFingerprint = getWaveformSourceIdentity(song).sourceFingerprint;
  const secondFingerprint = getWaveformSourceIdentity(second).sourceFingerprint;
  const view = render(<><Status song={song} /><Status song={second} /></>);
  act(() => { setWaveformStatus(firstFingerprint, 'analyzing'); setWaveformProgress(firstFingerprint, 0.42); });
  expect(view.getByTestId('song-preparation-percent-one').props.children).toBe('42 %');
  expect(view.getByTestId('song-preparation-progress-one').props.accessibilityValue.now).toBe(42);
  expect(view.getByTestId('song-preparation-percent-two').props.children).toBe('0 %');
  expect(view.getByTestId('song-preparation-progress-two').props.accessibilityValue.now).toBe(0);
  act(() => { setWaveformStatus(secondFingerprint, 'analyzing'); setWaveformProgress(secondFingerprint, 0.68); });
  expect(view.getByTestId('song-preparation-percent-one').props.children).toBe('42 %');
  expect(view.getByTestId('song-preparation-percent-two').props.children).toBe('68 %');
});

test('updates the row for running/ready and does not carry readiness to a changed source', async () => {
  const view = render(<Status song={song} />);
  expect(view.getByText('Vorbereitung ausstehend')).toBeTruthy();
  act(() => setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'analyzing'));
  expect(view.getByLabelText('Track wird vorbereitet').props.accessibilityState.busy).toBe(true);
  await act(async () => setCachedWaveform(buildNativeWaveform(song,
    { points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5], analysis: 'decoded-pcm-v1' }, 1000, 1024)));
  expect(view.getByTestId('song-preparation-progress-one').props.accessibilityValue.now).toBe(100);
  expect(view.getByTestId('song-preparation-percent-one').props.children).toBe('100 %');
  expect(view.queryByText('✓')).toBeNull();
  view.rerender(<Status song={{ ...song, uri: 'file:///replacement.mp3' }} />);
  expect(view.getByText('Vorbereitung ausstehend')).toBeTruthy();
});

test('recognizes a persisted waveform after the memory cache was cleared', async () => {
  await setCachedWaveform(buildNativeWaveform(song,
    { points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5], analysis: 'decoded-pcm-v1' }, 1000, 1024));
  resetWaveformCacheStateForTests();
  resetSongPreparationForTests();
  const view = render(<Status song={song} />);
  await waitFor(() => expect(view.getByTestId('song-preparation-percent-one').props.children).toBe('100 %'));
});


test('does not claim completion until the final waveform is ready', () => {
  const view = render(<Status song={song} />);
  act(() => { setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'analyzing');
    setWaveformProgress(getWaveformSourceIdentity(song).sourceFingerprint, 1); });
  expect(view.getByTestId('song-preparation-percent-one').props.children).toBe('99 %');
  expect(view.getByTestId('song-preparation-progress-one').props.accessibilityValue.now).toBe(99);
});
