import { mergeNativeAudioInfoIntoSong, needsAudioInfoBackfill } from '../songAudioInfoBackfill';
import type { Song } from '../../types/Song';

const baseSong: Song = {
  id: 's1',
  title: 'Song',
  artist: 'Artist',
  uri: 'file:///song.mp3',
  fileInfo: { uri: 'file:///song.mp3' },
};

test('merges native audio info into TrackInfo fields', () => {
  const merged = mergeNativeAudioInfoIntoSong(baseSong, {
    durationMs: 245000,
    bitrateBps: 320000,
    bitrateMode: 'cbr',
    sizeBytes: 1048576,
    sampleRateHz: 44100,
    channels: 2,
    mimeType: 'audio/mpeg',
    displayName: 'song.mp3',
  });

  expect(merged.duration).toBe(245000);
  expect(merged.fileInfo).toMatchObject({ filename: 'song.mp3', mimeType: 'audio/mpeg', size: 1048576 });
  expect(merged.audioInfo).toMatchObject({
    codec: 'audio/mpeg',
    durationMs: 245000,
    bitrate: 320,
    bitrateMode: 'cbr',
    sampleRate: 44100,
    channels: 2,
  });
});

test('falls back to unknown bitrate mode when native cannot classify it', () => {
  const merged = mergeNativeAudioInfoIntoSong(baseSong, {
    bitrateBps: 192000,
    mimeType: 'audio/mpeg',
  });

  expect(merged.audioInfo?.bitrate).toBe(192);
  expect(merged.audioInfo?.bitrateMode).toBe('unknown');
});

test('complete technical data does not need another backfill', () => {
  expect(needsAudioInfoBackfill({
    ...baseSong,
    duration: 245000,
    fileInfo: { uri: 'file:///song.mp3', size: 1048576 },
    audioInfo: { durationMs: 245000, bitrate: 320, sampleRate: 44100, channels: 2 },
  })).toBe(false);
});
