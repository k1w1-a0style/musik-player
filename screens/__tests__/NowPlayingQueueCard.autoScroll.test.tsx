import React from 'react';
import { FlatList, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { getAppTheme } from '../../utils/appTheme';
import NowPlayingQueueCard from '../NowPlayingQueueCard';

type MockQueueRowProps = {
  id: string;
  onDragPosition?: (index: number, dragY: number, movementDirection: -1 | 0 | 1) => void;
  onDragEnd?: () => void;
};

const mockQueueRowProps = new Map<string, MockQueueRowProps>();
const mockAppTheme = {
  appearance: 'dark' as const,
  skin: 'graphite' as const,
  isHydrated: true,
  setAppearance: () => undefined,
  setSkin: () => undefined,
  theme: getAppTheme('dark', 'graphite'),
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppTheme,
  useOptionalAppTheme: () => mockAppTheme,
}));

jest.mock('../NowPlayingQueuePreviewRow', () => ({
  __esModule: true,
  default: (props: MockQueueRowProps) => {
    mockQueueRowProps.set(props.id, props);
    return <View testID={`mock-queue-row-${props.id}`} />;
  },
}));

const queue: Song[] = Array.from({ length: 10 }, (_, index) => ({
  id: `s${index + 1}`,
  title: `Song ${index + 1}`,
  artist: 'Artist',
}));

const getFlatList = (getByTestId: ReturnType<typeof render>['getByTestId']) =>
  getByTestId('now-playing-queue-list-frame').findAllByType(FlatList)[0];

describe('NowPlayingQueueCard auto-scroll timer', () => {
  let scrollToOffsetSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockQueueRowProps.clear();
    scrollToOffsetSpy = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(jest.fn());
  });

  afterEach(() => {
    scrollToOffsetSpy.mockRestore();
    jest.useRealTimers();
    mockQueueRowProps.clear();
  });

  test('revalidates edge eligibility on the real timer and stops on drag end', () => {
    const { getByTestId, unmount } = render(
      <NowPlayingQueueCard
        queue={queue}
        currentSongId="s1"
        maxHeight={240}
        onPlayQueueItem={jest.fn()}
        onQueueShift={jest.fn()}
        canShiftQueue
        accentColor="#3366FF"
      />,
    );
    const flatList = getFlatList(getByTestId);
    const row = mockQueueRowProps.get('s6');
    if (!row?.onDragPosition || !row.onDragEnd) throw new Error('Expected mocked queue row drag callbacks.');

    fireEvent(flatList, 'layout', { nativeEvent: { layout: { height: 220 } } });
    fireEvent(flatList, 'scroll', { nativeEvent: { contentOffset: { y: 0 } } });

    act(() => row.onDragPosition?.(5, 120, 1));
    expect(jest.getTimerCount()).toBe(1);

    fireEvent(flatList, 'scroll', { nativeEvent: { contentOffset: { y: 236 } } });
    act(() => jest.advanceTimersByTime(32));
    expect(scrollToOffsetSpy).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    fireEvent(flatList, 'scroll', { nativeEvent: { contentOffset: { y: 0 } } });
    act(() => row.onDragPosition?.(5, 120, 1));
    act(() => jest.advanceTimersByTime(32));
    expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 12, animated: false });
    expect(jest.getTimerCount()).toBe(1);

    act(() => row.onDragEnd?.());
    expect(jest.getTimerCount()).toBe(0);
    unmount();
  });
});