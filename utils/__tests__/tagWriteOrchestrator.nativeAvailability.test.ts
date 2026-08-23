import type { Song } from '../../types/Song';
import { createTagWriteOperationPlan } from '../tagWriteOrchestrator';
import { simulateTagWriteOperation } from './tagWriteOrchestratorTestHelpers';

const safSong: Song = {
  id: 'native-availability',
  title: 'Track',
  artist: 'Artist',
  uri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2Ftrack.mp3',
  fileInfo: {
    extension: 'mp3',
    source: 'saf',
  },
};

const draft = {
  songId: safSong.id,
  tags: { title: 'Updated' },
};

describe('SAF write-plan native availability', () => {
  test('fails closed when runtime capability information is absent', () => {
    const plan = createTagWriteOperationPlan(safSong, draft, 'android');

    expect(plan.permission.canWrite).toBe(false);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
    expect(plan.safetyCapabilities.durableBackup).toBe(false);
    expect(plan.safetyCapabilities.crashRecovery).toBe(false);
  });

  test('fails closed and exposes no safety guarantees without the durable recovery writer', () => {
    const plan = createTagWriteOperationPlan(
      safSong,
      draft,
      'android',
      undefined,
      { safDurableWriterAvailable: false },
    );

    expect(plan.permission.canWrite).toBe(false);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
    expect(plan.backup).toMatchObject({ required: false, strategy: 'none' });
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
    expect(plan.warnings.join(' ')).toMatch(/does not expose the complete durable transaction/i);
    expect(simulateTagWriteOperation(plan).ok).toBe(false);
  });

  test('advertises durable SAF guarantees only when the complete writer contract is loaded', () => {
    const plan = createTagWriteOperationPlan(
      safSong,
      draft,
      'android',
      undefined,
      { safDurableWriterAvailable: true },
    );

    expect(plan.permission.canWrite).toBe(true);
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(plan.backup).toMatchObject({
      required: true,
      strategy: 'app-private-transaction-backup',
    });
    expect(plan.safetyCapabilities).toEqual({
      durableBackup: true,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: true,
      crashRecovery: true,
    });
  });
});
