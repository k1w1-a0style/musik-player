import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import TrackInfoNotFound from '../TrackInfoNotFound';
import { getAppTheme } from '../../utils/appTheme';

const mockTheme = getAppTheme('light', 'neon-cover');

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'light',
    skin: 'neon-cover',
    theme: mockTheme,
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

jest.mock('../../components/AppBackground', () => ({ children }: any) => children);
jest.mock('../../components/Screen', () => ({ children }: any) => children);

describe('TrackInfoNotFound', () => {
  test('renders the missing track message with the active theme font and color', () => {
    const { getByText } = render(<TrackInfoNotFound />);

    const message = getByText('Titel nicht gefunden.');
    const messageStyle = StyleSheet.flatten(message.props.style);

    expect(messageStyle.color).toBe(mockTheme.palette.text.primary);
    expect(messageStyle.fontFamily).toBe(mockTheme.tokens.fonts.heading);
    expect(messageStyle.fontSize).toBe(16);
  });
});
