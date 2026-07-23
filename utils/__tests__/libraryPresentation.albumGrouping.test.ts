import { buildLibraryGroups, groupSongs } from '../libraryPresentation';
import type { Song } from '../../types/Song';

jest.mock('../mediaLibraryImport', () => ({
  deriveFolderNameFromUri: () => '',
}));

jest.mock('../songArtwork', () => ({
  getSongArtworkUri: (song?: Song) => song?.cover,
}));

const song = (patch: Partial<Song>): Song => ({
  id: patch.id ?? 'id',
  title: patch.title ?? 'Title',
  artist: patch.artist ?? 'Artist',
  album: patch.album,
  albumArtist: patch.albumArtist,
  uri: patch.uri,
  cover: patch.cover,
  duration: patch.duration,
  genre: patch.genre,
  fileInfo: patch.fileInfo,
  audioInfo: patch.audioInfo,
  coverInfo: patch.coverInfo,
  year: patch.year,
  trackNumber: patch.trackNumber,
  discNumber: patch.discNumber,
});

test('groupSongs keeps a partially tagged known album in the sole albumArtist group', () => {
  const songs = [
    song({ id: 'tagged', title: 'Tagged', album: 'Shared Album', albumArtist: 'Album Artist' }),
    song({ id: 'legacy', title: 'Legacy', album: 'Shared Album', albumArtist: undefined }),
  ];

  const groups = groupSongs(songs, 'album');

  expect(groups).toHaveLength(1);
  expect(groups[0].id).toBe('album:shared album::album artist');
  expect(groups[0].songs.map(item => item.id).sort()).toEqual(['legacy', 'tagged']);
});

test('buildLibraryGroups uses the same inferred key for partially tagged albums', () => {
  const songs = [
    song({ id: 'tagged', title: 'Tagged', album: 'Shared Album', albumArtist: 'Album Artist' }),
    song({ id: 'legacy', title: 'Legacy', album: 'Shared Album', albumArtist: '' }),
  ];

  const groups = buildLibraryGroups(songs).albumGroups;

  expect(groups).toHaveLength(1);
  expect(groups[0].id).toBe('album:shared album::album artist');
  expect(groups[0].songs.map(item => item.id).sort()).toEqual(['legacy', 'tagged']);
});

test('different known albumArtists for the same album name remain separate', () => {
  const groups = groupSongs([
    song({ id: 'a', title: 'A', album: 'Greatest Hits', albumArtist: 'Artist A' }),
    song({ id: 'b', title: 'B', album: 'Greatest Hits', albumArtist: 'Artist B' }),
  ], 'album');

  expect(groups.map(group => group.id).sort()).toEqual([
    'album:greatest hits::artist a',
    'album:greatest hits::artist b',
  ]);
});

test('unknown albums stay in the shared unknown group even with albumArtist metadata', () => {
  const groups = groupSongs([
    song({ id: 'a', title: 'A', album: 'unknown', albumArtist: 'Artist A' }),
    song({ id: 'b', title: 'B', album: undefined, albumArtist: 'Artist B' }),
  ], 'album');

  expect(groups).toHaveLength(1);
  expect(groups[0].id).toBe('album:unknown-album');
});
