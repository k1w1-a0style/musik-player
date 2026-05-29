import { buildAlbumKey, buildArtistKey, buildLibraryGroups, buildSongKey, cleanPersonLikeLabel, displayAlbum, displayArtist, displayFolderName, displayGenre, groupSongs, mergeSongs, normalizeAlbumName, normalizeArtistName, normalizeLibraryText } from '../libraryPresentation';
import type { Song } from '../../types/Song';

jest.mock('../mediaLibraryImport', () => ({
  deriveFolderNameFromUri: (uri: string) => uri.includes('Music') ? 'Music' : '',
}));

jest.mock('../songArtwork', () => ({
  getSongArtworkUri: (song?: Song) => song?.cover,
}));

const song = (patch: Partial<Song>): Song => ({
  id: patch.id ?? 'id',
  title: patch.title ?? 'Title',
  artist: patch.artist ?? 'Artist',
  uri: patch.uri,
  album: patch.album,
  albumArtist: patch.albumArtist,
  genre: patch.genre,
  cover: patch.cover,
  duration: patch.duration,
  fileInfo: patch.fileInfo,
});

test('cleans SAF/content labels to readable names', () => {
  expect(cleanPersonLikeLabel('primary:Music/Foo Artist.mp3')).toBe('Foo Artist');
  expect(cleanPersonLikeLabel('content://tree/Music/Bar Album.flac')).toBe('Bar Album');
  expect(cleanPersonLikeLabel('Real Artist')).toBe('Real Artist');
});

test('display helpers provide fallbacks', () => {
  expect(displayArtist(song({ artist: '' }))).toBe('Unbekannt');
  expect(displayAlbum(song({ album: undefined }))).toBe('Unbekanntes Album');
  expect(displayGenre(song({ genre: undefined }))).toBe('Unbekanntes Genre');
});

test('displayFolderName prefers derived folder name', () => {
  expect(displayFolderName({ id: 'f1', name: 'Fallback', uri: 'content://Music', addedAt: 1, enabled: true })).toBe('Music');
  expect(displayFolderName({ id: 'f2', name: 'Fallback', uri: 'content://Other', addedAt: 1, enabled: true })).toBe('Fallback');
});

test('displayFolderName falls back to generic folder label', () => {
  expect(displayFolderName({ id: 'f3', name: '', uri: 'content://Other', addedAt: 1, enabled: true })).toBe('Ordner');
});

test('mergeSongs dedupes by uri and keeps newest imported fields', () => {
  const merged = mergeSongs(
    [song({ id: 'old', title: 'Old', artist: 'A', uri: 'file:///same.mp3' })],
    [song({ id: 'new', title: 'New', artist: 'B', album: 'Album', uri: 'file:///same.mp3' })],
  );

  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({ id: 'new', title: 'New', artist: 'B', album: 'Album' });
});

test('mergeSongs dedupes by normalized uri variants and imported song wins', () => {
  const existing = song({
    id: 'old',
    title: 'Old',
    artist: 'A',
    uri: 'file:///Music/Track.mp3?token=1',
  });
  const imported = song({
    id: 'new',
    title: 'Fresh',
    artist: 'B',
    uri: 'file:///music/track.mp3',
  });

  expect(mergeSongs([existing], [imported])).toEqual([{ ...existing, ...imported }]);
});

test('mergeSongs dedupes by id when uri is missing', () => {
  const merged = mergeSongs(
    [song({ id: 'same', title: 'Old', artist: 'A' })],
    [song({ id: 'same', title: 'New', artist: 'B', album: 'Album' })],
  );

  expect(merged).toEqual([song({ id: 'same', title: 'New', artist: 'B', album: 'Album' })]);
});

test('mergeSongs dedupes by stable file fingerprint when uri representation changed', () => {
  const merged = mergeSongs(
    [song({
      id: 'old',
      title: 'Old',
      artist: 'A',
      uri: 'file:///storage/emulated/0/Music/song.mp3',
      duration: 123,
      fileInfo: { filename: 'song.mp3', size: 1000, uri: 'file:///storage/emulated/0/Music/song.mp3' },
    })],
    [song({
      id: 'new',
      title: 'New',
      artist: 'B',
      album: 'Album',
      uri: 'content://media/external/audio/media/42',
      duration: 123,
      fileInfo: { filename: ' song.mp3 ', size: 1000, uri: 'content://media/external/audio/media/42' },
    })],
  );

  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({ id: 'new', title: 'New', artist: 'B', album: 'Album' });
});

test('mergeSongs sorts distinct entries by title', () => {
  expect(mergeSongs(
    [song({ id: 'b', title: 'B', uri: 'file:///b.mp3' })],
    [song({ id: 'a', title: 'A', uri: 'file:///a.mp3' })],
  ).map(item => item.title)).toEqual(['A', 'B']);
});

test('groupSongs groups and sorts with cover fallback', () => {
  const groups = groupSongs([
    song({ id: '2', title: 'Beta', artist: 'B', album: 'Z Album' }),
    song({ id: '1', title: 'Alpha', artist: 'A', album: 'A Album', cover: 'cover-a' }),
    song({ id: '3', title: 'Gamma', artist: 'A', album: 'A Album' }),
  ], 'album');

  expect(groups.map(group => group.title)).toEqual(['A Album', 'Z Album']);
  expect(groups[0].subtitle).toBe('A • 2 Tracks');
  expect(groups[0].cover).toBe('cover-a');
  expect(groups[0].songs.map(item => item.title)).toEqual(['Alpha', 'Gamma']);
});

