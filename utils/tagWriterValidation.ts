import type { Song } from '../types/Song';
import type { TagEditDraft, TagEditableContainer } from '../types/TagEdit';
import { getTagEditCapability, getSupportedContainer } from './tagEditCapability';
import { validateCoverPayload, validateEditableTags } from './tagValidation';
import { mergeId3v23TagIntoMp3Buffer } from './tagWriterId3';
import { applyMp4TagEditToBuffer } from './tagWriterMp4';
import { resolveWritableFileTagUri } from './tagWriterPayload';
import { TagWriterError } from './tagWriterError';

export const validateTagWriteDraftOrThrow = (draft: TagEditDraft): void => {
  if (
    !validateEditableTags(draft.tags).valid ||
    !validateCoverPayload(draft.removeCover ? undefined : draft.cover)
  ) {
    throw new TagWriterError('InvalidTagData', 'Draft validation failed.');
  }
};

export const applyTagEditToBuffer = (
  buffer: Uint8Array,
  container: TagEditableContainer,
  draft: TagEditDraft,
): Uint8Array => {
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };
  const validation = validateEditableTags(normalized.tags);
  if (!validation.valid)
    throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (buffer.length === 0)
    throw new TagWriterError('InvalidTagData', 'Empty audio buffer.');
  if (!validateCoverPayload(normalized.cover))
    throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');
  if (container === 'unsupported')
    throw new TagWriterError('UnsupportedFormat', 'Container not supported.');
  if (container === 'm4a' || container === 'mp4')
    return applyMp4TagEditToBuffer(buffer, normalized);
  if (container === 'mp3') return mergeId3v23TagIntoMp3Buffer(buffer, normalized);
  throw new TagWriterError('UnsupportedFormat', 'Unknown container.');
};

export const ensureTagEditWriteAllowed = (song: Song, platform?: string): void => {
  const writableUri = resolveWritableFileTagUri(song);
  if (!writableUri.ok) throw new TagWriterError(writableUri.reason, writableUri.message);
  const capability = getTagEditCapability(song, platform);
  const container = getSupportedContainer(song);
  if (container === 'unsupported')
    throw new TagWriterError('UnsupportedFormat', 'Container not supported for writing.');
  if (!capability.canWrite)
    throw new TagWriterError(
      'WriteNotImplemented',
      capability.reason ?? 'Writing is not supported for this target.',
    );
};
