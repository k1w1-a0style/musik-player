import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import CrossfadeLayers, {
  PLAYER_COLOR_CROSSFADE_DELAY_MS,
  PLAYER_COLOR_CROSSFADE_MS,
} from '../CrossfadeLayers';

let mockReduceMotion = false;

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReduceMotion,
}));

const renderValue = (value: string) => <Text testID={`value-${value}`}>{value}</Text>;

describe('CrossfadeLayers', () => {
  beforeEach(() => {
    mockReduceMotion = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('gives absolute overlays full bounds without changing flow-sized content', () => {
    const { getByTestId, rerender } = render(
      <CrossfadeLayers value="red" valueKey="red" renderLayer={renderValue} testID="overlay" fill />,
    );
    expect(StyleSheet.flatten(getByTestId('overlay').props.style))
      .toMatchObject({ position: 'absolute', top: 0, bottom: 0 });
    expect(StyleSheet.flatten(getByTestId('overlay-active').props.style))
      .toMatchObject({ position: 'absolute', top: 0, bottom: 0 });
    rerender(<CrossfadeLayers value="red" valueKey="red" renderLayer={renderValue} testID="overlay" />);
    expect(StyleSheet.flatten(getByTestId('overlay-active').props.style).position).toBeUndefined();
  });

  test('keeps an outgoing visual layer while the incoming value fades in', () => {
    let finish: ((result: { finished: boolean }) => void) | undefined;
    jest.spyOn(Animated, 'timing').mockImplementation((_value, _config) => ({
      start: callback => {
        finish = callback;
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }) as Animated.CompositeAnimation);
    const { getByTestId, queryByTestId, rerender } = render(
      <CrossfadeLayers value="red" valueKey="red" renderLayer={renderValue}
        testID="color-transition" />,
    );

    expect(getByTestId('value-red')).toBeTruthy();
    expect(queryByTestId('color-transition-outgoing')).toBeNull();

    rerender(<CrossfadeLayers value="blue" valueKey="blue" renderLayer={renderValue}
      testID="color-transition" />);

    expect(getByTestId('color-transition-outgoing', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('value-red', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('value-blue')).toBeTruthy();
    expect(Animated.timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      delay: PLAYER_COLOR_CROSSFADE_DELAY_MS,
      duration: PLAYER_COLOR_CROSSFADE_MS,
      useNativeDriver: true,
    }));

    act(() => finish?.({ finished: true }));
    expect(queryByTestId('color-transition-outgoing')).toBeNull();
    expect(queryByTestId('value-red')).toBeNull();
    expect(getByTestId('value-blue')).toBeTruthy();
  });

  test('switches without an outgoing layer when reduced motion is enabled', () => {
    mockReduceMotion = true;
    const timing = jest.spyOn(Animated, 'timing');
    const { getByTestId, queryByTestId, rerender } = render(
      <CrossfadeLayers value="red" valueKey="red" renderLayer={renderValue}
        testID="color-transition" />,
    );

    rerender(<CrossfadeLayers value="blue" valueKey="blue" renderLayer={renderValue}
      testID="color-transition" />);

    expect(queryByTestId('color-transition-outgoing')).toBeNull();
    expect(getByTestId('value-blue')).toBeTruthy();
    expect(timing).not.toHaveBeenCalled();
  });
});
