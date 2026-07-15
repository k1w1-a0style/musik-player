import type { TagWriterErrorCode } from '../types/TagEdit';

const knownTagWriterErrorCodes = new Set<TagWriterErrorCode>([
  'UnsupportedFormat',
  'UnsupportedUri',
  'MissingWritePermission',
  'InvalidTagData',
  'FileTooLarge',
  'WriteNotImplemented',
  'WriteNotImplementedV22',
  'WriteNotImplementedV24',
  'BackupFailed',
  'TempWriteFailed',
  'ReplaceFailed',
  'RollbackFailed',
  'VerificationFailed',
  'TransactionConflict',
  'RecoveryPending',
  'RecoveryFailed',
  'BackupCorrupted',
  'InsufficientStorage',
]);

export const normalizeTagWriterErrorCode = (
  value: unknown,
  message = '',
): TagWriterErrorCode => {
  const code = typeof value === 'string' && knownTagWriterErrorCodes.has(value as TagWriterErrorCode)
    ? value as TagWriterErrorCode
    : 'ReplaceFailed';
  if (code !== 'WriteNotImplemented') return code;
  if (message.includes('ID3v2.2')) return 'WriteNotImplementedV22';
  if (message.includes('ID3v2.4')) return 'WriteNotImplementedV24';
  return code;
};

export class TagWriterError extends Error {
  public code: TagWriterErrorCode;

  constructor(code: unknown, message: string) {
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
