import React from 'react';
import { Text } from 'react-native';
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
