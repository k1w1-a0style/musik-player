import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySortControl from '../LibrarySortControl';

const mockAppTheme = {
  tokens: {
    spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
    radii: { input: 10, card: 14, elevatedCard: 20, control: 18 },
    fonts: { display: 'Bricolage-Bold', heading: 'Bricolage-SemiBold', body: 'Bricolage-Regular' },
  },
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

describe('LibrarySortControl', () => {
  test('shows the current sort label', () => {
    const { getByTestId } = render(<LibrarySortControl mode="year" onCycle={jest.fn()} />);
    expect(getByTestId('library-sort-control-label').props.children).toBe('Jahr');
  });

  test('cycles on press', () => {
    const onCycle = jest.fn();
    const { getByTestId } = render(<LibrarySortControl mode="alphabet" onCycle={onCycle} />);

    fireEvent.press(getByTestId('library-sort-control'));

    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