test('groupSongs does not mutate original song array order', () => {
  const songs = [
    song({ id: '2', title: 'Beta', artist: 'A', album: 'A Album' }),
    song({ id: '1', title: 'Alpha', artist: 'A', album: 'A Album', cover: 'cover-a' }),
  ];
  const originalOrder = songs.map(item => item.id);

  const groups = groupSongs(songs, 'album');

  expect(songs.map(item => item.id)).toEqual(originalOrder);
  expect(groups[0].songs.map(item => item.id)).toEqual(['1', '2']);
});

test('groupSongs uses singular subtitle for one track', () => {
  const groups = groupSongs([song({ id: '1', title: 'Alpha', artist: 'A', genre: 'Techno' })], 'genre');

  expect(groups[0].subtitle).toBe('1 Track');
});

test('buildLibraryGroups matches individual groupSongs outputs', () => {
  const songs = [
    song({ id: '3', title: 'Gamma', artist: 'B', album: 'Z', genre: 'House' }),
    song({ id: '1', title: 'Alpha', artist: 'A', album: 'A', genre: 'Techno', cover: 'cover-a' }),
    song({ id: '2', title: 'Beta', artist: 'A', album: 'A', genre: 'Techno' }),
  ];

  const grouped = buildLibraryGroups(songs);

  expect(grouped.albumGroups).toEqual(groupSongs(songs, 'album'));
  expect(grouped.artistGroups).toEqual(groupSongs(songs, 'artist'));
  expect(grouped.genreGroups).toEqual(groupSongs(songs, 'genre'));
});

test('groupSongs keeps cover selection and title sorting behavior', () => {
  const groups = groupSongs([
    song({ id: '2', title: 'Zulu', album: 'Mix', cover: '' }),
    song({ id: '1', title: 'Alpha', album: 'Mix' }),
    song({ id: '3', title: 'Beta', album: 'Mix', cover: 'picked-cover' }),
  ], 'album');

  expect(groups).toHaveLength(1);
  expect(groups[0].songs.map(item => item.title)).toEqual(['Alpha', 'Beta', 'Zulu']);
  expect(groups[0].cover).toBe('picked-cover');
});


test('normalizeLibraryText applies unicode and whitespace normalization', () => {
  expect(normalizeLibraryText('  Cafe\u0301\tAlbum  ')).toBe('Café Album');
});

test('album keys separate equal album names from different artists', () => {
  const artistAKey = buildAlbumKey(song({ id: 'a', artist: 'Artist A', album: 'Greatest Hits' }));
  const artistBKey = buildAlbumKey(song({ id: 'b', artist: 'Artist B', album: 'Greatest Hits' }));

  expect(artistAKey).not.toBe(artistBKey);
  expect(groupSongs([
    song({ id: 'a', artist: 'Artist A', album: 'Greatest Hits' }),
    song({ id: 'b', artist: 'Artist B', album: 'Greatest Hits' }),
  ], 'album').map(group => group.id)).toEqual([artistAKey, artistBKey]);
});

test('album keys are stable for matching album and artist despite case and whitespace', () => {
  expect(buildAlbumKey(song({ artist: '  Artist A ', album: ' Greatest   Hits ' }))).toBe(
    buildAlbumKey(song({ artist: 'artist a', album: 'greatest hits' })),
  );
});

test('missing album and artist use stable unknown key parts', () => {
  const key = buildAlbumKey(song({ artist: '', album: '' }));

  expect(key).toBe('album:unknown-artist:unknown-album');
  expect(buildArtistKey('')).toBe('artist:unknown-artist');
  expect(normalizeAlbumName(undefined)).toBe('unknown-album');
  expect(normalizeArtistName(undefined)).toBe('unknown-artist');
});

test('album key prefers albumArtist when present', () => {
  expect(buildAlbumKey(song({ artist: 'Track Artist', albumArtist: 'Album Artist', album: 'Record' }))).toBe(
    buildAlbumKey(song({ artist: 'Album Artist', album: 'Record' })),
  );
});

test('songs without album or artist group without crashing', () => {
  const groups = groupSongs([
    song({ id: '1', title: 'One', artist: '', album: undefined }),
    song({ id: '2', title: 'Two', artist: '', album: '' }),
  ], 'album');

  expect(groups).toHaveLength(1);
  expect(groups[0].id).toBe('album:unknown-artist:unknown-album');
  expect(groups[0].title).toBe('Unbekanntes Album');
  expect(groups[0].subtitle).toBe('Unbekannt • 2 Tracks');
});

test('duplicate album titles from different artists stay separated in library groups', () => {
  const grouped = buildLibraryGroups([
    song({ id: '1', artist: 'Artist A', album: 'Live', title: 'A Song' }),
    song({ id: '2', artist: 'Artist B', album: 'Live', title: 'B Song' }),
  ]);

  expect(grouped.albumGroups).toHaveLength(2);
  expect(grouped.albumGroups.map(group => group.subtitle)).toEqual(['Artist A • 1 Track', 'Artist B • 1 Track']);
});

test('song keys do not fall back to array indexes when ids are missing', () => {
  const key = buildSongKey(song({ id: '', title: 'No Id', artist: 'Artist', uri: 'file:///music/no-id.mp3' }));

  expect(key).toBe('song-uri:file:///music/no-id.mp3');
  expect(key).not.toBe('0');
});
