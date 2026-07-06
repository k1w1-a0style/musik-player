import React from 'react';
import { FlatList, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingSnapPager, { type NowPlayingPageId } from '../NowPlayingSnapPager';
const mockAppTheme = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: () => undefined,
  setSkin: () => undefined,
  theme: {
    palette: {
      background: '#08090B',
      backgroundDeep: '#030406',
      surface: '#111318',
      surfaceElevated: '#191B21',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      accent: '#BFC7D4',
      text: {
        primary: '#F4F5F3',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#030406', '#08090B', '#0D1014'],
      nowPlaying: ['#030406', '#08090B', '#0D1014'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppTheme,
  useOptionalAppTheme: () => mockAppTheme,
}));

const renderPager = ({
  onPageChange,
  pageHeight = 600,
  initialPage = 'player',
}: {
  onPageChange?: jest.Mock;
  pageHeight?: number;
  initialPage?: NowPlayingPageId;
} = {}) => render(
  <NowPlayingSnapPager
    pageHeight={pageHeight}
    initialPage={initialPage}
    renderPlayerPage={() => <Text testID="player-content">player</Text>}
    renderDetailsPage={() => <Text testID="details-content">details</Text>}
    onPageChange={onPageChange}
  />,
);

const getFlatList = (getByTestId: ReturnType<typeof render>['getByTestId']) =>
  getByTestId('now-playing-snap-pager').findAllByType(FlatList)[0];

describe('NowPlayingSnapPager', () => {
  let scrollToOffsetSpy: jest.SpyInstance;

  beforeEach(() => {
    scrollToOffsetSpy = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(jest.fn());
  });

  afterEach(() => {
    scrollToOffsetSpy.mockRestore();
  });

  test('renders both snap pages and starts on the player page', () => {
    const { getByTestId } = renderPager();
    expect(getByTestId('now-playing-page-player')).toBeTruthy();
    expect(getByTestId('now-playing-page-details')).toBeTruthy();
    expect(getByTestId('player-content')).toBeTruthy();
  });

  test('emits onPageChange when scrolling to the details page', () => {
    const onPageChange = jest.fn();
    const { getByTestId } = renderPager({ onPageChange });
    const flatList = getFlatList(getByTestId);
    fireEvent(flatList, 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 600 } } });
    expect(onPageChange).toHaveBeenCalledWith('details');
  });

  test('does not re-emit onPageChange when staying on the same page', () => {
    const onPageChange = jest.fn();
    const { getByTestId } = renderPager({ onPageChange });
    const flatList = getFlatList(getByTestId);
    fireEvent(flatList, 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 0 } } });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test('renders the two indicator dots for player/details', () => {
    const { getByTestId } = renderPager();
    expect(getByTestId('now-playing-snap-indicator-player')).toBeTruthy();
    expect(getByTestId('now-playing-snap-indicator-details')).toBeTruthy();
  });

  test('resnaps the details page after pageHeight changes', () => {
    const onPageChange = jest.fn();
    const { getByTestId, rerender } = renderPager({ onPageChange });
    const flatList = getFlatList(getByTestId);
    scrollToOffsetSpy.mockClear();

    fireEvent(flatList, 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 600 } } });
    expect(onPageChange).toHaveBeenCalledWith('details');
    scrollToOffsetSpy.mockClear();

    rerender(
      <NowPlayingSnapPager
        pageHeight={720}
        renderPlayerPage={() => <Text testID="player-content">player</Text>}
        renderDetailsPage={() => <Text testID="details-content">details</Text>}
        onPageChange={onPageChange}
      />,
    );

    expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 720, animated: false });
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  test('resnaps the player page to offset 0 after pageHeight changes', () => {
    const { rerender } = renderPager();
    scrollToOffsetSpy.mockClear();

    rerender(
      <NowPlayingSnapPager
        pageHeight={720}
        renderPlayerPage={() => <Text testID="player-content">player</Text>}
        renderDetailsPage={() => <Text testID="details-content">details</Text>}
      />,
    );

    expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 0, animated: false });
    expect(scrollToOffsetSpy).not.toHaveBeenCalledWith({ offset: 720, animated: false });
  });

  test('indicator navigation uses the latest pageHeight after a resize', () => {
    const { getByTestId, rerender } = renderPager();
    scrollToOffsetSpy.mockClear();

    rerender(
      <NowPlayingSnapPager
        pageHeight={720}
        renderPlayerPage={() => <Text testID="player-content">player</Text>}
        renderDetailsPage={() => <Text testID="details-content">details</Text>}
      />,
    );
    scrollToOffsetSpy.mockClear();

    fireEvent.press(getByTestId('now-playing-snap-indicator-details'));

    expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 720, animated: true });
  });

  test('updates snap offsets, item layout, and drag snapping after pageHeight changes', () => {
    const { getByTestId, rerender } = renderPager();

    rerender(
      <NowPlayingSnapPager
        pageHeight={720}
        renderPlayerPage={() => <Text testID="player-content">player</Text>}
        renderDetailsPage={() => <Text testID="details-content">details</Text>}
      />,
    );

    const flatList = getFlatList(getByTestId);
    expect(flatList.props.snapToOffsets).toEqual([0, 720]);
    expect(flatList.props.getItemLayout(null, 1)).toEqual({ length: 720, offset: 720, index: 1 });

    scrollToOffsetSpy.mockClear();
    fireEvent(flatList, 'scrollEndDrag', { nativeEvent: { contentOffset: { y: 700 } } });

    expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 720, animated: true });
  });

  test.each([0, Number.NaN])('does not call scrollToOffset for invalid pageHeight %s', invalidHeight => {
    const { getByTestId } = renderPager({ pageHeight: invalidHeight });
    const flatList = getFlatList(getByTestId);

    fireEvent(flatList, 'scrollEndDrag', { nativeEvent: { contentOffset: { y: 100 } } });
    fireEvent.press(getByTestId('now-playing-snap-indicator-details'));

    expect(scrollToOffsetSpy).not.toHaveBeenCalled();
  });
});
