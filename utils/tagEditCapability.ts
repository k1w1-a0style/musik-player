import type { Song } from '../types/Song';
import type { TagEditCapability, TagEditUriType, TagEditableContainer } from '../types/TagEdit';

const REMOTE_RE = /^https?:\/\//i;

export const getUriType = (uri?: string): TagEditUriType => {
  if (!uri) return 'unknown';
  if (uri.startsWith('file://')) return 'file';
  if (uri.startsWith('content://')) return 'content';
  if (REMOTE_RE.test(uri)) return 'remote';
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

export const getTagEditCapability = (song: Song): TagEditCapability => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const uriType = getUriType(uri);
  const container = getSupportedContainer(song);

  if (!uri) {
    return { canRead: false, canWrite: false, uriType: 'unknown', supportedContainer: container, reason: 'Song has no readable URI.' };
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
      reason: 'Requires SAF persistable write permission and provider write support.',
    };
  }

  if (uriType === 'file') {
    return {
      canRead: true,
      canWrite: true,
      uriType,
      supportedContainer: container,
      reason: 'Local file writes are supported through guarded backup/temp verification flow.',
    };
  }

  return { canRead: false, canWrite: false, uriType, supportedContainer: container, reason: 'Unsupported URI type.' };
};
