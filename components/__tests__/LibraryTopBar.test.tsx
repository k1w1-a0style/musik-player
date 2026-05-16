import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryTopBar from '../LibraryTopBar';

test('renders default title', () => {
  const { getByText } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByText('K1W1 Music')).toBeTruthy();
});

test('renders custom title', () => {
  const { getByText } = render(<LibraryTopBar title="Meine Musik" onToggleSearch={jest.fn()} onOpenMenu={jest.fn()} />);

  expect(getByText('Meine Musik')).toBeTruthy();
});

test('calls onToggleSearch when search button is pressed', () => {
  const onToggleSearch = jest.fn();
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={onToggleSearch} onOpenMenu={jest.fn()} />);

  fireEvent.press(getByTestId('library-toggle-search'));

  expect(onToggleSearch).toHaveBeenCalledTimes(1);
});

test('calls onOpenMenu when menu button is pressed', () => {
  const onOpenMenu = jest.fn();
  const { getByTestId } = render(<LibraryTopBar onToggleSearch={jest.fn()} onOpenMenu={onOpenMenu} />);

  fireEvent.press(getByTestId('library-open-menu'));

  expect(onOpenMenu).toHaveBeenCalledTimes(1);
});
