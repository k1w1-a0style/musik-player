import {
  countValidPlaylistSongs,
  formatPlaylistSongCount,
  normalizePlaylistName,
} from '../playlistHelpers';
import type { Playlist, Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'Artist' },
  { id: 's2', title: 'Two', artist: 'Artist' },
];

const playlist: Playlist = {
  id: 'p1',
  name: 'Playlist',
  songIds: ['s1', 'missing', 's2'],
  createdAt: 1,
};

describe('playlistHelpers', () => {
  test('normalizes playlist names', () => {
    expect(normalizePlaylistName('  Techno  ')).toBe('Techno');
    expect(normalizePlaylistName('   ')).toBe('');
  });

  test('counts only songs that still exist in library', () => {
    expect(countValidPlaylistSongs(playlist, songs)).toBe(2);
  });

  test('formats song count label', () => {
    expect(formatPlaylistSongCount(0)).toBe('0 Titel');
    expect(formatPlaylistSongCount(1)).toBe('1 Titel');
    expect(formatPlaylistSongCount(2)).toBe('2 Titel');
  });
});
