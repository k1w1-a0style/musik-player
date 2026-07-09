import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import LibrarySongViewControl from '../LibrarySongViewControl';

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

const flattenPressableStyle = (style: unknown) =>
  StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);

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

  test('styles the control from app theme palette and tokens', () => {
    const { getByTestId } = render(<LibrarySongViewControl mode="list" onCycle={jest.fn()} />);

    const controlStyle = flattenPressableStyle(getByTestId('library-song-view-control').props.style);
    const labelStyle = StyleSheet.flatten(getByTestId('library-song-view-control-label').props.style);

    expect(controlStyle.backgroundColor).toBe(mockAppTheme.palette.surfaceGlass);
    expect(controlStyle.borderColor).toBe(mockAppTheme.palette.border);
    expect(controlStyle.borderRadius).toBe(mockAppTheme.tokens.radii.control);
    expect(controlStyle.gap).toBe(mockAppTheme.tokens.spacing.xs + 2);
    expect(controlStyle.paddingHorizontal).toBe(mockAppTheme.tokens.spacing.md - 2);
    expect(labelStyle.color).toBe(mockAppTheme.palette.text.secondary);
    expect(labelStyle.fontFamily).toBe(mockAppTheme.tokens.fonts.body);
  });

  test('cycles on press', () => {
    const onCycle = jest.fn();
    const { getByTestId } = render(<LibrarySongViewControl mode="list" onCycle={onCycle} />);

    fireEvent.press(getByTestId('library-song-view-control'));

    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
