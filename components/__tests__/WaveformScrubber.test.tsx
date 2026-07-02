import React from 'react';
import { act, render } from '@testing-library/react-native';
import WaveformScrubber from '../WaveformScrubber';

const waveform = {
  version: 1,
  source: 'fallback' as const,
  sourceKey: 'test-waveform',
  generatedAt: 1_782_950_400_000,
  durationMs: 100_000,
  points: [0.2, 0.6, 0.4, 0.8],
};

const layout = { nativeEvent: { layout: { width: 200 } } };
const touchAt = (locationX: number) => ({ nativeEvent: { locationX } });

describe('WaveformScrubber seek semantics', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('grant plus multiple moves and release emits one final seek commit', () => {
    const onSeek = jest.fn();
    const onSeekPreview = jest.fn();
    const { getByTestId } = render(
      <WaveformScrubber
        waveform={waveform}
        currentPosition={0}
        duration={100_000}
        onSeek={onSeek}
        onSeekPreview={onSeekPreview}
        accent="red"
      />,
    );
    const scrubber = getByTestId('waveform-scrubber').findByProps({ accessibilityRole: 'adjustable' });

    act(() => {
      scrubber.props.onLayout(layout);
      scrubber.props.onResponderGrant(touchAt(20));
      scrubber.props.onResponderMove(touchAt(80));
      scrubber.props.onResponderMove(touchAt(120));
      scrubber.props.onResponderMove(touchAt(160));
    });

    expect(onSeek).not.toHaveBeenCalled();

    act(() => {
      scrubber.props.onResponderRelease();
    });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(80_000);
  });

  test('preview callback is separate from the native seek commit callback', () => {
    const onSeek = jest.fn();
    const onSeekPreview = jest.fn();
    const { getByTestId } = render(
      <WaveformScrubber
        waveform={waveform}
        currentPosition={0}
        duration={100_000}
        onSeek={onSeek}
        onSeekPreview={onSeekPreview}
        accent="red"
      />,
    );
    const scrubber = getByTestId('waveform-scrubber').findByProps({ accessibilityRole: 'adjustable' });

    act(() => {
      scrubber.props.onLayout(layout);
      scrubber.props.onResponderGrant(touchAt(100));
    });

    expect(onSeekPreview).toHaveBeenCalledWith(50_000);
    expect(onSeek).not.toHaveBeenCalled();
  });

  test('dragging updates the local displayed position before commit', () => {
    const { getByTestId, getAllByText } = render(
      <WaveformScrubber
        waveform={waveform}
        currentPosition={0}
        duration={100_000}
        onSeek={jest.fn()}
        accent="red"
      />,
    );
    const scrubber = getByTestId('waveform-scrubber').findByProps({ accessibilityRole: 'adjustable' });

    act(() => {
      scrubber.props.onLayout(layout);
      scrubber.props.onResponderGrant(touchAt(100));
    });

    expect(getAllByText('0:50').length).toBeGreaterThan(0);
  });
});
