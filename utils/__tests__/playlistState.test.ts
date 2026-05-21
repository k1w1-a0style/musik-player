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
  { id: 'pl-1', name: 'One', songIds: ['s1', 's2'], createdAt: 1 },
  { id: 'pl-2', name: 'Two', songIds: ['s3'], createdAt: 2 },
];

describe('playlistState helpers', () => {
  test('prunes song ids that are no longer in the library', () => {
    const result = prunePlaylists(playlists, new Set(['s1', 's3']));

    expect(result).toEqual([
      { id: 'pl-1', name: 'One', songIds: ['s1'], createdAt: 1 },
      { id: 'pl-2', name: 'Two', songIds: ['s3'], createdAt: 2 },
    ]);
  });

  test('prunes duplicate song ids while preserving order', () => {
    const result = prunePlaylists(
      [{ id: 'pl-1', name: 'One', songIds: ['s1', 'missing', 's1', 's2', 's2'], createdAt: 1 }],
      new Set(['s1', 's2']),
    );

    expect(result[0].songIds).toEqual(['s1', 's2']);
  });

  test('returns the same playlist array when pruning does not change anything', () => {
    expect(prunePlaylists(playlists, new Set(['s1', 's2', 's3']))).toBe(playlists);
  });

  test('sanitizePlaylists removes duplicate ids without requiring a song library', () => {
    const result = sanitizePlaylists([
      { id: 'pl-1', name: 'One', songIds: ['s1', 's1', 's2', 's1', 's3'], createdAt: 1 },
    ]);

    expect(result[0].songIds).toEqual(['s1', 's2', 's3']);
  });

  test('renames a playlist by id', () => {
    expect(renamePlaylistById(playlists, 'pl-1', 'New')[0].name).toBe('New');
  });

  test('adds a song once to a playlist', () => {
    const result = addSongToPlaylistById(playlists, 'pl-1', 's3');
    expect(result[0].songIds).toEqual(['s1', 's2', 's3']);

    const duplicate = addSongToPlaylistById(result, 'pl-1', 's3');
    expect(duplicate[0].songIds).toEqual(['s1', 's2', 's3']);
  });

  test('removes a song from a playlist', () => {
    expect(removeSongFromPlaylistById(playlists, 'pl-1', 's2')[0].songIds).toEqual(['s1']);
  });

  test('deletes a playlist by id', () => {
    expect(deletePlaylistById(playlists, 'pl-1').map(playlist => playlist.id)).toEqual(['pl-2']);
  });
});
