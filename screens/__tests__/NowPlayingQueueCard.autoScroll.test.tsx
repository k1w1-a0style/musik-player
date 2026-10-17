import React from 'react';
import { Animated, Dimensions, FlatList, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { getAppTheme } from '../../utils/appTheme';
import NowPlayingQueueCard from '../NowPlayingQueueCard';

type MockQueueRowProps = {
  id: string;
  rowHeight: number;
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
  let dimensionsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockQueueRowProps.clear();
    scrollToOffsetSpy = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(jest.fn());
  });

  afterEach(() => {
    scrollToOffsetSpy.mockRestore();
    dimensionsSpy.mockRestore();
    jest.useRealTimers();
    mockQueueRowProps.clear();
  });

  test.each([1,2])('keeps edge eligibility anchored to the pointer at fontScale %s and stops on pointer exit or drag end', fontScale => {
    dimensionsSpy=jest.spyOn(Dimensions,'get').mockReturnValue({width:320,height:640,scale:1,fontScale});
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
    // Start the touched row inside the viewport for both actual row heights.
    const startingOffset=5*row.rowHeight-100;

    fireEvent(flatList, 'layout', { nativeEvent: { layout: { height: 220 } } });
    fireEvent(flatList, 'scroll', { nativeEvent: { contentOffset: { y: startingOffset } } });

    act(() => row.onDragPosition?.(5, 120, 1));
    expect(jest.getTimerCount()).toBeGreaterThan(baselineTimerCount);

    act(() => jest.advanceTimersByTime(32 * 10));
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(10);
    expect(scrollToOffsetSpy).toHaveBeenLastCalledWith({ offset: startingOffset+120, animated: false });
    const dragScrollCompensation = mockQueueRowProps.get('s6')?.dragScrollCompensation;
    expect(getAnimatedValue(dragScrollCompensation)).toBe(120);
    expect(jest.getTimerCount()).toBeGreaterThan(baselineTimerCount);

    act(() => row.onDragPosition?.(5, -350, 1));
    const callsAfterPointerExit = scrollToOffsetSpy.mock.calls.length;
    act(() => jest.advanceTimersByTime(64));
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(callsAfterPointerExit);

    act(() => row.onDragPosition?.(5, 120, 1));
    act(() => jest.advanceTimersByTime(32));
    expect(scrollToOffsetSpy).toHaveBeenLastCalledWith({ offset: startingOffset+132, animated: false });
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
