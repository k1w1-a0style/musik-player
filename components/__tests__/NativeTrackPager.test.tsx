import React from 'react';
import { Alert, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import NativeTrackPager from '../NativeTrackPager';

const mockScroll = jest.fn();
jest.mock('react-native-gesture-handler', () => {
  const R = jest.requireActual('react');
  const { View: V } = jest.requireActual('react-native');
  return { FlatList: R.forwardRef((props: { data: unknown[]; renderItem: (arg: unknown) => unknown }, ref: unknown) => {
    R.useImperativeHandle(ref, () => ({ scrollToOffset: mockScroll }));
    return <V {...props}>{props.data.map((item, index) => <V key={index}>{props.renderItem({ item, index })}</V>)}</V>;
  }) };
});
const songs = [0, 1, 2, 3].map(id => ({ id: String(id), title: `Track ${id}`, artist: 'Artist' }));
const renderPage = (song: typeof songs[number]) => <Text>{song.title}</Text>;
const scroll = (view: ReturnType<typeof render>, offset: number) => {
  fireEvent(view.getByTestId('pager'), 'scrollBeginDrag', {});
  fireEvent(view.getByTestId('pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: offset } } });
};
beforeEach(() => { jest.useFakeTimers(); mockScroll.mockClear(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('native paging owns the gesture and selects the page once', () => {
  const select = jest.fn();
  const view = render(<NativeTrackPager songs={songs} currentSongId="1" width={360}
    onSelectSong={select} renderPage={renderPage} testID="pager" />);
  expect(view.getByTestId('pager').props.pagingEnabled).toBe(true);
  expect(view.getByTestId('pager').props.snapToInterval).toBe(360);
  scroll(view, 720);
  fireEvent(view.getByTestId('pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 720 } } });
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledWith(songs[2]);
  expect(mockScroll).not.toHaveBeenCalled();
});

test('delayed playback and its acknowledgement cannot send the incoming cover back', async () => {
  let complete: (() => void) | undefined;
  const select = jest.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  const props = { songs, width: 360, onSelectSong: select, renderPage, testID: 'pager' };
  const view = render(<NativeTrackPager {...props} currentSongId="1" />);
  const incoming = view.getByTestId('pager-page-2-2', { includeHiddenElements: true });
  scroll(view, 720);
  view.rerender(<NativeTrackPager {...props} currentSongId="1" songs={[...songs]} />);
  act(() => jest.advanceTimersByTime(1500));
  expect(mockScroll).not.toHaveBeenCalled();
  view.rerender(<NativeTrackPager {...props} currentSongId="2" />);
  await act(async () => complete?.());
  expect(mockScroll).not.toHaveBeenCalled();
  expect(view.getByTestId('pager-page-2-2')).toBe(incoming);
});

test('a second quick swipe keeps its target despite an intermediate active-track event', () => {
  const props = { songs, width: 360, onSelectSong: jest.fn(), renderPage, testID: 'pager' };
  const view = render(<NativeTrackPager {...props} currentSongId="1" />);
  scroll(view, 720);
  scroll(view, 1080);
  view.rerender(<NativeTrackPager {...props} currentSongId="2" />);
  expect(mockScroll).not.toHaveBeenCalled();
  view.rerender(<NativeTrackPager {...props} currentSongId="3" />);
  expect(mockScroll).not.toHaveBeenCalled();
  expect(props.onSelectSong.mock.calls.map(call => call[0].id)).toEqual(['2', '3']);
});

test('an external transport change scrolls to the correct queue page', () => {
  const props = { songs, width: 360, onSelectSong: jest.fn(), renderPage, testID: 'pager' };
  const view = render(<NativeTrackPager {...props} currentSongId="1" />);
  view.rerender(<NativeTrackPager {...props} currentSongId="3" />);
  expect(mockScroll).toHaveBeenCalledWith({ offset: 1080, animated: true });
});

test('only an actual navigation failure returns to the audible track', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<NativeTrackPager songs={songs} currentSongId="1" width={360}
    onSelectSong={() => Promise.reject(new Error('unavailable'))} renderPage={renderPage} testID="pager" />);
  await act(async () => scroll(view, 720));
  expect(mockScroll).toHaveBeenCalledWith({ offset: 360, animated: true });
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test('unmount cancels the missing-acknowledgement timeout', () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<NativeTrackPager songs={songs} currentSongId="1" width={360}
    onSelectSong={jest.fn()} renderPage={renderPage} testID="pager" />);
  scroll(view, 720);
  view.unmount();
  act(() => jest.advanceTimersByTime(20_000));
  expect(Alert.alert).not.toHaveBeenCalled();
});
