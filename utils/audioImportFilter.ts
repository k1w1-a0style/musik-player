import * as MediaLibrary from 'expo-media-library';

export const MIN_MUSIC_DURATION_SECONDS = 45;

type AudioAssetLike = Pick<MediaLibrary.Asset, 'filename' | 'uri'> &
  Partial<Pick<MediaLibrary.Asset, 'duration'>> & { mimeType?: string | null };

const BLOCKED_DIRECTORY_SEGMENTS = new Set([
  'whatsapp',
  'whatsapp audio',
  'whatsapp voice notes',
  'voice notes',
  'voice_note',
  'voicenote',
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
]);

const BLOCKED_FILENAME_PREFIXES = [
  'ptt-',
  'aud-',
  'voice recorder',
  'voice note',
  'sound recorder',
  'recording_',
  'recording-',
  'recording ',
];

const normalize = (value?: string | null): string => {
  const raw = value ?? '';
  try {
    return decodeURIComponent(raw).toLowerCase().replace(/\\/g, '/');
  } catch {
    return raw.toLowerCase().replace(/\\/g, '/');
  }
};

const stripQueryAndFragment = (value: string): string => value.split(/[?#]/)[0] ?? '';

const stripUriScheme = (value: string): string =>
  value.replace(/^[a-z][a-z0-9+.-]*:\/+/i, '');

const pathSegments = (uri?: string | null): string[] =>
  stripUriScheme(stripQueryAndFragment(normalize(uri)))
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);

const filenameStem = (filename?: string | null, uri?: string | null): string => {
  const normalizedFilename = normalize(filename);
  const fallback = pathSegments(uri).pop() ?? '';
  const base = normalizedFilename || fallback;
  return stripQueryAndFragment(base).replace(/\.[^.]+$/, '').trim();
};

const blockedDirectorySegment = (asset: AudioAssetLike): string | undefined =>
  pathSegments(asset.uri).find(segment => BLOCKED_DIRECTORY_SEGMENTS.has(segment));

const blockedFilenamePrefix = (asset: AudioAssetLike): string | undefined => {
  const stem = filenameStem(asset.filename, asset.uri);
  return BLOCKED_FILENAME_PREFIXES.find(prefix => stem.startsWith(prefix));
};

const hasAudioMimeType = (asset: AudioAssetLike): boolean => {
  const mime = normalize(asset.mimeType);
  return mime.startsWith('audio/');
};

export const getAudioAssetRejectReason = (asset: AudioAssetLike): string | null => {
  const duration = typeof asset.duration === 'number' ? asset.duration : undefined;

  if (duration != null && duration > 0 && duration < MIN_MUSIC_DURATION_SECONDS) {
    return `shorter-than-${MIN_MUSIC_DURATION_SECONDS}s`;
  }

  const directorySegment = blockedDirectorySegment(asset);
  if (directorySegment) return `blocked-path:${directorySegment}`;

  const filenamePrefix = blockedFilenamePrefix(asset);
  if (filenamePrefix && !hasAudioMimeType(asset)) return `blocked-filename:${filenamePrefix}`;

  return null;
};

export const isLikelyMusicAsset = (asset: AudioAssetLike): boolean => getAudioAssetRejectReason(asset) == null;
