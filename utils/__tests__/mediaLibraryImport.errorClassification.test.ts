import { classifySafReadDirectoryError } from '../mediaLibraryImport';

const NOT_DIRECTORY_MESSAGES = [
  'ENOTDIR',
  'not a directory',
  'is not a directory',
  'not directory',
  'not a folder',
] as const;

const PERMISSION_MESSAGES = [
  'timed out',
  'timeout',
  'SecurityException',
  'permission',
  'denied',
  'access',
  "isn't readable",
  'is not readable',
  'not readable',
  'cannot read',
  "can't read",
  'could not read',
  'failed to read',
  'read failed',
  'unreadable',
  'unauthorized',
  'EACCES',
  'EPERM',
  'revoked',
  'provider error',
  'provider failed',
] as const;

describe('SAF native read error classification contract', () => {
  test.each(NOT_DIRECTORY_MESSAGES)(
    'classifies "%s" as not-directory',
    message => {
      expect(classifySafReadDirectoryError(new Error(`Provider: ${message}`))).toBe(
        'not-directory',
      );
    },
  );

  test.each(PERMISSION_MESSAGES)(
    'classifies "%s" as permission',
    message => {
      expect(classifySafReadDirectoryError(new Error(`Provider: ${message}`))).toBe(
        'permission',
      );
    },
  );

  test('prioritizes not-directory markers over permission markers', () => {
    expect(
      classifySafReadDirectoryError(
        new Error('Permission denied because the target is not a directory'),
      ),
    ).toBe('not-directory');
  });

  test('keeps unknown native messages unknown', () => {
    expect(classifySafReadDirectoryError(new Error('random provider failure'))).toBe(
      'unknown',
    );
  });

  test('accepts primitive thrown values case-insensitively', () => {
    expect(classifySafReadDirectoryError('PROVIDER FAILED')).toBe('permission');
  });
});
