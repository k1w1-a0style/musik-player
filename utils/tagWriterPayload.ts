import type { Song } from '../types/Song';
import type { TagEditDraft, TagWritePayload, WritableTagUriResolution } from '../types/TagEdit';
import { getSupportedContainer, getUriType } from './tagEditCapability';
import { TagWriterError } from './tagWriterError';

const firstDeclaredUri = (song: Song): { uri?: string; source?: 'fileInfo' | 'song' } => {
  if (song.fileInfo?.uri !== undefined) return { uri: song.fileInfo.uri, source: 'fileInfo' };
  if (song.uri !== undefined) return { uri: song.uri, source: 'song' };
  return {};
};

export const resolveWritableTagUri = (song: Song): WritableTagUriResolution => {
  const { uri, source } = firstDeclaredUri(song);
  if (uri === undefined) {
    return {
      ok: false,
      status: 'unsupportedUri',
      reason: 'UnsupportedUri',
      message: 'Song has no editable URI.',
      uriType: 'unknown',
    };
  }

  const uriType = getUriType(uri);
  if (uriType === 'empty') {
    return {
      ok: false,
      status: 'unsupportedUri',
      reason: 'UnsupportedUri',
      message: 'Song URI is empty.',
      source,
      uriType,
    };
  }
  if (uriType === 'content') {
    return {
      ok: false,
      status: 'permissionDenied',
      reason: 'MissingWritePermission',
      message: 'SAF/content:// write flow is not supported for tag editing yet.',
      source,
      uriType,
    };
  }
  if (uriType !== 'file') {
    return {
      ok: false,
      status: 'unsupportedUri',
      reason: 'UnsupportedUri',
      message: 'URI is not writable for tag editing.',
      source,
      uriType,
    };
  }

  return { ok: true, uri, source: source ?? 'song', uriType };
};

export const buildTagWritePayload = (song: Song, draft: TagEditDraft): TagWritePayload => {
  const writableUri = resolveWritableTagUri(song);
  if (!writableUri.ok) {
    throw new TagWriterError(writableUri.reason, writableUri.message);
  }
  const container = getSupportedContainer(song);
  if (container === 'unsupported') {
    throw new TagWriterError('UnsupportedFormat', 'Container not supported for writing.');
  }
  return {
    songId: song.id,
    uri: writableUri.uri,
    uriSource: writableUri.source,
    container,
    draft,
  };
};
