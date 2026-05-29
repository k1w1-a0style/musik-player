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
    return { canRead: false, canWrite: false, uriType: 'unknown', supportedContainer: container, reason: 'Song has no readable URI.' };
  }

  if (uriType === 'empty') {
    return { canRead: false, canWrite: false, uriType, supportedContainer: container, reason: 'Song URI is empty.' };
  }

  if (uriType === 'remote') {
    return { canRead: true, canWrite: false, uriType, supportedContainer: container, reason: 'Remote URLs are read-only.' };
  }

  if (container === 'unsupported') {
    return { canRead: true, canWrite: false, uriType, supportedContainer: container, reason: 'Container not supported for tag editing.' };
  }

  if (uriType === 'content') {
    return {
      canRead: true,
      canWrite: false,
      uriType,
      supportedContainer: container,
      reason: 'SAF/content:// Schreiben ist noch nicht unterstützt. Der Track kann angezeigt, aber nicht direkt bearbeitet werden.',
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
        ? 'Local file writes are supported through guarded backup/temp verification flow.'
        : 'Safe existing file replacement is not supported on this platform yet.',
    };
  }

  return { canRead: false, canWrite: false, uriType, supportedContainer: container, reason: 'Unsupported URI type.' };
};
