import React from 'react';
import { Animated, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import SoundCloudTrackCarousel from '../SoundCloudTrackCarousel';

jest.mock('../../components/NativeTrackPager', () => {
  const { View: V } = jest.requireActual('react-native');
  return ({ songs, renderPage, ...props }: { songs: { id: string }[]; renderPage: (song: unknown) => React.ReactNode }) =>
    <V {...props}>{songs.map(song => <V key={song.id}>{renderPage(song)}</V>)}</V>;
});
const songs = [0, 1, 2].map(id => ({ id: String(id), title: `Track ${id}`, artist: 'Artist', cover: `file:///${id}.jpg` }));
const defaults = {
  currentSong: songs[1], previousSong: songs[0], nextSong: songs[2], queue: songs,
  isPlaying: true, topInset: 0, bottomInset: 0, verticalDrag: new Animated.Value(0),
  onSwipeToNext: jest.fn(), onSwipeToPrevious: jest.fn(), onCollapse: jest.fn(), onOpenQueue: jest.fn(),
  renderPage: ({ role }: { role: string }) => <View testID={`page-content-${role}`} />,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({
    start: (cb?: (result: { finished: boolean }) => void) => cb?.({ finished: true }), stop: jest.fn(), reset: jest.fn(),
  }) as Animated.CompositeAnimation);
});
afterEach(() => jest.restoreAllMocks());

test('both artwork and track page content belong to the native pager', () => {
  const view = render(<SoundCloudTrackCarousel {...defaults} />);
  expect(view.getByTestId('soundcloud-track-carousel')).toBeTruthy();
  expect(view.getByTestId('page-content-current')).toBeTruthy();
  expect(view.getByTestId('page-content-next')).toBeTruthy();
  expect(view.getByTestId('soundcloud-carousel-next-artwork', { includeHiddenElements: true }).props.fadeDuration).toBe(0);
  expect(view.queryByTestId('now-playing-cover-bass-pulse')).toBeNull();
});

test('incoming cover view survives the active track acknowledgement', () => {
  const view = render(<SoundCloudTrackCarousel {...defaults} />);
  const incoming = view.getByTestId('soundcloud-carousel-next-artwork', { includeHiddenElements: true });
  view.rerender(<SoundCloudTrackCarousel {...defaults} currentSong={songs[2]} previousSong={songs[1]} nextSong={null} />);
  expect(view.getByTestId('soundcloud-carousel-current-artwork')).toBe(incoming);
});

test('routes page selection to the actual selected song', () => {
  const select = jest.fn();
  const view = render(<SoundCloudTrackCarousel {...defaults} onSelectSong={select} />);
  act(() => view.getByTestId('soundcloud-track-carousel').props.onSelectSong(songs[2]));
  expect(select).toHaveBeenCalledWith(songs[2]);
});

test('preserves downward collapse and upward queue gestures', () => {
  const view = render(<SoundCloudTrackCarousel {...defaults} />);
  fireEvent(view.getByTestId('soundcloud-collapse-gesture'), 'handlerStateChange', {
    nativeEvent: { oldState: State.ACTIVE, state: State.END, translationY: 60, velocityY: 1100 },
  });
  expect(defaults.onCollapse).toHaveBeenCalledTimes(1);
  fireEvent(view.getByTestId('soundcloud-collapse-gesture'), 'handlerStateChange', {
    nativeEvent: { oldState: State.ACTIVE, state: State.END, translationY: -70, translationX: 2, velocityY: -1000 },
  });
  expect(defaults.onOpenQueue).toHaveBeenCalledTimes(1);
});

test('keeps waveform gesture priority without a second horizontal animation graph', () => {
  const ref = React.createRef<unknown>();
  const view = render(<SoundCloudTrackCarousel {...defaults} waveformGestureRef={ref} />);
  expect(view.getByTestId('soundcloud-track-carousel').props.waitFor).toBe(ref);
  expect(view.queryByTestId('soundcloud-track-swipe-gesture')).toBeNull();
});
