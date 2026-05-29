import {
  buildSongCardSong,
  getLibrarySongItemLayout,
  getLibrarySongKey,
  shouldShowTrackInfoAction,
  SONG_ROW_HEIGHT,
} from '../libraryRendererHelpers';
import type { Song } from '../../types/Song';

const song: Song = {
  id: 's1',
  title: 'Title',
  artist: ' primary:Music/Artist.mp3 ',
  album: '',
};

describe('libraryRendererHelpers', () => {
  test('builds stable song item layout', () => {
    expect(getLibrarySongItemLayout(null, 3)).toEqual({
      length: SONG_ROW_HEIGHT,
      offset: SONG_ROW_HEIGHT * 3,
      index: 3,
    });
  });

  test('builds display-ready song card song', () => {
    expect(buildSongCardSong(song)).toMatchObject({
      id: 's1',
      title: 'Title',
      artist: 'Artist',
      album: 'Unbekanntes Album',
    });
  });

  test('builds stable keys for songs with missing ids', () => {
    expect(getLibrarySongKey({ ...song, id: '', uri: 'file:///Music/Track.mp3' })).toBe('song-uri:file:///music/track.mp3');
    expect(getLibrarySongKey({ ...song, id: '', uri: undefined, title: '  Title ', artist: ' artist ', duration: 10 })).toBe('song-meta:artist:title:10');
  });

  test('sanitizes broken card title and id without crashing', () => {
    expect(buildSongCardSong({ ...song, id: '  ', title: '   ', artist: '', album: undefined })).toMatchObject({
      id: '',
      title: 'Unbekannter Titel',
      artist: 'Unbekannt',
      album: 'Unbekanntes Album',
    });
  });

  test('hides track info action for demo songs', () => {
    expect(shouldShowTrackInfoAction({ ...song, id: 'demo-1' })).toBe(false);
    expect(shouldShowTrackInfoAction(song)).toBe(true);
  });
});
