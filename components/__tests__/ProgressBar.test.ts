import React from 'react';
import { PanResponder } from 'react-native';
import { act, render } from '@testing-library/react-native';
import ProgressBar, { clampPlaybackProgressValues, clampRatio, resolveDragRatio, ratioToMillis } from '../ProgressBar';

describe('ProgressBar drag-scrub math', () => {
  test('clampRatio keeps values within 0..1 and guards invalid input', () => {
    expect(clampRatio(-0.5)).toBe(0);
    expect(clampRatio(0.42)).toBe(0.42);
    expect(clampRatio(1.5)).toBe(1);
    expect(clampRatio(Number.NaN)).toBe(0);
  });

  test('resolveDragRatio offsets the start ratio by the horizontal drag distance', () => {
    expect(resolveDragRatio(0.25, 100, 200)).toBeCloseTo(0.75);
    expect(resolveDragRatio(0.8, 100, 200)).toBe(1);
    expect(resolveDragRatio(0.2, -100, 200)).toBeCloseTo(0);
  });

  test('resolveDragRatio falls back to the clamped start ratio for invalid widths', () => {
    expect(resolveDragRatio(0.5, 50, 0)).toBe(0.5);
    expect(resolveDragRatio(1.5, 50, Number.NaN)).toBe(1);
  });

  test('ratioToMillis maps a ratio onto the track duration', () => {
    expect(ratioToMillis(0.5, 60_000)).toBe(30_000);
    expect(ratioToMillis(1.2, 60_000)).toBe(60_000);
    expect(ratioToMillis(0.5, Number.NaN)).toBe(0);
  });
});

describe('ProgressBar playback value guards', () => {
  test('clamps invalid position and duration values to stable display values', () => {
    expect(clampPlaybackProgressValues(Number.NaN, 1000)).toEqual({
      currentPosition: 0,
      duration: 1000,
      progress: 0,
    });
    expect(clampPlaybackProgressValues(-500, 1000)).toEqual({
      currentPosition: 0,
      duration: 1000,
      progress: 0,
    });
    expect(clampPlaybackProgressValues(1500, 1000)).toEqual({
      currentPosition: 1000,
      duration: 1000,
      progress: 100,
    });
    expect(clampPlaybackProgressValues(500, Number.POSITIVE_INFINITY)).toEqual({
      currentPosition: 0,
      duration: 0,
      progress: 0,
    });
  });
});

describe('ProgressBar accessibility actions', () => {
  const renderProgressBar = (props: { currentPosition: number; duration: number; onSeek: (position: number) => void }) => render(
    React.createElement(ProgressBar, props),
  );

  const fireAccessibilityAction = (progressBar: ReturnType<ReturnType<typeof render>['getByTestId']>, actionName: 'increment' | 'decrement') => {
    progressBar.props.onAccessibilityAction({ nativeEvent: { actionName } });
  };

  test('increment calls onSeek with currentPosition plus 10000', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: 20_000, duration: 60_000, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'increment');

    expect(onSeek).toHaveBeenCalledWith(30_000);
  });

  test('decrement calls onSeek with currentPosition minus 10000 clamped to 0', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: 5_000, duration: 60_000, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'decrement');

    expect(onSeek).toHaveBeenCalledWith(0);
  });

  test('increment at the end clamps to duration', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: 55_000, duration: 60_000, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'increment');

    expect(onSeek).toHaveBeenCalledWith(60_000);
  });

  test('does not call onSeek when duration is 0', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: 0, duration: 0, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'increment');

    expect(onSeek).not.toHaveBeenCalled();
  });

  test('does not call onSeek for increment when currentPosition and duration are NaN', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: Number.NaN, duration: Number.NaN, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'increment');

    expect(onSeek).not.toHaveBeenCalled();
  });

  test('increment seeks from safe 0 when currentPosition is NaN and duration is finite', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: Number.NaN, duration: 60_000, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'increment');

    expect(onSeek).toHaveBeenCalledWith(10_000);
  });

  test('does not call onSeek for accessibility actions when duration is NaN', () => {
    const onSeek = jest.fn();
    const { getByTestId } = renderProgressBar({ currentPosition: 30_000, duration: Number.NaN, onSeek });

    fireAccessibilityAction(getByTestId('progress-bar'), 'increment');
    fireAccessibilityAction(getByTestId('progress-bar'), 'decrement');

    expect(onSeek).not.toHaveBeenCalled();
  });

  test('has a playback progress accessibility label', () => {
    const { getByTestId } = renderProgressBar({ currentPosition: 20_000, duration: 60_000, onSeek: jest.fn() });

    expect(getByTestId('progress-bar').props.accessibilityLabel).toBe('Wiedergabe-Fortschritt');
  });
});

describe('ProgressBar drag seek semantics', () => {
  const layout = { nativeEvent: { layout: { width: 200 } } };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    jest.spyOn(PanResponder, 'create').mockImplementation((config) => ({ panHandlers: config }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('move preview and final release commit are separated', () => {
    const onSeek = jest.fn();
    const onSeekPreview = jest.fn();
    const { getByTestId } = render(
      React.createElement(ProgressBar, { currentPosition: 0, duration: 100_000, onSeek, onSeekPreview }),
    );
    const progressBar = getByTestId('progress-bar');

    act(() => {
      progressBar.props.onLayout(layout);
      progressBar.props.onPanResponderGrant({ nativeEvent: { locationX: 20 } });
      progressBar.props.onPanResponderMove({}, { dx: 80 });
      progressBar.props.onPanResponderMove({}, { dx: 120 });
    });

    expect(onSeekPreview).toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();

    act(() => {
      progressBar.props.onPanResponderRelease();
    });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(70_000);
  });

  test('multiple moves do not emit multiple native commits', () => {
    const onSeek = jest.fn();
    const { getByTestId } = render(
      React.createElement(ProgressBar, { currentPosition: 0, duration: 100_000, onSeek }),
    );
    const progressBar = getByTestId('progress-bar');

    act(() => {
      progressBar.props.onLayout(layout);
      progressBar.props.onPanResponderGrant({ nativeEvent: { locationX: 40 } });
      progressBar.props.onPanResponderMove({}, { dx: 20 });
      progressBar.props.onPanResponderMove({}, { dx: 60 });
      progressBar.props.onPanResponderMove({}, { dx: 100 });
    });

    expect(onSeek).not.toHaveBeenCalled();

    act(() => {
      progressBar.props.onPanResponderRelease();
    });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(70_000);
  });
});
