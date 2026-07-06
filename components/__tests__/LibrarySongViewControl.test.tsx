import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySongViewControl from '../LibrarySongViewControl';
const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    error: '#FF6F8A',
    warning: '#FFCA77',
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

describe('LibrarySongViewControl', () => {
  test('shows the current view label', () => {
    const { getByTestId } = render(<LibrarySongViewControl mode="gridSmall" onCycle={jest.fn()} />);
    expect(getByTestId('library-song-view-control-label').props.children).toBe('Klein');
  });

  test('cycles on press', () => {
    const onCycle = jest.fn();
    const { getByTestId } = render(<LibrarySongViewControl mode="list" onCycle={onCycle} />);

    fireEvent.press(getByTestId('library-song-view-control'));

    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
