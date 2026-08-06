import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
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

describe('VolumeSlider error handling', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('contains synchronous onVolumeChange failures', () => {
    const failure = new Error('sync volume failure');
    const onVolumeChange = jest.fn(() => {
      throw failure;
    });
    const { getByTestId } = render(
      <VolumeSlider volume={0.5} onVolumeChange={onVolumeChange} />,
    );

    expect(() => {
      fireEvent(getByTestId('volume-slider'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
    }).not.toThrow();

    expect(onVolumeChange).toHaveBeenCalledWith(0.6);
    expect(warnSpy).toHaveBeenCalledWith(
      '[VolumeSlider] Failed to apply volume.',
      failure,
    );
  });

  test('observes rejected onVolumeChange promises', async () => {
    const failure = new Error('async volume failure');
    const onVolumeChange = jest.fn(() => Promise.reject(failure));
    const { getByTestId } = render(
      <VolumeSlider volume={0.5} onVolumeChange={onVolumeChange} />,
    );

    await act(async () => {
      fireEvent(getByTestId('volume-slider'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
      await Promise.resolve();
    });

    expect(onVolumeChange).toHaveBeenCalledWith(0.4);
    expect(warnSpy).toHaveBeenCalledWith(
      '[VolumeSlider] Failed to apply volume.',
      failure,
    );
  });
});
