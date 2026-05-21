import { getAudioAssetRejectReason, isLikelyMusicAsset } from '../audioImportFilter';

const asset = (
  filename: string,
  duration: number,
  uri = `file:///storage/emulated/0/Music/${filename}`,
  mimeType?: string,
) => ({
  id: filename,
  filename,
  duration,
  uri,
  mimeType,
});

describe('audioImportFilter', () => {
  test('keeps normal music tracks', () => {
    expect(isLikelyMusicAsset(asset('The Chainsmokers - Paris.mp3', 221))).toBe(true);
    expect(getAudioAssetRejectReason(asset('The Chainsmokers - Paris.mp3', 221))).toBeNull();
  });

  test('rejects very short audio clips', () => {
    expect(getAudioAssetRejectReason(asset('short-click.mp3', 3))).toBe('shorter-than-45s');
  });

  test('rejects WhatsApp audio folders', () => {
    const item = asset('AUD-20260508-WA0001.opus', 80, 'file:///storage/emulated/0/WhatsApp/Media/WhatsApp Audio/AUD-20260508-WA0001.opus');
    expect(isLikelyMusicAsset(item)).toBe(false);
    expect(getAudioAssetRejectReason(item)).toBe('blocked-path:whatsapp');
  });

  test('rejects voice recordings by directory segment', () => {
    expect(isLikelyMusicAsset(asset('jam-session.m4a', 120, 'file:///storage/emulated/0/Recordings/jam-session.m4a'))).toBe(false);
  });

  test('rejects ringtone and notification folders', () => {
    expect(isLikelyMusicAsset(asset('alarm.mp3', 90, 'file:///storage/emulated/0/Alarms/alarm.mp3'))).toBe(false);
    expect(isLikelyMusicAsset(asset('ping.mp3', 90, 'file:///storage/emulated/0/Notifications/ping.mp3'))).toBe(false);
    expect(isLikelyMusicAsset(asset('tone.mp3', 90, 'file:///storage/emulated/0/Ringtones/tone.mp3'))).toBe(false);
  });

  test('does not reject legitimate song or artist names containing blocked words', () => {
    expect(isLikelyMusicAsset(asset('The Alarm - Rain in the Summertime.mp3', 240))).toBe(true);
    expect(isLikelyMusicAsset(asset('Live Recording - Club Set.mp3', 360, 'file:///storage/emulated/0/Music/Live Recording - Club Set.mp3', 'audio/mpeg'))).toBe(true);
    expect(isLikelyMusicAsset(asset('Notification - Underground Mix.mp3', 300))).toBe(true);
  });

  test('rejects obvious voice-note filename prefixes only when mime type is not clearly audio music metadata', () => {
    expect(getAudioAssetRejectReason(asset('PTT-20260521-WA0001.opus', 90))).toBe('blocked-filename:ptt-');
    expect(getAudioAssetRejectReason(asset('AUD-20260521-WA0001.opus', 90))).toBe('blocked-filename:aud-');
    expect(getAudioAssetRejectReason(asset('Voice Recorder 001.m4a', 120))).toBe('blocked-filename:voice recorder');
    expect(isLikelyMusicAsset(asset('Voice Recorder - Techno Remix.mp3', 220, undefined, 'audio/mpeg'))).toBe(true);
  });

  test('handles encoded folder names and Windows separators', () => {
    expect(isLikelyMusicAsset(asset('clip.opus', 90, 'file:///storage/emulated/0/Voice%20Notes/clip.opus'))).toBe(false);
    expect(isLikelyMusicAsset(asset('clip.mp3', 90, 'file:///storage\\emulated\\0\\Notifications\\clip.mp3'))).toBe(false);
  });
});
