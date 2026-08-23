import {
  getTrackInfoCodec,
  getTrackInfoContainer,
  getTrackInfoFilename,
  getTrackInfoMimeType,
  getTrackInfoTitle,
  valueOrNA,
} from '../trackInfoHelpers';
import type { Song } from '../../types/Song';

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

  test('uses a clean fallback for a missing title', () => {
    const song: Song = { ...baseSong, title: 'unknown', artist: ' ', album: 'undefined', albumArtist: 'null' };
    expect(getTrackInfoTitle(song)).toBe('Title');
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

  test('encoded filenames and SAF URI segments are decoded for display', () => {
    expect(getTrackInfoFilename({ ...baseSong, fileInfo: { filename: 'My%20Song%20%28Live%29.m4a' } })).toBe('My Song (Live).m4a');
    expect(getTrackInfoFilename({ ...baseSong, fileInfo: { uri: 'content://tree/primary%3AMusic%2FMy%20Song.m4a' } })).toBe('My Song.m4a');
    expect(getTrackInfoFilename({ ...baseSong, fileInfo: { filename: 'Normal Song.mp3' } })).toBe('Normal Song.mp3');
  });

  test('audio/x-m4a is not treated as unknown', () => {
    const song: Song = { ...baseSong, fileInfo: { extension: 'm4a', mimeType: 'audio/x-m4a' } };
    expect(getTrackInfoMimeType(song)).toBe('audio/x-m4a');
    expect(getTrackInfoContainer(song)).toBe('MP4 Audio');
  });


  test('m4b extension gets MP4 audio track info fallbacks', () => {
    const song: Song = { ...baseSong, fileInfo: { filename: 'Book.m4b', extension: 'm4b' }, audioInfo: {} };
    expect(getTrackInfoContainer(song)).toBe('MP4 Audio');
    expect(getTrackInfoMimeType(song)).toBe('audio/mp4');
    expect(getTrackInfoCodec(song)).toBe('AAC / MP4 Audio');
  });

  test('mp4 only displays as MP4 Audio with audio evidence', () => {
    expect(getTrackInfoContainer({ ...baseSong, fileInfo: { extension: 'mp4', mimeType: 'audio/mp4' } })).toBe('MP4 Audio');
    expect(getTrackInfoContainer({ ...baseSong, fileInfo: { extension: 'mp4' } })).toBe('MP4');
  });

  test('MP3 display stays explicit', () => {
    const song: Song = { ...baseSong, fileInfo: { filename: 'Song.mp3', extension: 'mp3', mimeType: 'audio/mpeg' }, audioInfo: { codec: 'audio/mpeg' } };
    expect(getTrackInfoContainer(song)).toBe('MP3');
    expect(getTrackInfoMimeType(song)).toBe('audio/mpeg');
    expect(getTrackInfoCodec(song)).toBe('audio/mpeg');
  });
});
