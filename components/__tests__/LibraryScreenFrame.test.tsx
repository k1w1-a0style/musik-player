import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render } from '@testing-library/react-native';
import LibraryScreenFrame from '../LibraryScreenFrame';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

test('renders library screen frame with children', () => {
  const screen = render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <LibraryScreenFrame>
        <Text>Frame Child</Text>
      </LibraryScreenFrame>
    </SafeAreaProvider>,
  );

  expect(screen.getByTestId('library-screen')).toBeTruthy();
  expect(screen.getByText('Frame Child')).toBeTruthy();
});
