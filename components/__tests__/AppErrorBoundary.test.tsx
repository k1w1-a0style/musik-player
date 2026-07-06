import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AppErrorBoundary from '../AppErrorBoundary';
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

const mockAppThemeContextValue = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: () => undefined,
  setSkin: () => undefined,
  theme: mockAppTheme,
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppThemeContextValue,
  useOptionalAppTheme: () => mockAppThemeContextValue,
}));

const AlwaysCrash: React.FC = () => {
  throw new Error('boom');
};

let mountCount = 0;
const CrashableTree: React.FC = () => {
  const [shouldCrash, setShouldCrash] = React.useState(false);

  React.useEffect(() => {
    mountCount += 1;
  }, []);

  if (shouldCrash) throw new Error('crash on demand');

  return (
    <Pressable testID="trigger-crash" onPress={() => setShouldCrash(true)}>
      <Text testID="tree-ok">ok</Text>
    </Pressable>
  );
};

describe('AppErrorBoundary', () => {
  test('shows fallback and logs console.error when a child throws', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { getByTestId, getByText } = render(
      <AppErrorBoundary fallbackMessage="Bereich konnte nicht geladen werden." logPrefix="[LibraryScreen] ErrorBoundary caught an error">
        <AlwaysCrash />
      </AppErrorBoundary>,
    );

    const fallback = getByTestId('app-error-boundary-fallback');

    expect(fallback).toBeTruthy();
    expect(StyleSheet.flatten(fallback.props.style).flex).toBe(1);
    expect(getByText('Bereich konnte nicht geladen werden.')).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LibraryScreen] ErrorBoundary caught an error',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleErrorSpy.mockRestore();
  });

  test('compact variant renders an absolute non-flex fallback', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { getByTestId, getByText } = render(
      <AppErrorBoundary
        fallbackMessage="Player konnte nicht geladen werden."
        logPrefix="[MiniPlayer] ErrorBoundary caught an error"
        testID="mini-player-error-boundary-fallback"
        variant="compact"
        fallbackContainerStyle={{ bottom: 82 }}
      >
        <AlwaysCrash />
      </AppErrorBoundary>,
    );

    const fallbackStyle = StyleSheet.flatten(getByTestId('mini-player-error-boundary-fallback').props.style);

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

  test('reset button clears fallback and remounts children', () => {
    mountCount = 0;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getByTestId, queryByTestId } = render(
      <AppErrorBoundary>
        <CrashableTree />
      </AppErrorBoundary>,
    );

    expect(getByTestId('tree-ok')).toBeTruthy();
    fireEvent.press(getByTestId('trigger-crash'));
    expect(getByTestId('app-error-boundary-fallback')).toBeTruthy();

    fireEvent.press(getByTestId('app-error-boundary-reset'));

    expect(queryByTestId('app-error-boundary-fallback')).toBeNull();
    expect(getByTestId('tree-ok')).toBeTruthy();
    expect(mountCount).toBeGreaterThanOrEqual(2);

    consoleErrorSpy.mockRestore();
  });
});
