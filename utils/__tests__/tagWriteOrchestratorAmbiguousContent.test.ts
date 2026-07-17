import type { Song } from '../../types/Song';
import {
  assertSafeWriteAllowed,
  createTagWriteOperationPlan,
  simulateTagWriteOperation,
} from '../tagWriteOrchestrator';

const song = (overrides: Partial<Song>): Song => ({
  id: 'ambiguous-content',
  title: 'A',
  artist: 'B',
  ...overrides,
});

const draft = { songId: 'ambiguous-content', tags: { title: 'New' } };

describe('tag write planner ambiguous content provenance gate', () => {
  test('source-less tree URI is not advertised as SAF-writable', () => {
    const plan = createTagWriteOperationPlan(
      song({
        uri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2Fa.mp3',
        fileInfo: { extension: 'mp3' },
      }),
      draft,
      'android',
      undefined,
      { safDurableWriterAvailable: true },
    );

    expect(plan.permission.canRead).toBe(true);
    expect(plan.permission.canWrite).toBe(false);
    expect(plan.permission.reason).toMatch(/bestätigte SAF-Herkunft/i);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
    expect(assertSafeWriteAllowed(plan)).toBe('WriteNotImplemented');
    expect(simulateTagWriteOperation(plan).ok).toBe(false);
    expect(plan.backup.strategy).toBe('none');
    expect(plan.requiresBackup).toBe(false);
    expect(plan.requiresTempFile).toBe(false);
    expect(plan.supportsRollback).toBe(false);
    expect(plan.safetyCapabilities).toEqual({
      durableBackup: false,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: false,
      crashRecovery: false,
    });
  });

  test('explicit SAF provenance remains writable when the durable writer is available', () => {
    const plan = createTagWriteOperationPlan(
      song({
        uri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2Fa.mp3',
        fileInfo: { extension: 'mp3', source: 'saf' },
      }),
      draft,
      'android',
      undefined,
      { safDurableWriterAvailable: true },
    );

    expect(plan.permission.canWrite).toBe(true);
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(assertSafeWriteAllowed(plan)).toBeNull();
    expect(simulateTagWriteOperation(plan).ok).toBe(true);
    expect(plan.backup.strategy).toBe('app-private-transaction-backup');
    expect(plan.safetyCapabilities.crashRecovery).toBe(true);
  });
});
