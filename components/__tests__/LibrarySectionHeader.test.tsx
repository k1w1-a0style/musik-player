import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import LibrarySectionHeader from '../LibrarySectionHeader';

test('renders header title', () => {
  const { getByText } = render(<LibrarySectionHeader title="Alben" />);

  expect(getByText('Alben')).toBeTruthy();
});

test('renders header count', () => {
  const { getByText } = render(<LibrarySectionHeader title="Ordner" count="2 aktiv" />);

  expect(getByText('2 aktiv')).toBeTruthy();
});

test('renders header action content', () => {
  const { getByText } = render(
    <LibrarySectionHeader title="Tracks" count="5">
      <Text>Header Action</Text>
    </LibrarySectionHeader>,
  );

  expect(getByText('Header Action')).toBeTruthy();
});
