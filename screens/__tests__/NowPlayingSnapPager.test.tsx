import React from 'react';
import { FlatList, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingSnapPager from '../NowPlayingSnapPager';

const renderPager = (onPageChange?: jest.Mock) => render(
  <NowPlayingSnapPager
    pageHeight={600}
    renderPlayerPage={() => <Text testID="player-content">player</Text>}
    renderDetailsPage={() => <Text testID="details-content">details</Text>}
    onPageChange={onPageChange}
  />,
);

test('renders both snap pages and starts on the player page', () => {
  const { getByTestId } = renderPager();
  expect(getByTestId('now-playing-page-player')).toBeTruthy();
  expect(getByTestId('now-playing-page-details')).toBeTruthy();
  expect(getByTestId('player-content')).toBeTruthy();
});

test('emits onPageChange when scrolling to the details page', () => {
  const onPageChange = jest.fn();
  const { getByTestId } = renderPager(onPageChange);
  const flatList = getByTestId('now-playing-snap-pager').findAllByType(FlatList)[0];
  fireEvent(flatList, 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 600 } } });
  expect(onPageChange).toHaveBeenCalledWith('details');
});

test('does not re-emit onPageChange when staying on the same page', () => {
  const onPageChange = jest.fn();
  const { getByTestId } = renderPager(onPageChange);
  const flatList = getByTestId('now-playing-snap-pager').findAllByType(FlatList)[0];
  fireEvent(flatList, 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 0 } } });
  expect(onPageChange).not.toHaveBeenCalled();
});

test('renders the two indicator dots for player/details', () => {
  const { getByTestId } = renderPager();
  expect(getByTestId('now-playing-snap-indicator-player')).toBeTruthy();
  expect(getByTestId('now-playing-snap-indicator-details')).toBeTruthy();
});
