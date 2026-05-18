import { toTrackPlayerTrack } from '../trackPlayerTrack';
import type { Song } from '../../types/Song';

describe('trackPlayerTrack adapter', () => {
  test('maps app song metadata to TrackPlayer track metadata', () => {
    const song: Song = {
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      uri: 'file:///song.mp3',
      cover: 'file:///cover.jpg',
      duration: 123000,
    };

    expect(toTrackPlayerTrack(song)).toEqual({
      id: 's1',
      url: 'file:///song.mp3',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      artwork: 'file:///cover.jpg',
      duration: 123,
    });
  });

  test('uses empty url and undefined duration when optional fields are missing', () => {
    expect(toTrackPlayerTrack({ id: 's2', title: 'No URI', artist: 'Artist' })).toEqual({
      id: 's2',
      url: '',
      title: 'No URI',
      artist: 'Artist',
      album: undefined,
      artwork: undefined,
      duration: undefined,
    });
  });
});
