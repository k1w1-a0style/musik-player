import React from 'react';
import { act, render } from '@testing-library/react-native';
import WaveformScrubber from '../WaveformScrubber';
import { Path } from 'react-native-svg';
import { getAppTheme } from '../../utils/appTheme';
import { WAVEFORM_VERSION } from '../../utils/waveformTypes';
let mockAppTheme = getAppTheme('dark', 'graphite');

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: () => undefined,
    setSkin: () => undefined,
    theme: mockAppTheme,
  }),
}));

const waveform = {
  version: WAVEFORM_VERSION,
  source: 'fallback' as const,
  sourceKey: 'test-waveform',
  sourceFingerprint: 'wf6:00000000000000000000000000000001',
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

  test('responder termination cancels the preview without committing a seek', () => {
    const onSeek = jest.fn();
    const { getByTestId, getAllByText } = render(
      <WaveformScrubber
        waveform={waveform}
        currentPosition={10_000}
        duration={100_000}
        onSeek={onSeek}
        accent="red"
      />,
    );
    const scrubber = getByTestId('waveform-scrubber').findByProps({ accessibilityRole: 'adjustable' });

    act(() => {
      scrubber.props.onLayout(layout);
      scrubber.props.onResponderGrant(touchAt(160));
      scrubber.props.onResponderTerminate();
    });

    expect(onSeek).not.toHaveBeenCalled();
    expect(getAllByText('0:10').length).toBeGreaterThan(0);
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

  test('keeps bar colors static and moves the lightweight played clip during drag', () => {
    const { getByTestId, UNSAFE_getAllByType } = render(
      <WaveformScrubber waveform={waveform} currentPosition={10_000} duration={100_000}
        onSeek={jest.fn()} accent="red" />,
    );
    const scrubber = getByTestId('waveform-scrubber').findByProps({ accessibilityRole: 'adjustable' });

    act(() => {
      scrubber.props.onLayout(layout);
    });
    const strokesBeforeDrag = UNSAFE_getAllByType(Path).map(path => path.props.stroke);

    act(() => {
      scrubber.props.onResponderGrant(touchAt(20));
      scrubber.props.onResponderMove(touchAt(160));
    });

    expect(UNSAFE_getAllByType(Path).map(path => path.props.stroke)).toEqual(strokesBeforeDrag);
    expect(getByTestId('waveform-rest-layer')).toBeTruthy();
    expect(getByTestId('waveform-played-layer')).toBeTruthy();
    expect(getByTestId('waveform-played-clip')).toBeTruthy();
  });

  test('renders one stable line and no provisional bars while the waveform is loading', () => {
    const { getByTestId, queryByTestId } = render(
      <WaveformScrubber waveform={waveform} ready={false} currentPosition={10_000}
        duration={100_000} onSeek={jest.fn()} accent="red" />,
    );

    expect(getByTestId('waveform-loading-line')).toBeTruthy();
    expect(getByTestId('waveform-loading-played-line')).toBeTruthy();
    expect(queryByTestId('waveform-rest-layer')).toBeNull();
    expect(queryByTestId('waveform-played-layer')).toBeNull();
  });

  test('uses app theme rest and time colors while preserving seek behavior', () => {
    mockAppTheme = getAppTheme('light', 'graphite');
    const onSeek = jest.fn();
    const onSeekPreview = jest.fn();
    const { getByTestId, getAllByText, UNSAFE_getAllByType } = render(
      <WaveformScrubber
        waveform={waveform}
        currentPosition={25_000}
        duration={100_000}
        onSeek={onSeek}
        onSeekPreview={onSeekPreview}
        accent="#33B5FF"
      />,
    );

    expect(JSON.stringify(getAllByText('0:25')[0].props.style)).toContain(mockAppTheme.palette.text.muted);
    expect(JSON.stringify(getAllByText('1:40')[0].props.style)).toContain(mockAppTheme.palette.text.muted);
    expect(UNSAFE_getAllByType(Path).map(path => path.props.stroke)).toContain(mockAppTheme.palette.borderStrong);

    const scrubber = getByTestId('waveform-scrubber').findByProps({ accessibilityRole: 'adjustable' });
    act(() => {
      scrubber.props.onLayout(layout);
      scrubber.props.onResponderGrant(touchAt(100));
      scrubber.props.onResponderRelease();
    });

    expect(onSeekPreview).toHaveBeenCalledWith(50_000);
    expect(onSeek).toHaveBeenCalledWith(50_000);
    mockAppTheme = getAppTheme('dark', 'graphite');
  });
});
