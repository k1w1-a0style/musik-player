import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useNowPlayingScreenState } from '../useNowPlayingScreenState';

const mockSong = { id: 's1', title: 'One', artist: 'A' };
const mockSeekTo = jest.fn(async () => undefined);
const mockSetVolume = jest.fn(async () => undefined);
const mockPlaySong = jest.fn(async () => undefined);
const mockSaveQueueAsPlaylist = jest.fn(() => ({ id: 'pl-1', name: 'Gespeicherte Queue', songIds: ['s1'], createdAt: 1 }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 12 }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useNowPlayingMusicContext: () => ({
    playbackQueue: [mockSong],
    currentSong: mockSong,
    seekTo: mockSeekTo,
    isPlaying: true,
    volume: 0.8,
    setVolume: mockSetVolume,
    palette: { vibrant: '#123456' },
    playSong: mockPlaySong,
    saveQueueAsPlaylist: mockSaveQueueAsPlaylist,
  }),
}));

jest.mock('../../contexts/PlaybackProgressContext', () => ({
  usePlaybackProgress: () => ({ position: 3, duration: 9 }),
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
      <Text testID="can-save-queue">{String(typeof state.saveCurrentQueueAsPlaylist === 'function')}</Text>
    </>
  );
};

describe('useNowPlayingScreenState', () => {
  test('combines now playing screen state', () => {
    const { getByTestId } = render(<ScreenStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('s1');
    expect(getByTestId('bottom-inset').props.children).toBe(12);
    expect(getByTestId('favorite').props.children).toBe('true');
    expect(getByTestId('queue-count').props.children).toBe(1);
    expect(getByTestId('album-title').props.children).toBe('Album');
    expect(getByTestId('position').props.children).toBe(3);
    expect(getByTestId('duration').props.children).toBe(9);
    expect(getByTestId('can-save-queue').props.children).toBe('true');
  });
});
