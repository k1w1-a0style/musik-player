import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import MiniPlayerProgress from '../MiniPlayerProgress';

let mockReduceMotion = false;
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduceMotion }));
jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { border: '#333', primary: '#fff' } } }),
}));

beforeEach(() => { mockReduceMotion = false; });
afterEach(() => { jest.restoreAllMocks(); });

const readValue = (value: Animated.Value) => (value as Animated.Value & { __getValue(): number }).__getValue();

const captureMotion = () => {
  let value!: Animated.Value;
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(next => {
    value = next as Animated.Value;
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  });
  return { timing, value: () => value };
};

test('interpolates a measured fixed-width fill on the native driver between shared polls', () => {
  const motion = captureMotion();
  const view = render(<MiniPlayerProgress progress={0.25} duration={100_000} isAdvancing songId="a" />);
  fireEvent(view.getByTestId('mini-player-progress'), 'layout', { nativeEvent: { layout: { width: 200 } } });
  expect(StyleSheet.flatten(view.getByTestId('mini-player-progress-fill').props.style).width).toBe('100%');
  expect(StyleSheet.flatten(view.getByTestId('mini-player-progress-motion').props.style).transform)
    .toEqual([{ translateX: -150 }]);
  expect(motion.timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
    toValue: 0.255, duration: 500, useNativeDriver: true, isInteraction: false,
  }));
});

test('freezes the visible progress on pause and corrects forward and backward seeks on the next sample', () => {
  const motion = captureMotion();
  const view = render(<MiniPlayerProgress progress={0.25} duration={100_000} isAdvancing songId="a" />);
  act(() => motion.value().setValue(0.252));
  view.rerender(<MiniPlayerProgress progress={0.25} duration={100_000} songId="a" />);
  expect(readValue(motion.value())).toBe(0.252);
  view.rerender(<MiniPlayerProgress progress={0.8} duration={100_000} songId="a" />);
  expect(readValue(motion.value())).toBe(0.8);
  view.rerender(<MiniPlayerProgress progress={0.1} duration={100_000} songId="a" />);
  expect(readValue(motion.value())).toBe(0.1);
  expect(motion.timing).toHaveBeenCalledTimes(1);
});

test('resets stale progress on track change and accepts the new poll', () => {
  const motion = captureMotion();
  const view = render(<MiniPlayerProgress progress={0.7} duration={100_000} isAdvancing songId="a" />);
  view.rerender(<MiniPlayerProgress progress={0.7} duration={100_000} isAdvancing songId="b" />);
  expect(readValue(motion.value())).toBe(0);
  view.rerender(<MiniPlayerProgress progress={0.02} duration={200_000} isAdvancing songId="b" />);
  expect(readValue(motion.value())).toBe(0.02);
  expect(motion.timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.0225 }));
});

test('does not predict progress for unknown duration, finished playback, or reduced motion', () => {
  const motion = captureMotion();
  const view = render(<MiniPlayerProgress progress={0} isAdvancing songId="a" />);
  view.rerender(<MiniPlayerProgress progress={1} duration={100_000} isAdvancing songId="a" />);
  mockReduceMotion = true;
  view.rerender(<MiniPlayerProgress progress={0.2} duration={100_000} isAdvancing songId="a" />);
  expect(motion.timing).not.toHaveBeenCalled();
});

test('stops an active interpolation when reduced motion is enabled', () => {
  const motion = captureMotion();
  const stop = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
  const view = render(<MiniPlayerProgress progress={0.2} duration={100_000} isAdvancing songId="a" />);
  mockReduceMotion = true;
  view.rerender(<MiniPlayerProgress progress={0.2} duration={100_000} isAdvancing songId="a" />);
  expect(motion.timing).toHaveBeenCalledTimes(1);
  expect(stop).toHaveBeenCalled();
  expect(readValue(motion.value())).toBe(0.2);
});
