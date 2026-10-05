import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import NowPlayingBackdrop from '../NowPlayingBackdrop';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: { appearance: 'dark' },
  }),
}));

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

describe('NowPlayingBackdrop', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('crossfades the previous artwork and palette instead of switching abruptly', () => {
    let finish: ((result: { finished: boolean }) => void) | undefined;
    const timing = jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => ({
      start: (callback?: (result: { finished: boolean }) => void) => { finish = callback; },
      stop: jest.fn(),
      reset: jest.fn(),
      _config: config,
    }) as Animated.CompositeAnimation);
    const { getByTestId, queryByTestId, rerender } = render(
      <NowPlayingBackdrop gradientColors={['#111111', '#222222']} accent="#333333"
        glowLeft={20} artworkUri="file:///one.jpg" />,
    );

    rerender(<NowPlayingBackdrop gradientColors={['#444444', '#555555']} accent="#666666"
      glowLeft={20} artworkUri="file:///two.jpg" paletteLoading />);

    expect(getByTestId('now-playing-cover-backdrop').props.source).toEqual({ uri: 'file:///two.jpg' });
    expect(getByTestId('now-playing-cover-backdrop-outgoing').props.source)
      .toEqual({ uri: 'file:///one.jpg' });
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 1,
      delay: 0,
      duration: 1000,
      useNativeDriver: true,
    }));

    act(() => finish?.({ finished: true }));

    expect(queryByTestId('now-playing-cover-backdrop-outgoing')).toBeNull();
  });

  test('retargets a rapid cover change without waiting for the old fade', () => {
    const finishes: Array<(result: { finished: boolean }) => void> = [];
    let transition!: Animated.Value;
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(value => {
      transition = value as Animated.Value;
      return { start: callback => { if (callback) finishes.push(callback); },
        stop: jest.fn(), reset: jest.fn() };
    });
    const backdrop = (artwork: string, color: string) => (
      <NowPlayingBackdrop gradientColors={[color, '#111111']} accent={color}
        glowLeft={20} artworkUri={`file:///${artwork}.jpg`} />);
    const { rerender, getByTestId, queryByTestId } = render(backdrop('one', '#111111'));
    rerender(backdrop('two', '#222222'));
    act(() => transition.setValue(0.5));
    rerender(backdrop('three', '#333333'));
    expect(timing).toHaveBeenCalledTimes(2);
    expect(getByTestId('now-playing-cover-backdrop').props.source.uri).toBe('file:///three.jpg');
    expect(getByTestId('now-playing-cover-backdrop-outgoing').props.source.uri).toBe('file:///one.jpg');
    expect(getByTestId('now-playing-cover-backdrop-outgoing-1').props.source.uri).toBe('file:///two.jpg');
    expect(StyleSheet.flatten(getByTestId('now-playing-cover-backdrop-outgoing-1-layer').props.style).opacity).toBe(0.5);
    act(() => finishes[0]({ finished: true }));
    expect(queryByTestId('now-playing-cover-backdrop-outgoing')).not.toBeNull();
    act(() => finishes[1]({ finished: true }));
    expect(queryByTestId('now-playing-cover-backdrop-outgoing')).toBeNull();
  });

  test('attaches both artwork layers before starting the native background fade', () => {
    const mountedAtStart: boolean[] = [];
    const view = render(<NowPlayingBackdrop gradientColors={['#111111', '#222222']}
      accent="#333333" glowLeft={20} artworkUri="file:///one.jpg" />);
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: jest.fn(() => mountedAtStart.push(Boolean(
        view.queryByTestId('now-playing-cover-backdrop-outgoing')
        && view.getByTestId('now-playing-cover-backdrop').props.source.uri === 'file:///two.jpg',
      ))),
      stop: jest.fn(), reset: jest.fn(),
    }));

    view.rerender(<NowPlayingBackdrop gradientColors={['#444444', '#555555']}
      accent="#666666" glowLeft={20} artworkUri="file:///two.jpg" />);

    expect(mountedAtStart).toEqual([true]);
  });

  test('keeps the old color opaque beneath the incoming color at the blend midpoint', () => {
    let transition!: Animated.Value;
    jest.spyOn(Animated, 'timing').mockImplementation(value => {
      transition = value as Animated.Value;
      return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    });
    const view = render(<NowPlayingBackdrop gradientColors={['#111111', '#222222']}
      accent="#333333" glowLeft={20} artworkUri="file:///one.jpg" />);
    view.rerender(<NowPlayingBackdrop gradientColors={['#444444', '#555555']}
      accent="#666666" glowLeft={20} artworkUri="file:///two.jpg" />);
    act(() => transition.setValue(0.5));
    expect(StyleSheet.flatten(view.getByTestId('now-playing-cover-backdrop-outgoing-layer').props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(view.getByTestId('now-playing-cover-backdrop-layer').props.style).opacity).toBe(0.5);
  });
});
