import type { TagWriterErrorCode } from '../types/TagEdit';

export const normalizeTagWriterErrorCode = (
  code: TagWriterErrorCode,
  message: string,
): TagWriterErrorCode => {
  if (code !== 'WriteNotImplemented') return code;
  if (message.includes('ID3v2.2')) return 'WriteNotImplementedV22';
  if (message.includes('ID3v2.4')) return 'WriteNotImplementedV24';
  return code;
};

export class TagWriterError extends Error {
  public code: TagWriterErrorCode;

  constructor(code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
    this.code = normalizeTagWriterErrorCode(code, message);
  }
}

export const tagWriterWarn = (message: string, error?: unknown): void => {
  if (error === undefined) {
    console.warn(`[TagWriter] ${message}`);
    return;
  }
  console.warn(`[TagWriter] ${message}`, error);
};
