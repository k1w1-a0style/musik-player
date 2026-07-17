import type { AudioTagWriteRequest } from 'expo-system-audio';
import type { TagEditDraft, TagEditableContainer } from '../types/TagEdit';
import { encodeBytesToBase64 } from './base64';

const textTagFields = ['title', 'artist', 'albumArtist', 'album', 'year', 'genre', 'trackNumber', 'discNumber', 'comment'] as const;

export const changedFieldsForNativeTagDraft = (draft: TagEditDraft): string[] => {
  const fields: string[] = textTagFields.filter(field => Object.prototype.hasOwnProperty.call(draft.tags, field));
  if (draft.cover || draft.removeCover) fields.push('cover');
  return fields;
};

export const buildNativeTagWriteRequest = (
  draft: TagEditDraft,
  container: TagEditableContainer,
  maxFileSizeBytes: number,
): AudioTagWriteRequest => ({
  tags: { ...draft.tags },
  container,
  removeCover: Boolean(draft.removeCover),
  cover: draft.removeCover || !draft.cover
    ? undefined
    : {
        mimeType: draft.cover.mimeType,
        dataBase64: encodeBytesToBase64(draft.cover.data),
      },
  maxFileSizeBytes,
  changedFields: changedFieldsForNativeTagDraft(draft),
});
