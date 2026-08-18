import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import SoundCloudWaveformViewport from '../SoundCloudWaveformViewport';
import { WAVEFORM_VERSION, type SongWaveform } from '../../utils/waveformTypes';

const waveform: SongWaveform = {
  version: WAVEFORM_VERSION,
  source: 'fallback',
  sourceKey: 'soundcloud-test',
  sourceFingerprint: 'wf4:00000000000000000000000000000001',
  generatedAt: 1,
  durationMs: 100_000,
  points: [0.2, 0.6, 0.4, 0.8],
};

describe('SoundCloudWaveformViewport', () => {
  test('binds the gesture event to an animated surface', () => {
    const { getByTestId } = render(
      <SoundCloudWaveformViewport
        waveform={waveform}
        currentPosition={25_000}
        duration={100_000}
        isPlaying={false}
        onSeek={jest.fn()}
      />,
    );

    expect(getByTestId('soundcloud-waveform-gesture').parent?.parent?.type).toBe(Animated.View);
  });

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

  test('renders adjacent preview waveforms without duplicate progress layers', () => {
    const { getByTestId, queryByTestId } = render(
      <SoundCloudWaveformViewport waveform={waveform} currentPosition={0}
        duration={100_000} isPlaying={false} onSeek={jest.fn()}
        interactive={false} showProgress={false} />,
    );

    expect(getByTestId('soundcloud-waveform-unplayed-layer')).toBeTruthy();
    expect(queryByTestId('soundcloud-waveform-played-layer')).toBeNull();
    expect(queryByTestId('soundcloud-waveform-playhead')).toBeNull();
  });

  test('shows only a straight seekable line until the final waveform is ready', () => {
    const { getByTestId, queryByTestId } = render(
      <SoundCloudWaveformViewport waveform={waveform} ready={false} currentPosition={25_000}
        duration={100_000} isPlaying={false} onSeek={jest.fn()} interactive={false} />,
    );

    expect(getByTestId('soundcloud-waveform-loading-line')).toBeTruthy();
    expect(getByTestId('soundcloud-waveform-loading-played-line')).toBeTruthy();
    expect(queryByTestId('soundcloud-waveform-unplayed-layer')).toBeNull();
    expect(queryByTestId('soundcloud-waveform-played-layer')).toBeNull();
  });
});
