import type { Song } from '../types/Song';
import type { TagEditCapability, TagEditUriType, TagEditableContainer } from '../types/TagEdit';
import { Platform } from 'react-native';
import { getDefaultReplaceSupportForPlatform } from './tagFileWriteAdapter';

const REMOTE_RE = /^https?:\/\//i;

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
  const ext = song.fileInfo?.extension ?? song.fileInfo?.container;
  const normalized = ext?.toLowerCase();
  if (normalized === 'mp3') return 'mp3';
  if (normalized === 'm4a') return 'm4a';
  if (normalized === 'mp4') return 'mp4';
  return 'unsupported';
};

export const isSupportedTagEditContainer = (song: Song): boolean => getSupportedContainer(song) !== 'unsupported';

export const isFileWriteSupportedOnPlatform = (platform: string): boolean => getDefaultReplaceSupportForPlatform(platform);

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
    return {
      canRead: true,
      canWrite: container === 'mp3' && platform === 'android',
      uriType,
      supportedContainer: container,
      reason: container === 'mp3' && platform === 'android'
        ? 'SAF/content:// MP3-Schreiben wird nativ mit Berechtigungs-, Temp- und Verifikationsschutz unterstützt.'
        : 'SAF/content:// Schreiben ist für dieses Format noch nicht unterstützt.',
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
