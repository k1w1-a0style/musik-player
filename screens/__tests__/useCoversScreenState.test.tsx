import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useCoversScreenState } from '../useCoversScreenState';

const mockPlaySong = jest.fn();
const mockSongs = [
  { id: 's1', title: 'One', artist: 'Artist', album: 'Beta', cover: 'file:///beta.jpg' },
  { id: 's2', title: 'Two', artist: 'Artist', album: 'Alpha' },
  { id: 's3', title: 'Three', artist: 'Artist', album: 'Beta' },
];

jest.mock('../../contexts/MusicContext', () => ({
  useMusicContext: () => ({
    songs: mockSongs,
    playSong: mockPlaySong,
  }),
}));

const CoversStateProbe = () => {
  const state = useCoversScreenState();
  const firstAlbum = state.albums[0];

  return (
    <>
      <Text testID="album-count">{String(state.albums.length)}</Text>
      <Text testID="first-album-name">{firstAlbum?.name ?? 'none'}</Text>
      <Text testID="beta-song-count">{String(state.albums.find(album => album.name === 'Beta')?.songs.length ?? 0)}</Text>
      <Text testID="beta-artwork">{state.albums.find(album => album.name === 'Beta')?.artworkUri ?? 'none'}</Text>
      <Pressable
        testID="play-first-album"
        onPress={() => {
          if (firstAlbum?.songs[0]) void state.playSong(firstAlbum.songs[0], firstAlbum.songs);
        }}
      />
    </>
  );
};

describe('useCoversScreenState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds sorted album groups from music context songs', () => {
    const { getByTestId } = render(<CoversStateProbe />);

    expect(getByTestId('album-count').props.children).toBe('2');
    expect(getByTestId('first-album-name').props.children).toBe('Alpha');
    expect(getByTestId('beta-song-count').props.children).toBe('2');
    expect(getByTestId('beta-artwork').props.children).toBe('file:///beta.jpg');
  });

  test('exposes play song action', () => {
    const { getByTestId } = render(<CoversStateProbe />);

    fireEvent.press(getByTestId('play-first-album'));

    expect(mockPlaySong).toHaveBeenCalledWith(mockSongs[1], [mockSongs[1]]);
  });
});
