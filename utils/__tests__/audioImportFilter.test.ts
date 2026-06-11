import {
  DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS,
  MIN_MUSIC_DURATION_SECONDS,
  getAudioAssetRejectReason,
  isLikelyMusicAsset,
  normalizeAudioImportFilterOptions,
} from '../audioImportFilter';

const asset = (
  filename: string,
  duration: number | undefined,
  uri = `file:///storage/emulated/0/Music/${filename}`,
  mimeType?: string,
  mediaType?: 'audio' | 'photo' | 'video' | 'unknown',
) => ({
  id: filename,
  filename,
  duration,
  uri,
  mimeType,
  mediaType,
});

const expectConsistentRejectReason = (
  item: ReturnType<typeof asset>,
  expectedReason: string | null,
  options?: Parameters<typeof getAudioAssetRejectReason>[1],
) => {
  expect(getAudioAssetRejectReason(item, options)).toBe(expectedReason);
  expect(isLikelyMusicAsset(item, options)).toBe(expectedReason == null);
};

describe('audioImportFilter', () => {
  test('keeps the default minimum music duration at 45 seconds', () => {
    expect(MIN_MUSIC_DURATION_SECONDS).toBe(45);
    expect(DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS).toEqual({
      minMusicDurationSeconds: 45,
      enableDurationFilter: true,
    });
    expect(normalizeAudioImportFilterOptions()).toEqual(DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS);
  });

  test('keeps normal music tracks at or above the default minimum duration', () => {
    expectConsistentRejectReason(asset('The Chainsmokers - Paris.mp3', 221), null);
    expectConsistentRejectReason(asset('exact-threshold.mp3', 45), null);
  });

  test('rejects audio files below 45 seconds by default', () => {
    expectConsistentRejectReason(asset('short-click.mp3', 3), 'shorter-than-45s');
  });

  test('allows the minimum duration to be overridden', () => {
    const item = asset('short-song.mp3', 30);

    expectConsistentRejectReason(item, 'shorter-than-45s');
    expectConsistentRejectReason(item, null, { minMusicDurationSeconds: 30 });
    expectConsistentRejectReason(item, 'shorter-than-60s', { minMusicDurationSeconds: 60 });
  });

  test('can disable only the duration filter for short audio files', () => {
    const item = asset('short-song.mp3', 3);

    expectConsistentRejectReason(item, null, { enableDurationFilter: false });
  });

  test('does not reject undefined or zero durations because of duration alone', () => {
    expectConsistentRejectReason(asset('unknown-duration.mp3', undefined), null);
    expectConsistentRejectReason(asset('zero-duration.mp3', 0), null);
  });

  test('continues to reject non-audio files', () => {
    expectConsistentRejectReason(asset('cover.jpg', 180, undefined, 'image/jpeg'), 'not-audio');
    expectConsistentRejectReason(asset('notes.txt', 180), 'not-audio');
  });

  test('keeps unknown mime types with known audio extensions acceptable', () => {
    expectConsistentRejectReason(asset('track.flac', 180, undefined, 'application/octet-stream'), null);
  });

  test('accepts MediaLibrary audio identity without mime type or whitelisted extension', () => {
    expectConsistentRejectReason(asset('audiobook.m4b', 180, undefined, undefined, 'audio'), null);
  });

  test('keeps MediaLibrary audio identity subject to duration filtering', () => {
    const item = asset('audiobook.m4b', 30, undefined, undefined, 'audio');

    expectConsistentRejectReason(item, 'shorter-than-45s');
    expectConsistentRejectReason(item, null, { enableDurationFilter: false });
  });

  test('treats explicit non-audio media types as authoritative over extension or mime type', () => {
    expectConsistentRejectReason(asset('clip.mp4', 180, undefined, undefined, 'video'), 'not-audio');
    expectConsistentRejectReason(asset('track.mp3', 180, undefined, undefined, 'photo'), 'not-audio');
    expectConsistentRejectReason(asset('voice-note.mp3', 180, undefined, 'audio/mpeg', 'video'), 'not-audio');
  });

  test('allows unknown or missing media type to fall back to mime type or extension identity', () => {
    expectConsistentRejectReason(asset('unknown-media-type.mp3', 180, undefined, undefined, 'unknown'), null);
    expectConsistentRejectReason(asset('known-extension.mp3', 180), null);
  });

  test('rejects assets without audio media type, mime type, or extension identity', () => {
    expectConsistentRejectReason(asset('unknown-format.m4b', 180), 'not-audio');
  });

  test('normalizes invalid duration filter option values back to defaults', () => {
    expect(normalizeAudioImportFilterOptions({ minMusicDurationSeconds: Number.NaN })).toEqual(
      DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS,
    );
    expect(normalizeAudioImportFilterOptions({ minMusicDurationSeconds: -10 })).toEqual(
      DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS,
    );
    expectConsistentRejectReason(asset('short-click.mp3', 3), 'shorter-than-45s', {
      minMusicDurationSeconds: Number.POSITIVE_INFINITY,
    });
  });

  test('rejects WhatsApp audio folders', () => {
    const item = asset('AUD-20260508-WA0001.opus', 80, 'file:///storage/emulated/0/WhatsApp/Media/WhatsApp Audio/AUD-20260508-WA0001.opus');
    expectConsistentRejectReason(item, 'blocked-path:whatsapp');
  });

  test('rejects voice recordings by directory segment', () => {
    expectConsistentRejectReason(
      asset('jam-session.m4a', 120, 'file:///storage/emulated/0/Recordings/jam-session.m4a'),
      'blocked-path:recordings',
    );
  });

  test('rejects ringtone and notification folders', () => {
    expectConsistentRejectReason(asset('alarm.mp3', 90, 'file:///storage/emulated/0/Alarms/alarm.mp3'), 'blocked-path:alarms');
    expectConsistentRejectReason(asset('ping.mp3', 90, 'file:///storage/emulated/0/Notifications/ping.mp3'), 'blocked-path:notifications');
    expectConsistentRejectReason(asset('tone.mp3', 90, 'file:///storage/emulated/0/Ringtones/tone.mp3'), 'blocked-path:ringtones');
  });

  test('does not reject legitimate song or artist names containing blocked words', () => {
    expectConsistentRejectReason(asset('The Alarm - Rain in the Summertime.mp3', 240), null);
    expectConsistentRejectReason(asset('Live Recording - Club Set.mp3', 360, 'file:///storage/emulated/0/Music/Live Recording - Club Set.mp3', 'audio/mpeg'), null);
    expectConsistentRejectReason(asset('Notification - Underground Mix.mp3', 300), null);
  });

  test('rejects obvious voice-note filename prefixes only when mime type is not clearly audio music metadata', () => {
    expectConsistentRejectReason(asset('PTT-20260521-WA0001.opus', 90), 'blocked-filename:ptt-');
    expectConsistentRejectReason(asset('AUD-20260521-WA0001.opus', 90), 'blocked-filename:aud-');
    expectConsistentRejectReason(asset('Voice Recorder 001.m4a', 120), 'blocked-filename:voice recorder');
    expectConsistentRejectReason(asset('Voice Recorder - Techno Remix.mp3', 220, undefined, 'audio/mpeg'), null);
  });

  test('handles encoded folder names and Windows separators', () => {
    expectConsistentRejectReason(asset('clip.opus', 90, 'file:///storage/emulated/0/Voice%20Notes/clip.opus'), 'blocked-path:voice notes');
    expectConsistentRejectReason(asset('clip.mp3', 90, 'file:///storage\\emulated\\0\\Notifications\\clip.mp3'), 'blocked-path:notifications');
  });
});
