import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VolumeSlider from '../VolumeSlider';

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

  test('keeps touch based volume changes working', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.25} onVolumeChange={onVolumeChange} />);
    const slider = getByTestId('volume-slider');

    fireEvent(slider, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(slider, 'responderGrant', { nativeEvent: { locationX: 50 } });
    fireEvent(slider, 'responderMove', { nativeEvent: { locationX: 300 } });

    expect(onVolumeChange).toHaveBeenNthCalledWith(1, 0.25);
    expect(onVolumeChange).toHaveBeenNthCalledWith(2, 1);
  });
});
