import { asPlayableSong } from '../playableSong';
import { resolvePlayableTrackUrl, toTrackPlayerTrack, tryToTrackPlayerTrack } from '../trackPlayerTrack';
import type { Song } from '../../types/Song';

describe('trackPlayerTrack adapter', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('resolves playable track url from trimmed song uri', () => {
    const playable = asPlayableSong({ id: 'x', title: 't', artist: 'a', uri: ' file:///song.mp3 ' });
    expect(playable).not.toBeNull();
    expect(resolvePlayableTrackUrl(playable!)).toBe('file:///song.mp3');
  });

  test('maps app song metadata to normalized TrackPlayer track metadata', () => {
    const song: Song = {
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      album: ' Album ',
      uri: ' file:///song.mp3 ',
      cover: ' file:///cover.jpg ',
      duration: 123000,
    };

    expect(toTrackPlayerTrack(asPlayableSong(song)!)).toEqual({
      id: 's1',
      url: 'file:///song.mp3',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      artwork: 'file:///cover.jpg',
      duration: 123,
    });
  });

  test('rejects non-playable song conversion and logs warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(tryToTrackPlayerTrack({ id: 's2', title: 'No URI', artist: 'Artist' })).toBeNull();
    expect(warn).toHaveBeenCalledWith('[TrackPlayer] Skipping non-playable song s2.');
  });

  test('uses fallback labels for blank required fields on playable songs', () => {
    expect(toTrackPlayerTrack(asPlayableSong({
      id: '   ',
      uri: 'file:///x.mp3',
      title: '   ',
      artist: '   ',
      album: '   ',
      cover: '   ',
      duration: 0,
    })!)).toEqual({
      id: 'unknown',
      url: 'file:///x.mp3',
      title: 'Unbekannter Titel',
      artist: 'Unbekannt',
      album: undefined,
      artwork: undefined,
      duration: undefined,
    });
  });

  test('prefers normalized coverInfo uri over cover for artwork', () => {
    expect(toTrackPlayerTrack(asPlayableSong({
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      uri: 'file:///song.mp3',
      cover: 'file:///cover.jpg',
      coverInfo: { uri: ' file:///cover-info.jpg ' },
    })!).artwork).toBe('file:///cover-info.jpg');
  });

  test('maps required V4 track fields while allowing missing optional metadata', () => {
    expect(toTrackPlayerTrack(asPlayableSong({
      id: 's-min',
      title: 'Minimal',
      artist: 'Artist',
      uri: 'file:///minimal.mp3',
    })!)).toEqual({
      id: 's-min',
      url: 'file:///minimal.mp3',
      title: 'Minimal',
      artist: 'Artist',
      album: undefined,
      artwork: undefined,
      duration: undefined,
    });
  });

});
