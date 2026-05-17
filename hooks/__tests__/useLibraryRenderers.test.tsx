import React from 'react';
import { Button, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useLibraryRenderers } from '../useLibraryRenderers';
import type { Song } from '../../types/Song';

jest.mock('../../components/SongCard', () => ({ song, onPressSong }: { song: Song; onPressSong: (song: Song) => void }) => (
  <Button title={song.title} onPress={() => onPressSong(song)} />
));

jest.mock('../../components/LibraryGroupRow', () => () => <Text>Group</Text>);
jest.mock('../../components/LibraryAlbumTile', () => () => <Text>Album</Text>);
jest.mock('../../components/LibraryPlaylistRow', () => () => <Text>Playlist</Text>);
jest.mock('../../components/LibraryFolderRow', () => () => <Text>Folder</Text>);

const song = (id: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  uri: id,
});

const HookHarness = ({ playSong = jest.fn() }: { playSong?: jest.Mock }) => {
  const renderers = useLibraryRenderers({
    currentSongId: 'a',
    filteredSongs: [song('a'), song('b')],
    isPlaying: true,
    onOpenTrackInfo: jest.fn(),
    playPlaylist: jest.fn(),
    playSong,
    removeFolder: jest.fn(),
  });

  return (
    <>
      <Text testID="layout">{JSON.stringify(renderers.getSongItemLayout(null, 2))}</Text>
      <Text testID="key">{renderers.songKeyExtractor(song('key-song'))}</Text>
      {renderers.renderSongItem({ item: song('a') })}
    </>
  );
};

test('returns stable song layout and key extractor helpers', () => {
  const screen = render(<HookHarness />);

  expect(screen.getByTestId('layout').props.children).toBe(JSON.stringify({ length: 62, offset: 124, index: 2 }));
  expect(screen.getByTestId('key').props.children).toBe('key-song');
});

test('renderSongItem forwards song presses to playSong with filtered queue', () => {
  const playSong = jest.fn();
  const screen = render(<HookHarness playSong={playSong} />);

  fireEvent.press(screen.getByText('a'));

  expect(playSong).toHaveBeenCalledWith(song('a'), [song('a'), song('b')]);
});
