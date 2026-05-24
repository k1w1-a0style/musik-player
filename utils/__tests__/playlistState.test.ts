import {
  addSongToPlaylistById,
  deletePlaylistById,
  prunePlaylists,
  removeSongFromPlaylistById,
  renamePlaylistById,
  sanitizePlaylists,
} from '../playlistState';
import type { Playlist } from '../../types/Song';

const playlists: Playlist[] = [
  { id: 'pl-1', name: 'One', songIds: ['s1', 's2'], createdAt: 1, updatedAt: 1 },
  { id: 'pl-2', name: 'Two', songIds: ['s3'], createdAt: 2, updatedAt: 2 },
];

describe('playlistState helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('prunes song ids that are no longer in the library', () => {
    jest.spyOn(Date, 'now').mockReturnValue(99);
    const result = prunePlaylists(playlists, new Set(['s1', 's3']));

    expect(result).toEqual([
      { id: 'pl-1', name: 'One', songIds: ['s1'], createdAt: 1, updatedAt: 99 },
      { id: 'pl-2', name: 'Two', songIds: ['s3'], createdAt: 2, updatedAt: 2 },
    ]);
  });

  test('prunes duplicate, blank and whitespace song ids while preserving order', () => {
    jest.spyOn(Date, 'now').mockReturnValue(88);
    const result = prunePlaylists(
      [{ id: 'pl-1', name: 'One', songIds: [' s1 ', 'missing', 's1', '', '  ', 's2', 's2'], createdAt: 1, updatedAt: 1 }],
      new Set(['s1', ' s2 ']),
    );

    expect(result[0].songIds).toEqual(['s1', 's2']);
    expect(result[0].updatedAt).toBe(88);
  });

  test('returns the same playlist array when pruning does not change anything', () => {
    expect(prunePlaylists(playlists, new Set(['s1', 's2', 's3']))).toBe(playlists);
  });

  test('sanitizePlaylists removes duplicate blank ids without requiring a song library', () => {
    jest.spyOn(Date, 'now').mockReturnValue(77);
    const result = sanitizePlaylists([
      { id: 'pl-1', name: 'One', songIds: [' s1 ', 's1', '', 's2', '  ', 's1', 's3'], createdAt: 1, updatedAt: 1 },
    ]);

    expect(result[0].songIds).toEqual(['s1', 's2', 's3']);
    expect(result[0].updatedAt).toBe(77);
  });

  test('renames a playlist by normalized id', () => {
    const renamed = renamePlaylistById(playlists, ' pl-1 ', 'New', 55);
    expect(renamed[0].name).toBe('New');
    expect(renamed[0].updatedAt).toBe(55);
    expect(renamePlaylistById(playlists, 'pl-1', 'One', 56)[0].updatedAt).toBe(1);
    expect(renamePlaylistById(playlists, '   ', 'Nope')).toEqual(playlists);
  });

  test('adds a normalized song once to a playlist', () => {
    const result = addSongToPlaylistById(playlists, ' pl-1 ', ' s3 ', 44);
    expect(result[0].songIds).toEqual(['s1', 's2', 's3']);
    expect(result[0].updatedAt).toBe(44);

    const duplicate = addSongToPlaylistById(result, 'pl-1', 's3', 45);
    expect(duplicate[0].songIds).toEqual(['s1', 's2', 's3']);
    expect(duplicate[0].updatedAt).toBe(44);
    expect(addSongToPlaylistById(result, 'pl-1', '   ')).toEqual(result);
  });

  test('removes a normalized song from a playlist', () => {
    const removed = removeSongFromPlaylistById(playlists, ' pl-1 ', ' s2 ', 33);
    expect(removed[0].songIds).toEqual(['s1']);
    expect(removed[0].updatedAt).toBe(33);
    expect(removeSongFromPlaylistById(playlists, 'pl-1', 's9', 34)[0].updatedAt).toBe(1);
    expect(removeSongFromPlaylistById(playlists, 'pl-1', '   ')).toEqual(playlists);
  });

  test('deletes a playlist by normalized id', () => {
    expect(deletePlaylistById(playlists, ' pl-1 ').map(playlist => playlist.id)).toEqual(['pl-2']);
    expect(deletePlaylistById(playlists, '   ')).toEqual(playlists);
  });
});
