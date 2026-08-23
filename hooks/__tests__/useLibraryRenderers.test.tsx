import mockReact from 'react';
import { Button as mockButton, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useLibraryRenderers, type UseLibraryRenderersOptions } from '../useLibraryRenderers';
import type { Song } from '../../types/Song';
import type { ScanFolder } from '../../types/ScanFolder';
import type { LibraryGroupItem } from '../../utils/libraryPresentation';
import type { LibraryPlaylistItem } from '../../utils/libraryPlaylists';
import { buildSongCardSong } from '../../utils/libraryRendererHelpers';

type MockSongCardProps = {
  song: Song;
  isCurrent: boolean;
  isPlaying: boolean;
  onPressSong: (song: Song) => void;
  onInfoSong?: (song: Song) => void;
};

type MockLibraryGroupRowProps = {
  group: LibraryGroupItem;
  onPress: (group: LibraryGroupItem) => void;
};

type MockLibraryAlbumTileProps = {
  album: LibraryGroupItem;
  onPress: (album: LibraryGroupItem) => void;
};

type MockLibraryPlaylistRowProps = {
  playlist: LibraryPlaylistItem;
  onOpen: (playlistId: string) => void;
  onPlay: (playlistId: string) => void;
};

type MockLibraryFolderRowProps = {
  folder: ScanFolder;
  onRemove: (folder: ScanFolder) => void | Promise<void>;
};

const mockSongCardProps: MockSongCardProps[] = [];
const mockGroupRowProps: MockLibraryGroupRowProps[] = [];
const mockAlbumTileProps: MockLibraryAlbumTileProps[] = [];
const mockPlaylistRowProps: MockLibraryPlaylistRowProps[] = [];
const mockFolderRowProps: MockLibraryFolderRowProps[] = [];

jest.mock('../../components/SongCard', () => (props: MockSongCardProps) => {
  mockSongCardProps.push(props);
  return mockReact.createElement(
    mockReact.Fragment,
    null,
    mockReact.createElement(mockButton, { title: props.song.title, onPress: () => props.onPressSong(props.song) }),
    props.onInfoSong
      ? mockReact.createElement(mockButton, { title: `info-${props.song.id}`, onPress: () => props.onInfoSong?.(props.song) })
      : null,
  );
});

jest.mock('../../components/LibraryGroupRow', () => (props: MockLibraryGroupRowProps) => {
  mockGroupRowProps.push(props);
  return mockReact.createElement(mockButton, { title: `group-${props.group.id}`, onPress: () => props.onPress(props.group) });
});

jest.mock('../../components/LibraryAlbumTile', () => (props: MockLibraryAlbumTileProps) => {
  mockAlbumTileProps.push(props);
  return mockReact.createElement(mockButton, { title: `album-${props.album.id}`, onPress: () => props.onPress(props.album) });
});

jest.mock('../../components/LibraryPlaylistRow', () => (props: MockLibraryPlaylistRowProps) => {
  mockPlaylistRowProps.push(props);
  return mockReact.createElement(
    mockReact.Fragment,
    null,
    mockReact.createElement(mockButton, { title: `playlist-open-${props.playlist.id}`, onPress: () => props.onOpen(props.playlist.id) }),
    mockReact.createElement(mockButton, { title: `playlist-play-${props.playlist.id}`, onPress: () => props.onPlay(props.playlist.id) }),
  );
});

jest.mock('../../components/LibraryFolderRow', () => (props: MockLibraryFolderRowProps) => {
  mockFolderRowProps.push(props);
  return mockReact.createElement(mockButton, { title: `folder-${props.folder.id}`, onPress: () => props.onRemove(props.folder) });
});

const song = (id: string, overrides: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  uri: id,
  ...overrides,
});

const group = (id: string, songs: Song[]): LibraryGroupItem => ({
  id,
  title: id,
  subtitle: `${songs.length} Titel`,
  songs,
});

