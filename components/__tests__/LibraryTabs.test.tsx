import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryTabs from '../LibraryTabs';

test('renders library tabs', () => {
  const { getByText } = render(<LibraryTabs activeTab="tracks" onChangeTab={jest.fn()} />);

  expect(getByText('Tracks')).toBeTruthy();
  expect(getByText('Alben')).toBeTruthy();
  expect(getByText('Interpreten')).toBeTruthy();
});

test('marks active tab as selected', () => {
  const { getByTestId } = render(<LibraryTabs activeTab="albums" onChangeTab={jest.fn()} />);

  expect(getByTestId('library-tab-albums').props.accessibilityState.selected).toBe(true);
  expect(getByTestId('library-tab-tracks').props.accessibilityState.selected).toBe(false);
});

test('calls onChangeTab when tab is pressed', () => {
  const onChangeTab = jest.fn();
  const { getByTestId } = render(<LibraryTabs activeTab="tracks" onChangeTab={onChangeTab} />);

  fireEvent.press(getByTestId('library-tab-playlists'));

  expect(onChangeTab).toHaveBeenCalledWith('playlists');
});
