import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VolumeSlider from '../VolumeSlider';
const mockAppTheme = {
  palette: {
    background: '#08090B',
    surfaceElevated: '#191B21',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
    primary: '#D8DEE8',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
      onPrimary: '#07090C',
    },
  },
};

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

  test('ignores unsupported accessibility actions', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.5} onVolumeChange={onVolumeChange} />);

    fireEvent(getByTestId('volume-slider'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onVolumeChange).not.toHaveBeenCalled();
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

  test('normalizes nonfinite volume before accessibility stepping', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={Number.NaN} onVolumeChange={onVolumeChange} />);
    const slider = getByTestId('volume-slider');

    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onVolumeChange).toHaveBeenNthCalledWith(1, 1);
    expect(onVolumeChange).toHaveBeenNthCalledWith(2, 0.9);
  });

  test('uses stable touch based volume changes from absolute page coordinates', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.25} onVolumeChange={onVolumeChange} />);
    const slider = getByTestId('volume-slider');

    fireEvent(slider, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(slider, 'responderGrant', { nativeEvent: { pageX: 50 } });
    fireEvent(slider, 'responderMove', { nativeEvent: { pageX: 240 } });

    expect(onVolumeChange).toHaveBeenNthCalledWith(1, 0.25);
    expect(onVolumeChange).toHaveBeenNthCalledWith(2, 1);
  });

  test('falls back to local touch coordinates when pageX is unavailable', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.25} onVolumeChange={onVolumeChange} />);
    const slider = getByTestId('volume-slider');

    fireEvent(slider, 'layout', { nativeEvent: { layout: { width: 200 } } });
    fireEvent(slider, 'responderGrant', { nativeEvent: { locationX: 80 } });

    expect(onVolumeChange).toHaveBeenCalledWith(0.4);
  });

  test('falls back to the current volume for invalid touch coordinates', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.3} onVolumeChange={onVolumeChange} />);

    fireEvent(getByTestId('volume-slider'), 'responderGrant', {
      nativeEvent: { pageX: Number.NaN, locationX: Number.POSITIVE_INFINITY },
    });

    expect(onVolumeChange).toHaveBeenCalledWith(0.3);
  });

  test('keeps the slider visually inline without adding a card frame', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId, queryByTestId } = render(<VolumeSlider volume={0.4} onVolumeChange={onVolumeChange} accentColor="#ff00aa" />);

    expect(queryByTestId('glass-card')).toBeNull();
    expect(getByTestId('volume-slider')).toBeTruthy();
  });

  test('passes the accent color to the active track and thumb', () => {
    const onVolumeChange = jest.fn();
    const { getByTestId } = render(<VolumeSlider volume={0.4} onVolumeChange={onVolumeChange} accentColor="#ff00aa" />);

    expect(getByTestId('volume-track-active').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: '#ff00aa' })]));
    expect(getByTestId('volume-thumb').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: '#ff00aa' })]));
  });
});
