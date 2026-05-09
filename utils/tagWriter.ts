import type { Song } from '../types/Song';
import type { TagEditDraft, TagEditPlan, TagEditableContainer, TagWriterErrorCode, WriteOrchestrationResult } from '../types/TagEdit';
import { getTagEditCapability, getUriType, getSupportedContainer } from './tagEditCapability';
import { validateCoverPayload, validateEditableTags } from './tagValidation';
import { createTagWriteOperationPlan, simulateTagWriteOperation } from './tagWriteOrchestrator';

export class TagWriterError extends Error {
  constructor(public code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
  }
}

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan => createTagWriteOperationPlan(song, draft);

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

export const prepareWriteOnly = (song: Song, draft: TagEditDraft): TagEditPlan => createTagWriteOperationPlan(song, draft);

export const dryRunWriteTags = (song: Song, draft: TagEditDraft): WriteOrchestrationResult => {
  const plan = createTagWriteOperationPlan(song, draft);
  return simulateTagWriteOperation(plan);
};

export const writeTagsToFile = async (): Promise<never> => {
  throw new TagWriterError('WriteNotImplemented', 'Device file writes are intentionally disabled in this preparation step.');
};
