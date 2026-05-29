import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import AppErrorBoundary from '../AppErrorBoundary';

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

    expect(getByTestId('app-error-boundary-fallback')).toBeTruthy();
    expect(getByText('Bereich konnte nicht geladen werden.')).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LibraryScreen] ErrorBoundary caught an error',
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
