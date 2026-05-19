import {
  buildSongCardSong,
  getLibrarySongItemLayout,
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

  test('hides track info action for demo songs', () => {
    expect(shouldShowTrackInfoAction({ ...song, id: 'demo-1' })).toBe(false);
    expect(shouldShowTrackInfoAction(song)).toBe(true);
  });
});
