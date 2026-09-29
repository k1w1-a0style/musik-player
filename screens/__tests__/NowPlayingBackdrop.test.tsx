import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Animated } from 'react-native';
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

    expect(getByTestId('now-playing-cover-backdrop').props.source).toEqual({ uri: 'file:///one.jpg' });
    expect(queryByTestId('now-playing-cover-backdrop-outgoing')).toBeNull();
    expect(timing).not.toHaveBeenCalled();

    rerender(<NowPlayingBackdrop gradientColors={['#444444', '#555555']} accent="#666666"
      glowLeft={20} artworkUri="file:///two.jpg" paletteLoading={false} />);

    expect(getByTestId('now-playing-cover-backdrop').props.source).toEqual({ uri: 'file:///two.jpg' });
    expect(getByTestId('now-playing-cover-backdrop-outgoing').props.source)
      .toEqual({ uri: 'file:///one.jpg' });
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 1,
      delay: 120,
      duration: 760,
      useNativeDriver: true,
    }));

    act(() => finish?.({ finished: true }));

    expect(queryByTestId('now-playing-cover-backdrop-outgoing')).toBeNull();
  });

  test('does not reset an unfinished background blend on a rapid track change', () => {
    const finishes: Array<(result: { finished: boolean }) => void> = [];
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: callback => { if (callback) finishes.push(callback); },
      stop: jest.fn(), reset: jest.fn(),
    }));
    const backdrop = (artwork: string, color: string) => (
      <NowPlayingBackdrop gradientColors={[color, '#111111']} accent={color}
        glowLeft={20} artworkUri={`file:///${artwork}.jpg`} />
    );
    const { rerender, getByTestId, queryByTestId } = render(backdrop('one', '#111111'));
    rerender(backdrop('two', '#222222'));
    rerender(backdrop('three', '#333333'));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(getByTestId('now-playing-cover-backdrop').props.source.uri).toBe('file:///two.jpg');
    expect(getByTestId('now-playing-cover-backdrop-outgoing').props.source.uri).toBe('file:///one.jpg');

    act(() => finishes[0]({ finished: true }));
    expect(timing).toHaveBeenCalledTimes(2);
    expect(getByTestId('now-playing-cover-backdrop').props.source.uri).toBe('file:///three.jpg');
    expect(getByTestId('now-playing-cover-backdrop-outgoing').props.source.uri).toBe('file:///two.jpg');

    act(() => finishes[1]({ finished: true }));
    expect(queryByTestId('now-playing-cover-backdrop-outgoing')).toBeNull();
  });
});
