import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
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

jest.mock('../../components/AppBackground', () => {
  const { View } = jest.requireActual('react-native');

  return ({ children }: { children: React.ReactNode }) => (
    <View testID="app-background">{children}</View>
  );
});

jest.mock('../../components/Screen', () => {
  const { View } = jest.requireActual('react-native');

  return ({
    children,
    contentStyle,
  }: {
    children: React.ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
  }) => (
    <View testID="screen" style={contentStyle}>
      {children}
    </View>
  );
});

describe('TrackInfoNotFound', () => {
  test('renders the missing track message with the active theme font and color', () => {
    const { getByTestId, getByText } = render(<TrackInfoNotFound />);

    const message = getByTestId('track-info-not-found-message');
    const messageStyle = StyleSheet.flatten(message.props.style);

    expect(getByTestId('app-background')).toBeTruthy();
    expect(getByTestId('screen')).toBeTruthy();
    expect(getByText('Titel nicht gefunden.')).toBeTruthy();
    expect(messageStyle.color).toBe(mockTheme.palette.text.primary);
    expect(messageStyle.fontFamily).toBe(mockTheme.tokens.fonts.heading);
    expect(messageStyle.fontSize).toBe(16);
  });
});
