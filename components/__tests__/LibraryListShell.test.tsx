import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { MiniPlayerViewportProvider, useMiniPlayerViewport } from '../../contexts/MiniPlayerViewportContext';
import { render } from '@testing-library/react-native';
import LibraryListShell from '../LibraryListShell';

test('renders children', () => {
  const { getByText } = render(
    <LibraryListShell>
      <Text>Shell Content</Text>
    </LibraryListShell>,
  );

  expect(getByText('Shell Content')).toBeTruthy();
});

test('uses custom test id', () => {
  const { getByTestId } = render(
    <LibraryListShell testID="custom-shell">
      <Text>Content</Text>
    </LibraryListShell>,
  );

  expect(getByTestId('custom-shell')).toBeTruthy();
});

const MeasureOverlay = ({ height }: { height: number }) => {
  const { reportHeight } = useMiniPlayerViewport();
  return <Pressable testID="measure-overlay" onPress={() => reportHeight(height)} />;
};

test.each([
  { safeBottom: 0, height: 64 },
  { safeBottom: 24, height: 78 },
])('keeps the panel scroll viewport full height with an overlay of $height dp', ({ safeBottom, height }) => {
  const screen = render(<SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom: safeBottom }}>
    <MiniPlayerViewportProvider safeAreaBottom={safeBottom}>
      <MeasureOverlay height={height} />
      <LibraryListShell><Text>Scrollable list viewport</Text></LibraryListShell>
    </MiniPlayerViewportProvider>
  </SafeAreaInsetsContext.Provider>);
  fireEvent.press(screen.getByTestId('measure-overlay'));
  const style = StyleSheet.flatten(screen.getByTestId('library-list-shell').props.style);
  expect(style.backgroundColor).toBeTruthy();
  expect(style.marginBottom ?? 0).toBe(0);
  expect(style.paddingBottom ?? 0).toBe(0);
});

test('keeps the empty-player scroll viewport unreserved', () => {
  const screen = render(<SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom: 24 }}>
    <MiniPlayerViewportProvider safeAreaBottom={24}>
      <LibraryListShell><Text>No active song</Text></LibraryListShell>
    </MiniPlayerViewportProvider>
  </SafeAreaInsetsContext.Provider>);
  const style = StyleSheet.flatten(screen.getByTestId('library-list-shell').props.style);
  expect(style.marginBottom ?? 0).toBe(0);
  expect(style.paddingBottom ?? 0).toBe(0);
});