const playlist = (id: string): LibraryPlaylistItem => ({
  id,
  name: id,
  songs: [],
  totalCount: 0,
  validCount: 0,
});

const folder = (id: string): ScanFolder => ({
  id,
  name: id,
  uri: `file://${id}`,
  addedAt: 1,
  enabled: true,
});

type HarnessProps = Partial<UseLibraryRenderersOptions> & {
  albumItem?: LibraryGroupItem;
  groupItem?: LibraryGroupItem;
  playlistItem?: LibraryPlaylistItem;
  folderItem?: ScanFolder;
  songItem?: Song;
};

const defaultFilteredSongs = [song('a'), song('b')];

const HookHarness = ({
  albumItem = group('album-1', [song('album-song')]),
  currentSongId = 'a',
  filteredSongs = defaultFilteredSongs,
  folderItem = folder('folder-1'),
  groupItem = group('group-1', [song('group-song')]),
  isPlaying = true,
  onOpenPlaylistDetail = jest.fn(),
  onOpenTrackInfo = jest.fn(),
  playlistItem = playlist('playlist-1'),
  playPlaylist = jest.fn(),
  playSong = jest.fn(),
  removeFolder = jest.fn(),
  songItem = song('a'),
}: HarnessProps) => {
  const options: UseLibraryRenderersOptions = {
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenPlaylistDetail,
    onOpenTrackInfo,
    playPlaylist,
    playSong,
    removeFolder,
  };

  const renderers = useLibraryRenderers(options);

  return (
    <>
      <Text testID="layout">{JSON.stringify(renderers.getSongItemLayout(null, 2))}</Text>
      <Text testID="key">{renderers.songKeyExtractor(song('key-song'))}</Text>
      {mockReact.createElement(mockButton, { title: 'direct-song-press', onPress: () => renderers.handleSongPress(song('a')) })}
      {renderers.renderSongItem({ item: songItem })}
      {renderers.renderGroupItem({ item: groupItem })}
      {renderers.renderAlbumTile({ item: albumItem })}
      {renderers.renderPlaylistItem({ item: playlistItem })}
      {renderers.renderFolderItem({ item: folderItem })}
    </>
  );
};

beforeEach(() => {
  mockSongCardProps.length = 0;
  mockGroupRowProps.length = 0;
  mockAlbumTileProps.length = 0;
  mockPlaylistRowProps.length = 0;
  mockFolderRowProps.length = 0;
});

test('returns stable song layout and key extractor helpers', () => {
  const screen = render(<HookHarness />);

  expect(screen.getByTestId('layout').props.children).toBe(JSON.stringify({ length: 62, offset: 124, index: 2 }));
  expect(screen.getByTestId('key').props.children).toBe('key-song');
});

test('handleSongPress uses filteredSongs as the default queue', () => {
  const playSong = jest.fn();
  const screen = render(<HookHarness playSong={playSong} />);

  fireEvent.press(screen.getByText('direct-song-press'));

  expect(playSong).toHaveBeenCalledWith(song('a'), defaultFilteredSongs);
});

test('renderSongItem renders SongCard with buildSongCardSong and forwards presses with the filtered queue', () => {
  const playSong = jest.fn();
  const rawSong = song(' raw-id ', { artist: '', album: '', title: '' });
  const screen = render(<HookHarness playSong={playSong} songItem={rawSong} />);

  expect(mockSongCardProps[0].song).toEqual(buildSongCardSong(rawSong));

  fireEvent.press(screen.getByText('raw-id'));

  expect(playSong).toHaveBeenCalledWith(buildSongCardSong(rawSong), defaultFilteredSongs);
});

test('renderSongItem marks the current song as current and playing only when playback is active', () => {
  render(<HookHarness currentSongId="a" isPlaying songItem={song('a')} />);

  expect(mockSongCardProps[0].isCurrent).toBe(true);
  expect(mockSongCardProps[0].isPlaying).toBe(true);
});

