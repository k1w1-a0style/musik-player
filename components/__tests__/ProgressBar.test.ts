import React from 'react';
import { render } from '@testing-library/react-native';
import ProgressBar, { clampPlaybackProgressValues } from '../ProgressBar';

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

  test('has a playback progress accessibility label', () => {
    const { getByTestId } = renderProgressBar({ currentPosition: 20_000, duration: 60_000, onSeek: jest.fn() });

    expect(getByTestId('progress-bar').props.accessibilityLabel).toBe('Wiedergabe-Fortschritt');
  });
});
