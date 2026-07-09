import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import TrackInfoNotFound from '../TrackInfoNotFound';
import { getAppTheme } from '../../utils/appTheme';

const expectedTheme = getAppTheme('light', 'neon-cover');

jest.mock('../../contexts/AppThemeContext', () => {
  const { getAppTheme } = jest.requireActual('../../utils/appTheme');
  const theme = getAppTheme('light', 'neon-cover');

  return {
    useAppTheme: () => ({
      appearance: 'light',
      skin: 'neon-cover',
      theme,
      isHydrated: true,
      setAppearance: jest.fn(),
      setSkin: jest.fn(),
    }),
  };
});

jest.mock('../../components/AppBackground', () => ({ children }: any) => children);
jest.mock('../../components/Screen', () => ({ children }: any) => children);

describe('TrackInfoNotFound', () => {
  test('renders the missing track message with the active theme font and color', () => {
    const { getByText } = render(<TrackInfoNotFound />);

    const message = getByText('Titel nicht gefunden.');
    const messageStyle = StyleSheet.flatten(message.props.style);

    expect(messageStyle.color).toBe(expectedTheme.palette.text.primary);
    expect(messageStyle.fontFamily).toBe(expectedTheme.tokens.fonts.heading);
    expect(messageStyle.fontSize).toBe(16);
  });
});
