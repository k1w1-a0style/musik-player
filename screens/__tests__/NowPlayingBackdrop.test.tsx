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
});
