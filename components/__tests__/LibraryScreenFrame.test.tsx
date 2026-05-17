import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import LibraryScreenFrame from '../LibraryScreenFrame';

test('renders library screen frame with children', () => {
  const screen = render(
    <LibraryScreenFrame>
      <Text>Frame Child</Text>
    </LibraryScreenFrame>,
  );

  expect(screen.getByTestId('library-screen')).toBeTruthy();
  expect(screen.getByText('Frame Child')).toBeTruthy();
});
