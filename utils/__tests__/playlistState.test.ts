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

  test('prunes across multiple playlists using whitespace-normalized valid song ids', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(910);
    const dirty: Playlist[] = [
      { id: 'pl-a', name: 'A', songIds: ['s1', 'missing'], createdAt: 1, updatedAt: 1 },
      { id: 'pl-b', name: 'B', songIds: [' s2 ', 'missing'], createdAt: 2, updatedAt: 2 },
    ];

    const result = prunePlaylists(dirty, new Set([' s1 ', 's2']));

    expect(result[0].songIds).toEqual(['s1']);
    expect(result[1].songIds).toEqual(['s2']);
    expect(result[0].updatedAt).toBe(910);
    expect(result[1].updatedAt).toBe(910);
    expect(nowSpy).toHaveBeenCalledTimes(1);
  });

  test('returns the same empty array without iterating validSongIds or calling Date.now', () => {
    const empty: Playlist[] = [];
    const validSongIds = new Set(['s1', 's2']);
    const forEachSpy = jest.spyOn(validSongIds, 'forEach');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234);

    const result = prunePlaylists(empty, validSongIds);

    expect(result).toBe(empty);
    expect(forEachSpy).not.toHaveBeenCalled();
    expect(nowSpy).not.toHaveBeenCalled();
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

  test('does not call Date.now when prune is a no-op', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(500);

    const result = prunePlaylists(playlists, new Set(['s1', 's2', 's3']));

    expect(result).toBe(playlists);
    expect(nowSpy).not.toHaveBeenCalled();
  });

  test('does not call Date.now when sanitize is a no-op', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(600);
    const sanitized: Playlist[] = [
      { id: 'pl-1', name: 'One', songIds: ['s1', 's2'], createdAt: 1, updatedAt: 1 },
      { id: 'pl-2', name: 'Two', songIds: ['s3'], createdAt: 2, updatedAt: 2 },
    ];

    const result = sanitizePlaylists(sanitized);

    expect(result).toBe(sanitized);
    expect(nowSpy).not.toHaveBeenCalled();
  });

  test('prune calls Date.now once for multiple changed playlists and shares timestamp', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(700);
    const dirty: Playlist[] = [
      { id: 'pl-1', name: 'One', songIds: ['s1', 'missing', 's1'], createdAt: 1, updatedAt: 1 },
      { id: 'pl-2', name: 'Two', songIds: [' s3 ', '', 's3'], createdAt: 2, updatedAt: 2 },
    ];

    const result = prunePlaylists(dirty, new Set(['s1', 's3']));

    expect(nowSpy).toHaveBeenCalledTimes(1);
    expect(result[0].updatedAt).toBe(700);
    expect(result[1].updatedAt).toBe(700);
  });

  test('sanitize calls Date.now once for multiple changed playlists and shares timestamp', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(800);
    const dirty: Playlist[] = [
      { id: 'pl-1', name: 'One', songIds: [' s1 ', 's1', ''], createdAt: 1, updatedAt: 1 },
      { id: 'pl-2', name: 'Two', songIds: ['s3', '  ', 's3'], createdAt: 2, updatedAt: 2 },
    ];

    const result = sanitizePlaylists(dirty);

    expect(nowSpy).toHaveBeenCalledTimes(1);
    expect(result[0].updatedAt).toBe(800);
    expect(result[1].updatedAt).toBe(800);
  });

  test('renames a playlist by normalized id', () => {
    const renamed = renamePlaylistById(playlists, ' pl-1 ', 'New', 55);
    expect(renamed[0].name).toBe('New');
    expect(renamed[0].updatedAt).toBe(55);
    expect(renamePlaylistById(playlists, 'pl-1', 'One', 56)).toBe(playlists);
    expect(renamePlaylistById(playlists, '   ', 'Nope')).toBe(playlists);
    expect(renamePlaylistById(playlists, 'missing', 'Nope')).toBe(playlists);
  });

  test('renames all playlists with the same normalized id', () => {
    const duplicated: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'New Name', songIds: ['s2'], createdAt: 2, updatedAt: 2 },
      { id: 'other', name: 'Other', songIds: ['s3'], createdAt: 3, updatedAt: 3 },
    ];

    const result = renamePlaylistById(duplicated, ' dup ', 'New Name', 123);
    expect(result).not.toBe(duplicated);
    expect(result[0].name).toBe('New Name');
    expect(result[0].updatedAt).toBe(123);
    expect(result[1]).toBe(duplicated[1]);
    expect(result[1].updatedAt).toBe(2);
    expect(result[2]).toBe(duplicated[2]);
  });

  test('adds a normalized song once to a playlist', () => {
    const result = addSongToPlaylistById(playlists, ' pl-1 ', ' s3 ', 44);
    expect(result[0].songIds).toEqual(['s1', 's2', 's3']);
    expect(result[0].updatedAt).toBe(44);

    const duplicate = addSongToPlaylistById(result, 'pl-1', 's3', 45);
    expect(duplicate).toBe(result);
    expect(addSongToPlaylistById(result, 'pl-1', '   ')).toBe(result);
  });

  test('adds a song to all playlists with the same normalized id', () => {
    const duplicated: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'Two', songIds: ['s2'], createdAt: 2, updatedAt: 2 },
    ];

    const result = addSongToPlaylistById(duplicated, 'dup', 's3', 321);
    expect(result[0].songIds).toEqual(['s1', 's3']);
    expect(result[1].songIds).toEqual(['s2', 's3']);
    expect(result[0].updatedAt).toBe(321);
    expect(result[1].updatedAt).toBe(321);
  });

  test('adds a song across duplicate ids with mixed state and preserves unchanged references', () => {
    const duplicated: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'Two', songIds: ['s1', 's3'], createdAt: 2, updatedAt: 2 },
      { id: 'other', name: 'Other', songIds: ['s9'], createdAt: 3, updatedAt: 3 },
    ];

    const result = addSongToPlaylistById(duplicated, 'dup', 's3', 456);
    expect(result).not.toBe(duplicated);
    expect(result[0].songIds).toEqual(['s1', 's3']);
    expect(result[0].updatedAt).toBe(456);
    expect(result[1]).toBe(duplicated[1]);
    expect(result[2]).toBe(duplicated[2]);
  });

  test('removes a normalized song from a playlist', () => {
    const removed = removeSongFromPlaylistById(playlists, ' pl-1 ', ' s2 ', 33);
    expect(removed[0].songIds).toEqual(['s1']);
    expect(removed[0].updatedAt).toBe(33);
    expect(removeSongFromPlaylistById(playlists, 'pl-1', 's9', 34)).toBe(playlists);
    expect(removeSongFromPlaylistById(playlists, 'pl-1', '   ')).toBe(playlists);
  });

  test('removes a song from all playlists with the same normalized id', () => {
    const duplicated: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1', 's3'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'Two', songIds: ['s2', 's3'], createdAt: 2, updatedAt: 2 },
    ];

    const result = removeSongFromPlaylistById(duplicated, 'dup', 's3', 222);
    expect(result[0].songIds).toEqual(['s1']);
    expect(result[1].songIds).toEqual(['s2']);
    expect(result[0].updatedAt).toBe(222);
    expect(result[1].updatedAt).toBe(222);
  });

  test('removes a song across duplicate ids with mixed state and preserves unchanged references', () => {
    const duplicated: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1', 's3'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'Two', songIds: ['s2'], createdAt: 2, updatedAt: 2 },
      { id: 'other', name: 'Other', songIds: ['s9'], createdAt: 3, updatedAt: 3 },
    ];

    const result = removeSongFromPlaylistById(duplicated, 'dup', 's3', 654);
    expect(result).not.toBe(duplicated);
    expect(result[0].songIds).toEqual(['s1']);
    expect(result[0].updatedAt).toBe(654);
    expect(result[1]).toBe(duplicated[1]);
    expect(result[2]).toBe(duplicated[2]);
  });

  test('does not call Date.now for add/remove no-op and calls it once for multiple changes', () => {
    const noOpNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const dupNoOp: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'Two', songIds: ['s1'], createdAt: 2, updatedAt: 2 },
    ];

    expect(addSongToPlaylistById(dupNoOp, 'dup', 's1')).toBe(dupNoOp);
    expect(removeSongFromPlaylistById(dupNoOp, 'dup', 's9')).toBe(dupNoOp);
    expect(noOpNowSpy).not.toHaveBeenCalled();

    noOpNowSpy.mockClear();
    const dupChange: Playlist[] = [
      { id: 'dup', name: 'One', songIds: ['s1'], createdAt: 1, updatedAt: 1 },
      { id: ' dup ', name: 'Two', songIds: ['s2'], createdAt: 2, updatedAt: 2 },
    ];
    addSongToPlaylistById(dupChange, 'dup', 's3');
    expect(noOpNowSpy).toHaveBeenCalledTimes(1);
  });

  test('deletes a playlist by normalized id', () => {
    expect(deletePlaylistById(playlists, ' pl-1 ').map(playlist => playlist.id)).toEqual(['pl-2']);
    expect(deletePlaylistById(playlists, '   ')).toBe(playlists);
    expect(deletePlaylistById(playlists, 'missing')).toBe(playlists);
  });
});
