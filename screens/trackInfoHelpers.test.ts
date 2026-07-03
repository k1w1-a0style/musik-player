import {
  getTrackInfoAlbum,
  getTrackInfoAlbumArtist,
  getTrackInfoArtist,
  getTrackInfoCodec,
  getTrackInfoContainer,
  getTrackInfoFilename,
  getTrackInfoMimeType,
  getTrackInfoTitle,
  valueOrNA,
} from './trackInfoHelpers';
import type { Song } from '../types/Song';

const baseSong: Song = {
  id: 's1',
  title: 'Title',
  artist: 'Artist',
  uri: 'file:///Music/Artist%20-%20Title.m4a',
};

describe('trackInfoHelpers metadata display', () => {
  test('does not expose raw undefined null or NaN values', () => {
    expect(valueOrNA(undefined)).toBe('Nicht verfügbar');
    expect(valueOrNA('null')).toBe('Nicht verfügbar');
    expect(valueOrNA(Number.NaN)).toBe('Nicht verfügbar');
  });

  test('uses clean fallbacks for missing title artist album and album artist', () => {
    const song: Song = { ...baseSong, title: 'unknown', artist: ' ', album: 'undefined', albumArtist: 'null' };
    expect(getTrackInfoTitle(song)).toBe('Artist - Title');
    expect(getTrackInfoArtist(song)).toBe('Unbekannt');
    expect(getTrackInfoAlbum(song)).toBe('Unbekanntes Album');
    expect(getTrackInfoAlbumArtist(song)).toBe('Unbekannt');
  });

  test('shows M4A audio/mp4 container mime and codec fallbacks', () => {
    const song: Song = {
      ...baseSong,
      fileInfo: { filename: 'Song.m4a', extension: 'm4a', mimeType: 'audio/mp4' },
      audioInfo: {},
    };
    expect(getTrackInfoFilename(song)).toBe('Song.m4a');
    expect(getTrackInfoContainer(song)).toBe('MP4 Audio');
    expect(getTrackInfoMimeType(song)).toBe('audio/mp4');
    expect(getTrackInfoCodec(song)).toBe('audio/mp4');
  });

  test('audio/x-m4a is not treated as unknown', () => {
    const song: Song = { ...baseSong, fileInfo: { extension: 'm4a', mimeType: 'audio/x-m4a' } };
    expect(getTrackInfoMimeType(song)).toBe('audio/x-m4a');
    expect(getTrackInfoContainer(song)).toBe('MP4 Audio');
  });

  test('MP3 display stays explicit', () => {
    const song: Song = { ...baseSong, fileInfo: { filename: 'Song.mp3', extension: 'mp3', mimeType: 'audio/mpeg' }, audioInfo: { codec: 'audio/mpeg' } };
    expect(getTrackInfoContainer(song)).toBe('MP3');
    expect(getTrackInfoMimeType(song)).toBe('audio/mpeg');
    expect(getTrackInfoCodec(song)).toBe('audio/mpeg');
  });
});
