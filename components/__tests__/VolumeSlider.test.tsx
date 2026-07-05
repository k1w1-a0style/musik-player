import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VolumeSlider from '../VolumeSlider';

jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockSlider(props: Record<string, unknown>) {
    return React.createElement(View, props);
  };
});

describe('VolumeSlider', () => {
  test('exposes adjustable volume semantics and accessibility value', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.42} onVolumeChange={onVolumeChange} />);

    expect(getByTestId('volume-slider').props.accessibilityRole).toBe('adjustable');
    expect(getByTestId('volume-slider').props.accessibilityActions).toEqual([
      { name: 'increment' },
      { name: 'decrement' },
    ]);
    expect(getByTestId('volume-slider').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  });

  test('increments and decrements volume through accessibility actions', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.5} onVolumeChange={onVolumeChange} />);
    const slider = getByTestId('volume-slider');

    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onVolumeChange).toHaveBeenNthCalledWith(1, 0.6);
    expect(onVolumeChange).toHaveBeenNthCalledWith(2, 0.4);
  });

  test('keeps accessibility changes between 0 and 100 percent', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId, rerender } = render(<VolumeSlider volume={0.98} onVolumeChange={onVolumeChange} />);

    fireEvent(getByTestId('volume-slider'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onVolumeChange).toHaveBeenLastCalledWith(1);

    rerender(<VolumeSlider volume={0.02} onVolumeChange={onVolumeChange} />);
    fireEvent(getByTestId('volume-slider'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onVolumeChange).toHaveBeenLastCalledWith(0);
  });

  test('uses native slider callbacks for smooth volume changes', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.25} onVolumeChange={onVolumeChange} />);
    const slider = getByTestId('volume-slider');

    fireEvent(slider, 'slidingStart', 0.25);
    fireEvent(slider, 'valueChange', 0.58);
    fireEvent(slider, 'slidingComplete', 0.6);

    expect(onVolumeChange).toHaveBeenNthCalledWith(1, 0.58);
    expect(onVolumeChange).toHaveBeenNthCalledWith(2, 0.6);
  });

  test('keeps the slider visually inline without adding a card frame', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId, queryByTestId } = render(<VolumeSlider volume={0.4} onVolumeChange={onVolumeChange} accentColor="#ff00aa" />);

    expect(queryByTestId('glass-card')).toBeNull();
    expect(getByTestId('volume-slider')).toBeTruthy();
  });

  test('passes the accent color to the native slider track and thumb', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.4} onVolumeChange={onVolumeChange} accentColor="#ff00aa" />);
    const slider = getByTestId('volume-slider');

    expect(slider.props.minimumTrackTintColor).toBe('#ff00aa');
    expect(slider.props.thumbTintColor).toBe('#ff00aa');
  });

});