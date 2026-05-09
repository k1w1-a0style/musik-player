import type { Song } from '../types/Song';
import type { TagEditDraft, TagEditPlan, TagEditableContainer, TagWriterErrorCode } from '../types/TagEdit';
import { getTagEditCapability, getUriType, getSupportedContainer } from './tagEditCapability';
import { validateCoverPayload, validateEditableTags } from './tagValidation';

export class TagWriterError extends Error {
  constructor(public code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
  }
}

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.');

  const capability = getTagEditCapability(song);
  const container = getSupportedContainer(song);
  const warnings = [...(capability.reason ? [capability.reason] : [])];
  if (draft.removeCover && draft.cover) warnings.push('removeCover=true takes precedence over cover payload.');
  if (container === 'mp3') warnings.push('MP3 writer is intentionally disabled in this PR and will throw WriteNotImplemented.');
  if (container === 'm4a' || container === 'mp4') warnings.push('MP4/M4A writing intentionally blocked until safe atom rewrite is implemented.');

  return {
    uri,
    uriType: getUriType(uri),
    container,
    requiresBackup: true,
    requiresFullRewrite: container !== 'unsupported',
    estimatedRisk: capability.uriType === 'file' ? 'medium' : 'high',
    warnings,
  };
};

export const applyTagEditToBuffer = (_buffer: Uint8Array, container: TagEditableContainer, draft: TagEditDraft): Uint8Array => {
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };
  const validation = validateEditableTags(normalized.tags);
  if (!validation.valid) throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (!validateCoverPayload(normalized.cover)) throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');
  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported.');
  if (container === 'mp3' || container === 'm4a' || container === 'mp4') {
    throw new TagWriterError('WriteNotImplemented', 'Container writer intentionally disabled in this PR.');
  }
  throw new TagWriterError('UnsupportedFormat', 'Unknown container.');
};

export const ensureTagEditWriteAllowed = (song: Song): void => {
  const capability = getTagEditCapability(song);
  const container = getSupportedContainer(song);

  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported for writing.');
  if (!song.fileInfo?.uri && !song.uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.');
  if (capability.uriType === 'remote' || capability.uriType === 'unknown') {
    throw new TagWriterError('UnsupportedUri', capability.reason ?? 'URI is not writable.');
  }
  if (capability.uriType === 'file') {
    throw new TagWriterError('WriteNotImplemented', 'Local file writes are intentionally disabled by policy in this PR.');
  }
  if (capability.uriType === 'content') {
    throw new TagWriterError('MissingWritePermission', 'SAF write permission and safe write flow are required.');
  }
};

export const writeTagsToFile = async (): Promise<never> => {
  throw new TagWriterError('WriteNotImplemented', 'Device file writes are intentionally disabled in this preparation step.');
};
