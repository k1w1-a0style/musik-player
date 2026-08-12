import React from 'react';
import { Animated, FlatList, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { getAppTheme } from '../../utils/appTheme';
import NowPlayingQueueCard from '../NowPlayingQueueCard';

type MockQueueRowProps = {
  id: string;
  onDragPosition?: (index: number, dragY: number, movementDirection: -1 | 0 | 1) => void;
  onDragEnd?: () => void;
  dragScrollCompensation?: Animated.Value;
};

const MockView = View;
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
    return <MockView testID={`mock-queue-row-${props.id}`} />;
  },
}));

const queue: Song[] = Array.from({ length: 10 }, (_, index) => ({
  id: `s${index + 1}`,
  title: `Song ${index + 1}`,
  artist: 'Artist',
}));

const getFlatList = (getByTestId: ReturnType<typeof render>['getByTestId']) =>
  getByTestId('now-playing-queue-list-frame').findAllByType(FlatList)[0];
const getAnimatedValue = (value?: Animated.Value): number | undefined => value
  ? (value as Animated.Value & { __getValue: () => number }).__getValue()
  : undefined;

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

  test('keeps edge eligibility anchored to the pointer and stops on pointer exit or drag end', () => {
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
    const baselineTimerCount = jest.getTimerCount();

    fireEvent(flatList, 'layout', { nativeEvent: { layout: { height: 220 } } });
    fireEvent(flatList, 'scroll', { nativeEvent: { contentOffset: { y: 0 } } });

    act(() => row.onDragPosition?.(5, 120, 1));
    expect(jest.getTimerCount()).toBeGreaterThan(baselineTimerCount);

    act(() => jest.advanceTimersByTime(32 * 10));
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(10);
    expect(scrollToOffsetSpy).toHaveBeenLastCalledWith({ offset: 120, animated: false });
    const dragScrollCompensation = mockQueueRowProps.get('s6')?.dragScrollCompensation;
    expect(getAnimatedValue(dragScrollCompensation)).toBe(120);
    expect(jest.getTimerCount()).toBeGreaterThan(baselineTimerCount);

    act(() => row.onDragPosition?.(5, -350, 1));
    const callsAfterPointerExit = scrollToOffsetSpy.mock.calls.length;
    act(() => jest.advanceTimersByTime(64));
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(callsAfterPointerExit);

    act(() => row.onDragPosition?.(5, 120, 1));
    act(() => jest.advanceTimersByTime(32));
    expect(scrollToOffsetSpy).toHaveBeenLastCalledWith({ offset: 132, animated: false });
    expect(jest.getTimerCount()).toBeGreaterThan(baselineTimerCount);

    act(() => row.onDragEnd?.());
    expect(getAnimatedValue(dragScrollCompensation)).toBe(0);
    expect(mockQueueRowProps.get('s6')?.dragScrollCompensation).toBeUndefined();
    const callsAfterDragEnd = scrollToOffsetSpy.mock.calls.length;
    act(() => jest.advanceTimersByTime(64));
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(callsAfterDragEnd);
    unmount();
  });
});
