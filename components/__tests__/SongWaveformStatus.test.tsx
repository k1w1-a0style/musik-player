import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SongWaveformStatus from '../SongWaveformStatus';
import { getWaveformSourceIdentity, buildNativeWaveform } from '../../utils/waveformGenerator';
import { resetWaveformCacheStateForTests, setCachedWaveform } from '../../utils/waveformCache';
import { setWaveformStatus } from '../../utils/waveformStatus';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { primary: '#00ff00', text: { muted: '#777777' } } } }),
}));
const song = { id: 'one', title: 'One', artist: 'Artist', uri: 'file:///one.mp3', duration: 1000 };
beforeEach(async () => { resetWaveformCacheStateForTests(); await AsyncStorage.clear(); });
afterEach(() => resetWaveformCacheStateForTests());

test('updates the row for running/ready and does not carry readiness to a changed source', async () => {
  const view = render(<SongWaveformStatus song={song} />);
  expect(view.getByLabelText('Waveform ausstehend')).toBeTruthy();
  act(() => setWaveformStatus(getWaveformSourceIdentity(song).sourceFingerprint, 'analyzing'));
  expect(view.getByLabelText('Waveform wird vorbereitet').props.accessibilityState.busy).toBe(true);
  await act(async () => setCachedWaveform(buildNativeWaveform(song,
    { points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5], analysis: 'decoded-pcm-v1' }, 1000, 1024)));
  expect(view.getByLabelText('Waveform bereit')).toBeTruthy();
  view.rerender(<SongWaveformStatus song={{ ...song, uri: 'file:///replacement.mp3' }} />);
  expect(view.getByLabelText('Waveform ausstehend')).toBeTruthy();
});

test('recognizes a persisted waveform after the memory cache was cleared', async () => {
  await setCachedWaveform(buildNativeWaveform(song,
    { points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5], analysis: 'decoded-pcm-v1' }, 1000, 1024));
  resetWaveformCacheStateForTests();
  const view = render(<SongWaveformStatus song={song} />);
  await waitFor(() => expect(view.getByLabelText('Waveform bereit')).toBeTruthy());
});
