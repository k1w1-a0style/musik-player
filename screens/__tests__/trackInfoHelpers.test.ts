import {
  formatBytes,
  formatCoverStatus,
  formatDuration,
  formatImportedAt,
  formatSampleRate,
  getTrackInfoCoverStatus,
  getTrackInfoCoverUri,
  valueOrNA,
} from '../trackInfoHelpers';
import type { Song } from '../../types/Song';

const song: Song = {
  id: 's1',
  title: 'Song',
  artist: 'Artist',
  cover: 'file:///fallback.jpg',
  coverInfo: {
    status: 'cached',
    uri: 'file:///cached.jpg',
  },
};

describe('trackInfoHelpers', () => {
  test('formats durations', () => {
    expect(formatDuration()).toBe('Nicht verfügbar');
    expect(formatDuration(0)).toBe('Nicht verfügbar');
    expect(formatDuration(245000)).toBe('4:05');
    expect(formatDuration(3723000)).toBe('1:02:03');
  });

  test('formats bytes', () => {
    expect(formatBytes()).toBe('Nicht verfügbar');
    expect(formatBytes(0)).toBe('Nicht verfügbar');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });

  test('formats sample rates', () => {
    expect(formatSampleRate()).toBe('Nicht verfügbar');
    expect(formatSampleRate(0)).toBe('Nicht verfügbar');
    expect(formatSampleRate(44100)).toBe('44.1 kHz');
    expect(formatSampleRate(800)).toBe('800 Hz');
  });

  test('formats cover status', () => {
    expect(formatCoverStatus('cached')).toBe('Gecachtes Cover');
    expect(formatCoverStatus('embedded')).toBe('Eingebettetes Cover');
    expect(formatCoverStatus('external')).toBe('Externe URI');
    expect(formatCoverStatus('none')).toBe('Kein eingebettetes Cover gefunden');
    expect(formatCoverStatus('unknown')).toBe('Unbekannt');
  });

  test('formats empty values as not available', () => {
    expect(valueOrNA()).toBe('Nicht verfügbar');
    expect(valueOrNA('')).toBe('Nicht verfügbar');
    expect(valueOrNA('Song')).toBe('Song');
    expect(valueOrNA(2024)).toBe('2024');
  });

  test('gets cover uri and status from track info metadata', () => {
    expect(getTrackInfoCoverUri(song)).toBe('file:///cached.jpg');
    expect(getTrackInfoCoverStatus(song, 'file:///cached.jpg')).toBe('cached');
  });

  test('falls back to song cover and unknown status', () => {
    const fallbackSong: Song = { id: 's2', title: 'Fallback', artist: 'Artist', cover: 'file:///cover.jpg' };

    expect(getTrackInfoCoverUri(fallbackSong)).toBe('file:///cover.jpg');
    expect(getTrackInfoCoverStatus(fallbackSong, 'file:///cover.jpg')).toBe('unknown');
  });

  test('uses none cover status without any cover uri', () => {
    const noCoverSong: Song = { id: 's3', title: 'No Cover', artist: 'Artist' };

    expect(getTrackInfoCoverUri(noCoverSong)).toBeUndefined();
    expect(getTrackInfoCoverStatus(noCoverSong)).toBe('none');
  });

  test('formats imported dates', () => {
    expect(formatImportedAt()).toBe('Nicht verfügbar');
    expect(formatImportedAt('2024-01-02T03:04:05.000Z')).toContain('2024');
  });
});
