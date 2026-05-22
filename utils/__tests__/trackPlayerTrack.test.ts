import { resolvePlayableTrackUrl, toTrackPlayerTrack } from '../trackPlayerTrack';
import type { Song } from '../../types/Song';

describe('trackPlayerTrack adapter', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('resolves playable track url from trimmed song uri', () => {
    expect(resolvePlayableTrackUrl({ uri: ' file:///song.mp3 ' })).toBe('file:///song.mp3');
    expect(resolvePlayableTrackUrl({ uri: '   ' })).toBe('');
    expect(resolvePlayableTrackUrl({ uri: undefined })).toBe('');
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

  test('uses empty url, warns, and undefined duration when optional fields are missing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(toTrackPlayerTrack({ id: 's2', title: 'No URI', artist: 'Artist' })).toEqual({
      id: 's2',
      url: '',
      title: 'No URI',
      artist: 'Artist',
      album: undefined,
      artwork: undefined,
      duration: undefined,
    });
    expect(warn).toHaveBeenCalledWith('[TrackPlayerTrack] Song s2 has no playable URI.');
  });

  test('uses fallback labels and warning for blank required fields', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(toTrackPlayerTrack({
      id: '   ',
      uri: '   ',
      title: '   ',
      artist: '   ',
      album: '   ',
      cover: '   ',
      duration: 0,
    })).toEqual({
      id: 'unknown',
      url: '',
      title: 'Unbekannter Titel',
      artist: 'Unbekannt',
      album: undefined,
      artwork: undefined,
      duration: undefined,
    });
    expect(warn).toHaveBeenCalledWith('[TrackPlayerTrack] Song     has no playable URI.');
  });

  test('prefers normalized coverInfo uri over cover for artwork', () => {
    expect(toTrackPlayerTrack({
      id: 's1',
      title: 'Song',
      artist: 'Artist',
      uri: 'file:///song.mp3',
      cover: 'file:///cover.jpg',
      coverInfo: { uri: ' file:///cover-info.jpg ' },
    }).artwork).toBe('file:///cover-info.jpg');
  });
});
