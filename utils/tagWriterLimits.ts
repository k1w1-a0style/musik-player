import { TagWriterError } from './tagWriterError';

/**
 * Hard safety ceiling shared by file and SAF tag writers. Callers may request a
 * smaller limit, but never widen this boundary at runtime.
 */
export const DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES = 50 * 1024 * 1024;

export const resolveSafeTagWriteMaxFileSizeBytes = (requested?: number): number => {
  const value = requested ?? DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TagWriterError(
      'InvalidTagData',
      'Maximum file size must be a positive safe integer.',
    );
  }
  if (value > DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES) {
    throw new TagWriterError(
      'FileTooLarge',
      `Maximum file size cannot exceed ${Math.round(DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES / (1024 * 1024))} MB.`,
    );
  }
  return value;
};

export const classifyTagWriteMaxFileSizeBytes = (
  requested: number,
): 'InvalidTagData' | 'FileTooLarge' | undefined => {
  if (!Number.isSafeInteger(requested) || requested <= 0) return 'InvalidTagData';
  if (requested > DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES) return 'FileTooLarge';
  return undefined;
};
