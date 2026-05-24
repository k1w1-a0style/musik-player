import {
  appendPlaylist,
  buildPlaylistQueue,
  createPlaylistRecord,
  createPlaylistRecordFromQueue,
  runPlayPlaylistAction,
} from '../playlistActionHelpers';
import type { Playlist, Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' },
];

const playlist: Playlist = {
  id: 'pl-1',
  name: 'List',
  songIds: ['s2', 'missing', 's1'],
  createdAt: 1,
  updatedAt: 1,
};

describe('playlistActionHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates playlist records', () => {
    const created = createPlaylistRecord('Created', 123);

    expect(created.name).toBe('Created');
    expect(created.songIds).toEqual([]);
    expect(created.createdAt).toBe(123);
    expect(created.updatedAt).toBe(123);
    expect(created.id).toEqual(expect.any(String));
  });

  test('creates playlist records from playback queues', () => {
    const created = createPlaylistRecordFromQueue('Queue Mix', [songs[0], songs[1], songs[0]], 123);

    expect(created).toMatchObject({
      name: 'Queue Mix',
      songIds: ['s1', 's2'],
      createdAt: 123,
      updatedAt: 123,
    });
    expect(created?.id).toEqual(expect.any(String));
  });

  test('returns null for empty queue playlists', () => {
    expect(createPlaylistRecordFromQueue('Empty', [], 123)).toBeNull();
  });

  test('uses fallback name for unnamed queue playlists', () => {
    expect(createPlaylistRecordFromQueue('   ', songs, 123)?.name).toBe('Gespeicherte Queue');
  });

  test('appends playlists immutably', () => {
    const created = createPlaylistRecord('Created', 123);
    const source = [playlist];

    expect(appendPlaylist(source, created)).toEqual([playlist, created]);
    expect(source).toEqual([playlist]);
  });

  test('builds playlist queues while skipping missing songs', () => {
    expect(buildPlaylistQueue(playlist, songs)).toEqual([songs[1], songs[0]]);
  });

  test('plays playlist queue from first song', async () => {
    const playSong = jest.fn(async () => undefined);

    await runPlayPlaylistAction({
      playlistId: 'pl-1',
      playlists: [playlist],
      songs,
      playSong,
    });

    expect(playSong).toHaveBeenCalledWith(songs[1], [songs[1], songs[0]]);
  });

  test('ignores unknown or empty playlists', async () => {
    const playSong = jest.fn(async () => undefined);

    await runPlayPlaylistAction({ playlistId: 'missing', playlists: [playlist], songs, playSong });
    await runPlayPlaylistAction({
      playlistId: 'empty',
      playlists: [{ id: 'empty', name: 'Empty', songIds: [], createdAt: 1, updatedAt: 1 }],
      songs,
      playSong,
    });

    expect(playSong).not.toHaveBeenCalled();
  });
});
