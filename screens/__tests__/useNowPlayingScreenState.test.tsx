import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { buildSavedQueuePlaylistName, useNowPlayingScreenState } from '../useNowPlayingScreenState';

const mockSong = { id: 's1', title: 'One', artist: 'A' };
const mockSeekTo = jest.fn(async () => undefined);
const mockSetVolume = jest.fn(async () => undefined);
const mockPlaySong = jest.fn(async () => undefined);
const mockNext = jest.fn(async () => undefined);
const mockPrevious = jest.fn(async () => undefined);
let mockPlaybackQueue = [mockSong];
let mockControlsMode: 'buttons' | 'coverSwipe' = 'buttons';
const mockSaveQueueAsPlaylist = jest.fn((name: string, queue: typeof mockPlaybackQueue) =>
  queue.length ? { id: 'pl-1', name, songIds: queue.map((song) => song.id), createdAt: 1 } : null,
);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 12 }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useNowPlayingMusicContext: () => ({
    playbackQueue: mockPlaybackQueue,
    currentSong: mockSong,
    seekTo: mockSeekTo,
    isPlaying: true,
    volume: 0.8,
    setVolume: mockSetVolume,
    palette: { vibrant: '#123456' },
    playSong: mockPlaySong,
    next: mockNext,
    previous: mockPrevious,
    saveQueueAsPlaylist: mockSaveQueueAsPlaylist,
  }),
}));

jest.mock('../../contexts/PlaybackProgressContext', () => ({
  usePlaybackProgress: () => ({ position: 3, duration: 9 }),
}));

jest.mock('../../hooks/useNowPlayingControlsMode', () => ({
  useNowPlayingControlsMode: () => ({
    mode: mockControlsMode,
    isHydrated: true,
    setMode: jest.fn(),
  }),
}));

jest.mock('../useNowPlayingFavorite', () => ({
  useNowPlayingFavorite: (songId?: string) => ({
    favorite: songId === 's1',
    favoritePending: false,
    toggleFavorite: jest.fn(),
  }),
}));

jest.mock('../useNowPlayingMenu', () => ({
  useNowPlayingMenu: () => ({
    menuOpen: false,
    openMenu: jest.fn(),
    closeMenu: jest.fn(),
    handleClose: jest.fn(),
    openTrackInfo: jest.fn(),
  }),
}));

jest.mock('../useNowPlayingQueue', () => ({
  useNowPlayingQueue: () => ({
    queue: [mockSong],
    playQueueItemById: jest.fn(),
  }),
}));

jest.mock('../useNowPlayingPresentation', () => ({
  useNowPlayingPresentation: () => ({
    accent: '#123456',
    gradientColors: ['#111111', '#222222'],
    albumTitle: 'Album',
    artworkUri: 'file:///cover.jpg',
    progressAccent: '#123456',
    progressAccentDark: '#654321',
  }),
}));

const ScreenStateProbe = () => {
  const state = useNowPlayingScreenState();

  return (
    <>
      <Text testID="song-id">{state.currentSong?.id}</Text>
      <Text testID="bottom-inset">{state.bottomInset}</Text>
      <Text testID="favorite">{String(state.favorite)}</Text>
      <Text testID="queue-count">{state.queue.length}</Text>
      <Text testID="album-title">{state.albumTitle}</Text>
      <Text testID="position">{state.position}</Text>
      <Text testID="duration">{state.duration}</Text>
      <Text testID="controls-mode">{state.controlsMode}</Text>
      <Text testID="can-save-queue">{String(typeof state.saveCurrentQueueAsPlaylist === 'function')}</Text>
      <Pressable testID="save-queue" onPress={state.saveCurrentQueueAsPlaylist}>
        <Text>Save queue</Text>
      </Pressable>
      <Pressable testID="swipe-next" onPress={state.swipeToNext}>
        <Text>Next</Text>
      </Pressable>
      <Pressable testID="swipe-previous" onPress={state.swipeToPrevious}>
        <Text>Previous</Text>
      </Pressable>
    </>
  );
};

describe('useNowPlayingScreenState', () => {
  beforeEach(() => {
    mockPlaybackQueue = [mockSong];
    mockControlsMode = 'buttons';
    mockSaveQueueAsPlaylist.mockClear();
    mockNext.mockClear();
    mockPrevious.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 11, 14, 35, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('combines now playing screen state', () => {
    const { getByTestId } = render(<ScreenStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('s1');
    expect(getByTestId('bottom-inset').props.children).toBe(12);
    expect(getByTestId('favorite').props.children).toBe('true');
    expect(getByTestId('queue-count').props.children).toBe(1);
    expect(getByTestId('album-title').props.children).toBe('Album');
    expect(getByTestId('position').props.children).toBe(3);
    expect(getByTestId('duration').props.children).toBe(9);
    expect(getByTestId('controls-mode').props.children).toBe('buttons');
    expect(getByTestId('can-save-queue').props.children).toBe('true');
  });

  test('exposes the cover swipe mode from settings', () => {
    mockControlsMode = 'coverSwipe';

    const { getByTestId } = render(<ScreenStateProbe />);

    expect(getByTestId('controls-mode').props.children).toBe('coverSwipe');
  });

  test('uses existing next and previous actions for cover swipes', () => {
    const { getByTestId } = render(<ScreenStateProbe />);

    fireEvent.press(getByTestId('swipe-next'));
    fireEvent.press(getByTestId('swipe-previous'));

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockPrevious).toHaveBeenCalledTimes(1);
  });

  test('builds saved queue playlist names with German timestamps', () => {
    const name = buildSavedQueuePlaylistName(new Date(2026, 5, 11, 14, 35, 0));

    expect(name).toMatch(/^Gespeicherte Warteschlange — .+/);
    expect(name).toContain('11.06.26');
    expect(name).toContain('14:35');
  });

  test('saves the current queue with a timestamped playlist name and shows it in the alert', () => {
    const { getByTestId } = render(<ScreenStateProbe />);

    fireEvent.press(getByTestId('save-queue'));

    expect(mockSaveQueueAsPlaylist).toHaveBeenCalledWith(
      expect.stringMatching(/^Gespeicherte Warteschlange — .+/),
      [mockSong],
    );
    const savedName = mockSaveQueueAsPlaylist.mock.calls[0][0];
    expect(savedName).toContain('11.06.26');
    expect(savedName).toContain('14:35');
    expect(Alert.alert).toHaveBeenCalledWith('Playlist gespeichert', `„${savedName}“ wurde erstellt.`);
  });

  test('keeps the empty queue alert unchanged', () => {
    mockPlaybackQueue = [];
    const { getByTestId } = render(<ScreenStateProbe />);

    fireEvent.press(getByTestId('save-queue'));

    expect(Alert.alert).toHaveBeenCalledWith('Warteschlange speichern', 'Die aktuelle Warteschlange enthält keine Titel.');
  });
});
