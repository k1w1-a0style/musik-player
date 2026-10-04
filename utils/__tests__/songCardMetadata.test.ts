import {
  formatSongCardDuration,
  getSongCardDurationMs,
  getSongCardFormatLabel,
  getSongCardMetadataLabel,
} from '../songCardMetadata';

describe('songCardMetadata', () => {
  test('formats compact durations', () => {
    expect(formatSongCardDuration(0)).toBeNull();
    expect(formatSongCardDuration(Number.NaN)).toBeNull();
    expect(formatSongCardDuration(65_900)).toBe('1:05');
    expect(formatSongCardDuration(3_723_000)).toBe('1:02:03');
  });

  test('prefers song duration before audioInfo duration', () => {
    expect(getSongCardDurationMs({ duration: 120_000, audioInfo: { durationMs: 90_000 } })).toBe(120_000);
    expect(getSongCardDurationMs({ duration: 0, audioInfo: { durationMs: 90_000 } })).toBe(90_000);
  });

  test('resolves short format labels from file and audio metadata', () => {
    expect(getSongCardFormatLabel({ fileInfo: { extension: '.mp3' } })).toBe('MP3');
    expect(getSongCardFormatLabel({ fileInfo: { container: 'flac' } })).toBe('FLAC');
    expect(getSongCardFormatLabel({ fileInfo: { mimeType: 'audio/mpeg' } })).toBe('MP3');
    expect(getSongCardFormatLabel({ audioInfo: { codec: 'aac' } })).toBe('AAC');
  });

  test('builds combined metadata labels with fallbacks', () => {
    expect(getSongCardMetadataLabel({ duration: 185_000, fileInfo: { extension: 'm4a' } })).toBe('3:05 • M4A');
    expect(getSongCardMetadataLabel({ audioInfo: { durationMs: 62_000 } })).toBe('1:02');
    expect(getSongCardMetadataLabel({ fileInfo: { mimeType: 'audio/flac' } })).toBe('FLAC');
    expect(getSongCardMetadataLabel({})).toBeNull();
  });

  test('includes known kbps and ignores invalid bitrate without inventing a value', () => {
    expect(getSongCardMetadataLabel({ duration: 185_000, audioInfo: { bitrate: 319.8 },
      fileInfo: { extension: 'mp3' } })).toBe('3:05 • MP3 • 320 kbps');
    for (const bitrate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(getSongCardMetadataLabel({ audioInfo: { bitrate } })).toBeNull();
    }
  });
});
