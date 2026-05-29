import mockReact, { type ReactNode } from 'react';
import { StyleSheet, Text as mockText, View as mockView } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import TabsShell from '../TabsShell';

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children?: ReactNode }) => mockReact.createElement(
      mockView,
      { testID: 'tab-navigator', style: { flex: 1 } },
      children,
    ),
    Screen: ({ name }: { name: string }) => mockReact.createElement(mockText, { testID: `tab-screen-${name}` }, name),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 10, left: 0 }),
}));

jest.mock('../../screens/Library', () => () => mockReact.createElement(mockText, null, 'Library'));
jest.mock('../../screens/Playlists', () => () => mockReact.createElement(mockText, null, 'Playlists'));
jest.mock('../../screens/Equalizer', () => () => mockReact.createElement(mockText, null, 'Equalizer'));
jest.mock('../../screens/Covers', () => () => mockReact.createElement(mockText, null, 'Covers'));
jest.mock('../../components/MiniPlayer', () => () => {
  throw new Error('mini player crash');
});

describe('TabsShell MiniPlayer boundary', () => {
  test('renders compact MiniPlayer fallback without displacing the tab navigator', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { getByTestId, getByText } = render(<TabsShell openNowPlaying={jest.fn()} />);
    const fallbackStyle = StyleSheet.flatten(getByTestId('mini-player-error-boundary-fallback').props.style);

    expect(getByTestId('tab-navigator')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('tab-navigator').props.style).flex).toBe(1);
    expect(getByText('Player konnte nicht geladen werden.')).toBeTruthy();
    expect(fallbackStyle.position).toBe('absolute');
    expect(fallbackStyle.bottom).toBe(82);
    expect(fallbackStyle.flex).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[MiniPlayer] ErrorBoundary caught an error',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('keeps retry/reset available for the MiniPlayer fallback', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getByTestId } = render(<TabsShell openNowPlaying={jest.fn()} />);

    expect(getByTestId('mini-player-error-boundary-fallback')).toBeTruthy();
    fireEvent.press(getByTestId('app-error-boundary-reset'));
    expect(getByTestId('mini-player-error-boundary-fallback')).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[MiniPlayer] ErrorBoundary caught an error',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleErrorSpy.mockRestore();
  });
});
