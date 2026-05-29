import type { EditableCover, EditableTrackTags } from '../types/TagEdit';
import { detectImageMimeFromBytes } from './imageMime';

const MIN_YEAR = 1900;
const MAX_GENRE_LENGTH = 100;

const trimToUndefined = (value?: string): string | undefined => {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeEditableTags = (tags: EditableTrackTags): EditableTrackTags => ({
  title: trimToUndefined(tags.title),
  artist: trimToUndefined(tags.artist),
  album: trimToUndefined(tags.album),
  year: trimToUndefined(tags.year),
  genre: trimToUndefined(tags.genre),
  trackNumber: trimToUndefined(tags.trackNumber),
  discNumber: trimToUndefined(tags.discNumber),
  comment: trimToUndefined(tags.comment),
});

export const validateYear = (value?: string): boolean => {
  if (!value) return true;
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  const now = new Date().getUTCFullYear() + 1;
  return year >= MIN_YEAR && year <= now;
};

const validatePosition = (value?: string): boolean => !value || /^\d{1,3}(\/\d{1,3})?$/.test(value);

export const validateTrackNumber = (value?: string): boolean => validatePosition(value);
export const validateDiscNumber = (value?: string): boolean => validatePosition(value);

export const validateGenre = (value?: string): boolean => !value || value.length <= MAX_GENRE_LENGTH;

export const validateCoverPayload = (cover?: EditableCover | null): boolean => {
  if (!cover) return true;
  if (cover.data.length === 0) return false;
  return detectImageMimeFromBytes(cover.data) === cover.mimeType;
};

export const validateEditableTags = (tags: EditableTrackTags): { valid: boolean; errors: string[] } => {
  const normalized = normalizeEditableTags(tags);
  const errors: string[] = [];
  if (!validateYear(normalized.year)) errors.push('Invalid year');
  if (!validateTrackNumber(normalized.trackNumber)) errors.push('Invalid track number');
  if (!validateDiscNumber(normalized.discNumber)) errors.push('Invalid disc number');
  if (!validateGenre(normalized.genre)) errors.push('Invalid genre');
  return { valid: errors.length === 0, errors };
};
