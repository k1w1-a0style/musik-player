import { getAudioAssetRejectReason, isLikelyMusicAsset } from '../audioImportFilter';

const asset = (filename: string, duration: number, uri = `file:///storage/emulated/0/Music/${filename}`) => ({
  id: filename,
  filename,
  duration,
  uri,
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
  });

  test('rejects voice recordings', () => {
    expect(isLikelyMusicAsset(asset('Voice Recorder 001.m4a', 120))).toBe(false);
  });

  test('rejects ringtone and notification folders', () => {
    expect(isLikelyMusicAsset(asset('alarm.mp3', 90, 'file:///storage/emulated/0/Alarms/alarm.mp3'))).toBe(false);
    expect(isLikelyMusicAsset(asset('ping.mp3', 90, 'file:///storage/emulated/0/Notifications/ping.mp3'))).toBe(false);
    expect(isLikelyMusicAsset(asset('tone.mp3', 90, 'file:///storage/emulated/0/Ringtones/tone.mp3'))).toBe(false);
  });
});
