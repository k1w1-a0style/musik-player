import React from 'react';
import { Animated, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { PlaybackProgressProvider } from '../../contexts/PlaybackProgressContext';
import { useProgress } from 'react-native-track-player';
import CoverBassPulse from '../CoverBassPulse';
import { useCoverBassEnvelope } from '../../hooks/useCoverBassEnvelope';
import { buildNativeWaveform } from '../../utils/waveformGenerator';
import type { Song } from '../../types/Song';

jest.mock('../../hooks/useCoverBassEnvelope', () => ({ useCoverBassEnvelope: jest.fn() }));

test('the actual cover scales with bass only while enabled and playing', () => {
  const song: Song = { id: 'bass', title: 'Bass', artist: 'Artist', uri: 'file:///bass.mp3', duration: 1000 };
  jest.mocked(useCoverBassEnvelope).mockReturnValue(buildNativeWaveform(song, {
    points: [0.1, 0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.5],
    bassPoints: [...Array(10).fill(0), ...Array(10).fill(0.35)], analysis: 'decoded-pcm-v1',
  }, 1000, 1024));
  jest.mocked(useProgress).mockReturnValue({ position: 0.65, duration: 1, buffered: 1 });
  const animation = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const cover = (enabled: boolean, isPlaying = true) => <PlaybackProgressProvider><CoverBassPulse song={song} enabled={enabled} isPlaying={isPlaying}>
    <Text testID="artwork">Cover</Text>
  </CoverBassPulse></PlaybackProgressProvider>;
  const view = render(cover(false));
  const scale = () => view.getByTestId('now-playing-cover-bass-pulse').props.style.transform[0].scale;
  expect(scale()).toBe(1);
  expect(useCoverBassEnvelope).not.toHaveBeenCalled();
  view.rerender(cover(true));
  expect(scale()).toBeGreaterThan(1.03);
  view.rerender(cover(true, false));
  expect(scale()).toBe(1);
  view.rerender(cover(false));
  expect(scale()).toBe(1);
  expect(view.getByTestId('artwork').props.children).toBe('Cover');
  view.unmount();
  animation.mockRestore();
});
