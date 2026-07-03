import * as MediaLibrary from 'expo-media-library';
import { isSupportedAudioCandidate } from './audioImportCandidates';

export const MIN_MUSIC_DURATION_SECONDS = 45;

export interface AudioImportFilterOptions {
  /** Minimum positive asset duration required when the duration filter is enabled. */
  minMusicDurationSeconds?: number;
  /** Set to false to keep metadata/path filters but allow short audio files. */
  enableDurationFilter?: boolean;
}

export interface NormalizedAudioImportFilterOptions {
  minMusicDurationSeconds: number;
  enableDurationFilter: boolean;
}

export const DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS: NormalizedAudioImportFilterOptions = {
  minMusicDurationSeconds: MIN_MUSIC_DURATION_SECONDS,
  enableDurationFilter: true,
};

type AudioAssetLike = Pick<MediaLibrary.Asset, 'filename' | 'uri'> &
  Partial<Pick<MediaLibrary.Asset, 'duration' | 'mediaType'>> & { mimeType?: string | null };

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

export const normalizeAudioImportFilterOptions = (
  options: AudioImportFilterOptions = {},
): NormalizedAudioImportFilterOptions => {
  const minMusicDurationSeconds =
    typeof options.minMusicDurationSeconds === 'number' &&
    Number.isFinite(options.minMusicDurationSeconds) &&
    options.minMusicDurationSeconds >= 0
      ? options.minMusicDurationSeconds
      : DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS.minMusicDurationSeconds;

  return {
    minMusicDurationSeconds,
    enableDurationFilter: options.enableDurationFilter ?? DEFAULT_AUDIO_IMPORT_FILTER_OPTIONS.enableDurationFilter,
  };
};

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

const hasAudioMediaType = (asset: AudioAssetLike): boolean => normalize(asset.mediaType) === 'audio';

const hasExplicitNonAudioMediaType = (asset: AudioAssetLike): boolean => {
  const mediaType = normalize(asset.mediaType);
  return mediaType === 'photo' || mediaType === 'video' || mediaType === 'pairedvideo';
};

const hasAudioMimeType = (asset: AudioAssetLike): boolean => isSupportedAudioCandidate({ mimeType: asset.mimeType, displayName: asset.filename, uri: asset.uri }).accepted && normalize(asset.mimeType).startsWith('audio/');

const hasSupportedAudioIdentity = (asset: AudioAssetLike): boolean => {
  // MediaLibrary uses 'unknown' when the platform cannot classify an asset, so MIME/extension
  // checks are still allowed for that value. Explicit photo/video classifications are authoritative.
  if (hasExplicitNonAudioMediaType(asset)) return false;
  return hasAudioMediaType(asset) || isSupportedAudioCandidate({ mimeType: asset.mimeType, displayName: asset.filename, uri: asset.uri }).accepted;
};

export const getAudioAssetRejectReason = (
  asset: AudioAssetLike,
  options: AudioImportFilterOptions = {},
): string | null => {
  const { enableDurationFilter, minMusicDurationSeconds } = normalizeAudioImportFilterOptions(options);
  const duration = typeof asset.duration === 'number' ? asset.duration : undefined;

  if (!hasSupportedAudioIdentity(asset)) return 'not-audio';

  if (enableDurationFilter && duration != null && duration > 0 && duration < minMusicDurationSeconds) {
    return `shorter-than-${minMusicDurationSeconds}s`;
  }

  const directorySegment = blockedDirectorySegment(asset);
  if (directorySegment) return `blocked-path:${directorySegment}`;

  const filenamePrefix = blockedFilenamePrefix(asset);
  if (filenamePrefix && !hasAudioMimeType(asset)) return `blocked-filename:${filenamePrefix}`;

  return null;
};

export const isLikelyMusicAsset = (
  asset: AudioAssetLike,
  options: AudioImportFilterOptions = {},
): boolean => getAudioAssetRejectReason(asset, options) == null;
