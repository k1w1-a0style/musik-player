import * as MediaLibrary from 'expo-media-library';

export const MIN_MUSIC_DURATION_SECONDS = 45;

type AudioAssetLike = Pick<MediaLibrary.Asset, 'filename' | 'uri'> & Partial<Pick<MediaLibrary.Asset, 'duration'>>;

const BLOCKED_AUDIO_PATH_PATTERNS = [
  'whatsapp',
  'voice notes',
  'voice_note',
  'voicenote',
  'ptt-',
  'recordings',
  'recording',
  'recorder',
  'sound_recorder',
  'sound recorder',
  'ringtones',
  'ringtone',
  'notifications',
  'notification',
  'alarms',
  'alarm',
];

const normalize = (value?: string | null): string => value?.toLowerCase().replace(/\\/g, '/') ?? '';

const getAssetHaystack = (asset: AudioAssetLike): string => `${normalize(asset.filename)} ${normalize(asset.uri)}`;

export const getAudioAssetRejectReason = (asset: AudioAssetLike): string | null => {
  const haystack = getAssetHaystack(asset);
  const duration = typeof asset.duration === 'number' ? asset.duration : undefined;

  if (duration != null && duration > 0 && duration < MIN_MUSIC_DURATION_SECONDS) {
    return `shorter-than-${MIN_MUSIC_DURATION_SECONDS}s`;
  }

  const blockedPattern = BLOCKED_AUDIO_PATH_PATTERNS.find(pattern => haystack.includes(pattern));
  if (blockedPattern) return `blocked-path:${blockedPattern}`;

  return null;
};

export const isLikelyMusicAsset = (asset: AudioAssetLike): boolean => getAudioAssetRejectReason(asset) == null;
