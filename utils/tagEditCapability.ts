import type { Song } from '../types/Song';
import type { TagEditCapability, TagEditUriType, TagEditableContainer } from '../types/TagEdit';
import { Platform } from 'react-native';
import { getDefaultReplaceSupportForPlatform } from './tagFileWriteAdapter';

const REMOTE_RE = /^https?:\/\//i;

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeContainerCandidate = (value?: string): string | undefined => {
  const raw = value?.trim();
  if (!raw) return undefined;
  const decoded = safeDecode(raw).toLowerCase().split(/[?#]/)[0] ?? '';
  const direct = decoded.replace(/^audio\//, '');
  if (direct === 'mp3' || direct === 'mpeg') return 'mp3';
  if (direct === 'm4a' || direct === 'mp4') return direct;

  const match = decoded.match(/\.([a-z0-9]+)$/i);
  const ext = match?.[1]?.toLowerCase();
  if (ext === 'mp3' || ext === 'mpeg') return 'mp3';
  if (ext === 'm4a' || ext === 'mp4') return ext;
  return undefined;
};

export const getUriType = (uri?: string): TagEditUriType => {
  if (uri === undefined) return 'unknown';
  const trimmed = uri.trim();
  if (!trimmed) return 'empty';
  if (trimmed !== uri) return 'unknown';
  if (trimmed.startsWith('file://')) return 'file';
  if (trimmed.startsWith('content://')) return 'content';
  if (REMOTE_RE.test(trimmed)) return 'remote';
  return 'unknown';
};

export const getSupportedContainer = (song: Song): TagEditableContainer => {
  const candidates = [
    song.fileInfo?.extension,
    song.fileInfo?.container,
    song.fileInfo?.mimeType,
    song.fileInfo?.filename,
    song.fileInfo?.uri,
    song.uri,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeContainerCandidate(candidate);
    if (normalized === 'mp3') return 'mp3';
    if (normalized === 'm4a') return 'm4a';
    if (normalized === 'mp4') return 'mp4';
  }

  return 'unsupported';
};

export const isFileWriteSupportedOnPlatform = (platform: string): boolean => getDefaultReplaceSupportForPlatform(platform);

/**
 * Planner/UI capability requires confirmed import provenance. URI shape alone is
 * not a write grant and must not enable the Save action for ambiguous content URIs.
 * Direct public-writer calls without provenance remain subject to native permission
 * and provider-writable checks.
 */
export const isSafWritableContentSource = (song: Song): boolean =>
  song.fileInfo?.source === 'saf';

export const getTagEditCapability = (song: Song, platform: string = Platform.OS): TagEditCapability => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const uriType = getUriType(uri);
  const container = getSupportedContainer(song);

  if (uri === undefined) {
    return { canRead: false, canWrite: false, uriType: 'unknown', supportedContainer: container, reason: 'Der Titel hat keine lesbare URI.' };
  }

  if (uriType === 'empty') {
    return { canRead: false, canWrite: false, uriType, supportedContainer: container, reason: 'Die Titel-URI ist leer.' };
  }

  if (uriType === 'remote') {
    return { canRead: true, canWrite: false, uriType, supportedContainer: container, reason: 'Remote-URLs sind schreibgeschützt.' };
  }

  if (container === 'unsupported') {
    return { canRead: true, canWrite: false, uriType, supportedContainer: container, reason: 'Container wird für Tag-Bearbeitung nicht unterstützt.' };
  }

  if (uriType === 'content') {
    const isAndroidSafWritable = platform === 'android' && isSafWritableContentSource(song);
    let reason: string;
    if (isAndroidSafWritable) {
      reason = 'SAF/content:// MP3/M4A/MP4-Schreiben wird nativ mit Berechtigungs-, Temp- und Verifikationsschutz versucht.';
    } else if (platform !== 'android') {
      reason = 'SAF/content:// Schreiben ist nur in der Android-Development-Build unterstützt.';
    } else {
      reason = 'content://-Titel ohne bestätigte SAF-Herkunft sind im Tag-Editor schreibgeschützt.';
    }
    return {
      canRead: true,
      canWrite: isAndroidSafWritable,
      uriType,
      supportedContainer: container,
      reason,
    };
  }

  if (uriType === 'file') {
    const canReplace = isFileWriteSupportedOnPlatform(platform);
    return {
      canRead: true,
      canWrite: canReplace,
      uriType,
      supportedContainer: container,
      reason: canReplace
        ? 'Lokale Datei-Schreibvorgänge werden über Backup-, Temp- und Verifikationsschutz unterstützt.'
        : 'Sicheres Ersetzen vorhandener Dateien wird auf dieser Plattform noch nicht unterstützt.',
    };
  }

  return { canRead: false, canWrite: false, uriType, supportedContainer: container, reason: 'URI-Typ wird nicht unterstützt.' };
};
