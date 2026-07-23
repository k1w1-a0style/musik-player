import { buildAlbumKey, buildLibraryGroups, groupSongs } from '../libraryPresentation';
import type { Song } from '../../types/Song';

const song = (id: string, albumArtist: string, album?: string): Song => ({
  id,
  title: `Track ${id}`,
  artist: `Artist ${id}`,
  album,
  albumArtist,
});

describe('unknown album grouping', () => {
  test('does not split missing albums by albumArtist', () => {
    const first = song('1', 'Album Artist A');
    const second = song('2', 'Album Artist B', 'unknown');

    expect(buildAlbumKey(first)).toBe('album:unknown-album');
    expect(buildAlbumKey(second)).toBe('album:unknown-album');

    const groups = groupSongs([first, second], 'album');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'album:unknown-album',
      title: 'Unbekanntes Album',
    });
    expect(groups[0].songs).toHaveLength(2);
  });

  test('still distinguishes known albums by albumArtist', () => {
    const first = song('1', 'Album Artist A', 'Shared Album');
    const second = song('2', 'Album Artist B', 'Shared Album');

    expect(buildAlbumKey(first)).not.toBe(buildAlbumKey(second));
    expect(buildLibraryGroups([first, second]).albumGroups).toHaveLength(2);
  });
});
