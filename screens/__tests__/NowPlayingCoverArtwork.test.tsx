import React from 'react';
import { Dimensions, Image, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingCoverArtwork from '../NowPlayingCoverArtwork';
import { KIWI_MUSIC_ARTWORK } from '../../utils/songArtwork';

const mockTheme = { theme: { palette: { surface: '#101218' } }, bassPulseEnabled: false, isBassPulseHydrated: true };
let mockReducedMotion = false;
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => mockTheme }));
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
jest.mock('../../components/CoverBassPulse', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children, enabled }: { children: React.ReactNode; enabled: boolean }) => <View testID={enabled ? "bass-pulse" : "bass-static"}>{children}</View>;
});
jest.mock('../../components/NativeTrackPager', () => {
  const { View } = jest.requireActual('react-native');
  return ({ songs, renderPage, ...props }: { songs: { id: string }[]; renderPage: (song: unknown) => React.ReactNode }) =>
    <View {...props}>{songs.map(song => <View key={song.id}>{renderPage(song)}</View>)}</View>;
});
const songs = [0, 1, 2].map(id => ({ id: String(id), title: `Track ${id}`, artist: 'Artist', cover: `file:///${id}.jpg` }));
const defaults = { song: songs[1], previousSong: songs[0], nextSong: songs[2], queue: songs,
  isPlaying: true, accent: '#00ffff', coverSize: 160, swipeEnabled: true };
beforeEach(() => {
  mockTheme.bassPulseEnabled = false;
  mockReducedMotion = false;
  Dimensions.set({ window: { width: 360, height: 800, scale: 1, fontScale: 1 },
    screen: { width: 360, height: 800, scale: 1, fontScale: 1 } });
});

test('static cover remains available without swipe callbacks', () => {
  const view = render(<NowPlayingCoverArtwork song={songs[1]} isPlaying={false} accent="#123456" coverSize={160} />);
  expect(view.getByTestId('now-playing-cover-card')).toBeTruthy();
  expect(view.queryByTestId('now-playing-cover-track')).toBeNull();
});

test('uses a native queue pager with separately preloaded cover images', () => {
  const view = render(<NowPlayingCoverArtwork {...defaults} />);
  expect(view.getByTestId('now-playing-cover-track').props.songs).toBeUndefined();
  const viewport = StyleSheet.flatten(view.getByTestId('now-playing-cover-pager').props.style);
  expect(viewport.width).toBe(360);
  expect(viewport.width - 160).toBeGreaterThanOrEqual(32);
  expect(view.getByTestId('now-playing-cover-image').props.resizeMethod).toBe('resize');
  expect(view.getByTestId('now-playing-cover-previous-image').props.source).toEqual({ uri: 'file:///0.jpg' });
  expect(view.getByTestId('now-playing-cover-next-image').props.source).toEqual({ uri: 'file:///2.jpg' });
});

test('incoming image view survives playback acknowledgement', () => {
  const view = render(<NowPlayingCoverArtwork {...defaults} />);
  const incoming = view.getByTestId('now-playing-cover-next-image');
  view.rerender(<NowPlayingCoverArtwork {...defaults} song={songs[2]} previousSong={songs[1]} nextSong={null} />);
  expect(view.getByTestId('now-playing-cover-image')).toBe(incoming);
  expect(view.getByTestId('now-playing-cover-image').props.source).toEqual({ uri: 'file:///2.jpg' });
});

test('failed and missing artwork uses the Kiwi logo', () => {
  const view = render(<NowPlayingCoverArtwork song={songs[1]} isPlaying={false} accent="#123456" coverSize={160} />);
  fireEvent(view.getByTestId('now-playing-cover-image'), 'error');
  expect(view.UNSAFE_getByType(Image).props.source).toBe(KIWI_MUSIC_ARTWORK);
});

test('bass pulse is mounted only for the enabled current cover', () => {
  mockTheme.bassPulseEnabled = true;
  const view = render(<NowPlayingCoverArtwork {...defaults} />);
  expect(view.getAllByTestId('bass-pulse')).toHaveLength(1);
  mockTheme.bassPulseEnabled = false;
  view.rerender(<NowPlayingCoverArtwork {...defaults} isPlaying={false} />);
  expect(view.queryByTestId('bass-pulse')).toBeNull();
});

test('the explicit bass switch enables the effect even when Android reduces system animations', () => {
  mockTheme.bassPulseEnabled = true;
  mockReducedMotion = true;
  const view = render(<NowPlayingCoverArtwork {...defaults} />);
  expect(view.getAllByTestId('bass-pulse')).toHaveLength(1);
});

test('also pulses a single classic cover without swipe pages', () => {
  mockTheme.bassPulseEnabled = true;
  const view = render(<NowPlayingCoverArtwork {...defaults} swipeEnabled={false} />);
  expect(view.getAllByTestId('bass-pulse')).toHaveLength(1);
  mockTheme.bassPulseEnabled = false;
  view.rerender(<NowPlayingCoverArtwork {...defaults} swipeEnabled={false} isPlaying={false} />);
  expect(view.queryByTestId('bass-pulse')).toBeNull();
});
