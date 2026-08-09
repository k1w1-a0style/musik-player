import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import SoundCloudWaveformViewport from '../SoundCloudWaveformViewport';
import { WAVEFORM_VERSION, type SongWaveform } from '../../utils/waveformTypes';

const waveform: SongWaveform = {
  version: WAVEFORM_VERSION,
  source: 'fallback',
  sourceKey: 'soundcloud-test',
  sourceFingerprint: 'wf3:00000000000000000000000000000001',
  generatedAt: 1,
  durationMs: 100_000,
  points: [0.2, 0.6, 0.4, 0.8],
};

describe('SoundCloudWaveformViewport', () => {
  test('renders cached played and unplayed layers under a fixed center playhead', () => {
    const { getByTestId } = render(
      <SoundCloudWaveformViewport
        waveform={waveform}
        currentPosition={25_000}
        duration={100_000}
        isPlaying={false}
        onSeek={jest.fn()}
        interactive={false}
      />,
    );

    fireEvent(getByTestId('soundcloud-waveform-surface'), 'layout', {
      nativeEvent: { layout: { width: 200, height: 116, x: 0, y: 0 } },
    });

    expect(getByTestId('soundcloud-waveform-unplayed-layer')).toBeTruthy();
    expect(getByTestId('soundcloud-waveform-played-layer')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('soundcloud-waveform-played-clip').props.style).width).toBe(100);
    expect(StyleSheet.flatten(getByTestId('soundcloud-waveform-playhead').props.style).left).toBe(99);
  });

  test('supports accessible relative seeking without absolute tap jumps', () => {
    const onSeek = jest.fn();
    const { getByTestId } = render(
      <SoundCloudWaveformViewport
        waveform={waveform}
        currentPosition={25_000}
        duration={100_000}
        isPlaying={false}
        onSeek={onSeek}
        interactive={false}
      />,
    );
    const surface = getByTestId('soundcloud-waveform-surface');

    fireEvent(surface, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(surface, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onSeek).toHaveBeenNthCalledWith(1, 35_000);
    expect(onSeek).toHaveBeenNthCalledWith(2, 15_000);
  });
});