test('renderSongItem keeps non-current and paused songs from receiving playing state', () => {
  render(<HookHarness currentSongId="other" isPlaying songItem={song('a')} />);
  expect(mockSongCardProps[0].isCurrent).toBe(false);
  expect(mockSongCardProps[0].isPlaying).toBe(false);

  mockSongCardProps.length = 0;
  render(<HookHarness currentSongId="a" isPlaying={false} songItem={song('a')} />);
  expect(mockSongCardProps[0].isCurrent).toBe(true);
  expect(mockSongCardProps[0].isPlaying).toBe(false);
});

test('renderSongItem only provides onInfoSong when the track info action should be shown', () => {
  const onOpenTrackInfo = jest.fn();
  const { rerender } = render(<HookHarness onOpenTrackInfo={onOpenTrackInfo} songItem={song('real-song')} />);

  expect(mockSongCardProps[0].onInfoSong).toBe(onOpenTrackInfo);

  mockSongCardProps.length = 0;
  rerender(<HookHarness onOpenTrackInfo={onOpenTrackInfo} songItem={song('demo-1')} />);

  expect(mockSongCardProps[0].onInfoSong).toBeUndefined();
});

test('renderGroupItem plays the first group song with group.songs as the queue', () => {
  const playSong = jest.fn();
  const groupSongs = [song('first-group-song'), song('second-group-song')];
  const screen = render(<HookHarness playSong={playSong} groupItem={group('group-with-songs', groupSongs)} />);

  fireEvent.press(screen.getByText('group-group-with-songs'));

  expect(playSong).toHaveBeenCalledWith(groupSongs[0], groupSongs);
});

test('renderGroupItem does not play anything for an empty group', () => {
  const playSong = jest.fn();
  const screen = render(<HookHarness playSong={playSong} groupItem={group('empty-group', [])} />);

  fireEvent.press(screen.getByText('group-empty-group'));

  expect(playSong).not.toHaveBeenCalled();
});

test('renderAlbumTile plays the first album song with album.songs as the queue', () => {
  const playSong = jest.fn();
  const albumSongs = [song('first-album-song'), song('second-album-song')];
  const screen = render(<HookHarness playSong={playSong} albumItem={group('album-with-songs', albumSongs)} />);

  fireEvent.press(screen.getByText('album-album-with-songs'));

  expect(playSong).toHaveBeenCalledWith(albumSongs[0], albumSongs);
});

test('renderAlbumTile does not play anything for an empty album', () => {
  const playSong = jest.fn();
  const screen = render(<HookHarness playSong={playSong} albumItem={group('empty-album', [])} />);

  fireEvent.press(screen.getByText('album-empty-album'));

  expect(playSong).not.toHaveBeenCalled();
});

test('renderPlaylistItem opens the playlist detail from the row body', () => {
  const onOpenPlaylistDetail = jest.fn();
  const screen = render(<HookHarness onOpenPlaylistDetail={onOpenPlaylistDetail} playlistItem={playlist('playlist-to-open')} />);

  fireEvent.press(screen.getByText('playlist-open-playlist-to-open'));

  expect(onOpenPlaylistDetail).toHaveBeenCalledWith('playlist-to-open');
});

test('renderPlaylistItem calls playPlaylist with the playlist id', () => {
  const playPlaylist = jest.fn();
  const screen = render(<HookHarness playPlaylist={playPlaylist} playlistItem={playlist('playlist-to-play')} />);

  fireEvent.press(screen.getByText('playlist-play-playlist-to-play'));

  expect(playPlaylist).toHaveBeenCalledWith('playlist-to-play');
});

test('renderFolderItem calls removeFolder with the folder object', () => {
  const removeFolder = jest.fn();
  const removableFolder = folder('folder-to-remove');
  const screen = render(<HookHarness removeFolder={removeFolder} folderItem={removableFolder} />);

  fireEvent.press(screen.getByText('folder-folder-to-remove'));

  expect(removeFolder).toHaveBeenCalledWith(removableFolder);
});
