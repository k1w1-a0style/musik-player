import type { Song } from '../../types/Song';
import { assertSafeWriteAllowed, createRollbackPlan, createTagWriteOperationPlan, getPrimaryBlockingReason, simulateTagWriteOperation, validateWritePreconditions } from '../tagWriteOrchestrator';
import { writeTagsToFile } from '../tagWriter';
import { getTagEditCapability } from '../tagEditCapability';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });
const draft = { songId: '1', tags: { title: 'New' } };
const safMp3Song = (): Song => song({ uri: 'content://tree/song.mp3', fileInfo: { extension: 'mp3', source: 'saf' } });


describe('tagWriteOrchestrator dry-run behavior', () => {
  test('remote URL is blocked as UnsupportedUri', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'https://example.com/a.mp3', fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.blockingReasons).toContain('UnsupportedUri');
    expect(plan.estimatedRisk).toBe('low');
  });

  test('missing URI is blocked as UnsupportedUri', () => {
    const plan = createTagWriteOperationPlan(song({ fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.blockingReasons).toContain('UnsupportedUri');
  });

  test('whitespace-only fileInfo URI is blocked as UnsupportedUri', () => {
    const plan = createTagWriteOperationPlan(
      song({ uri: 'file:///fallback.mp3', fileInfo: { uri: '   ', extension: 'mp3' } }),
      draft,
      'android',
    );

    expect(plan.uriType).toBe('empty');
    expect(plan.blockingReasons).toContain('UnsupportedUri');
  });

  test('whitespace-only song URI is blocked as UnsupportedUri', () => {
    const plan = createTagWriteOperationPlan(song({ uri: '   ', fileInfo: { extension: 'mp3' } }), draft, 'android');

    expect(plan.uriType).toBe('empty');
    expect(plan.blockingReasons).toContain('UnsupportedUri');
  });

  test('simulation is not ok for empty URI type', () => {
    const plan = createTagWriteOperationPlan(song({ uri: '   ', fileInfo: { extension: 'mp3' } }), draft, 'android');
    const result = simulateTagWriteOperation(plan);

    expect(result.ok).toBe(false);
    expect(result.primaryBlockingReason).toBe('UnsupportedUri');
    expect(result.blockingReasons).toContain('UnsupportedUri');
  });

  test('unsupported container is blocked as UnsupportedFormat', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }), draft);
    expect(plan.blockingReasons).toContain('UnsupportedFormat');
  });

  test('android file:// mp3 is plannable without WriteNotImplemented blocking', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft, 'android');
    expect(plan.requiresBackup).toBe(true);
    expect(plan.requiresTempFile).toBe(true);
    expect(plan.supportsAtomicReplace).toBe(false);
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(assertSafeWriteAllowed(plan)).toBeNull();
  });
  test('ios file:// mp3 is blocked with WriteNotImplemented', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft, 'ios');
    expect(plan.permission.canWrite).toBe(false);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
  });

  test('content:// mp3 shows SAF warning and is plannable for native verification flow when source is SAF', () => {
    const plan = createTagWriteOperationPlan(safMp3Song(), draft, 'android');
    expect(plan.warnings.join(' ')).toMatch(/SAF/i);
    expect(plan.blockingReasons).not.toContain('MissingWritePermission');
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(plan.estimatedRisk).toBe('high');
    expect(simulateTagWriteOperation(plan).ok).toBe(true);
    expect(assertSafeWriteAllowed(plan)).toBeNull();
  });

  test('tag edit capability marks Android SAF MP3 content sources writable', () => {
    const safUriWithoutSource = song({
      uri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2Fa.mp3',
      fileInfo: { extension: 'mp3' },
    });

    expect(getTagEditCapability(safMp3Song(), 'android').canWrite).toBe(true);
    expect(getTagEditCapability(safUriWithoutSource, 'android').canWrite).toBe(true);
    expect(getTagEditCapability(song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3', source: 'media-library' } }), 'android').canWrite).toBe(false);
    expect(getTagEditCapability(song({ uri: 'content://tree/a.m4a', fileInfo: { extension: 'm4a', source: 'saf' } }), 'android').canWrite).toBe(true);
    expect(getTagEditCapability(safMp3Song(), 'ios').canWrite).toBe(false);
  });

  test('content:// mp3 cover payload is allowed through native full-buffer rewrite while text-only remains allowed', () => {
    const plan = createTagWriteOperationPlan(
      safMp3Song(),
      { songId: '1', tags: { title: 'X' }, cover: { mimeType: 'image/jpeg', data: new Uint8Array([0xff, 0xd8, 0xff]) } },
      'android',
    );
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(plan.warnings.join(' ')).toMatch(/post-write verification/i);
    expect(plan.safetyCapabilities).toMatchObject({
      durableBackup: true,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: true,
      crashRecovery: true,
    });
    expect(plan.backup.strategy).toBe('app-private-transaction-backup');
    expect(plan.backup.required).toBe(true);
    expect(plan.backup.backupUri).toBeUndefined();
    expect(plan.requiresBackup).toBe(true);
    expect(plan.requiresTempFile).toBe(true);
    expect(plan.rollback.required).toBe(true);
    expect(plan.rollback.supportsRollback).toBe(true);
    expect(plan.supportsRollback).toBe(true);
  });

  test('content:// mp3 removeCover is allowed through native full-buffer rewrite', () => {
    const plan = createTagWriteOperationPlan(
      safMp3Song(),
      { songId: '1', tags: { title: 'X' }, removeCover: true },
      'android',
    );
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
  });

  test('media-library content:// mp3 is blocked before dry-run success', () => {
    const plan = createTagWriteOperationPlan(
      song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3', source: 'media-library' } }),
      draft,
      'android',
    );
    expect(plan.permission.canWrite).toBe(false);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
    expect(simulateTagWriteOperation(plan).ok).toBe(false);
    expect(assertSafeWriteAllowed(plan)).toBe('WriteNotImplemented');
  });

  test('SAF m4a/mp4 content containers are allowed before native full-buffer rewrite', () => {
    const m4aPlan = createTagWriteOperationPlan(
      song({ uri: 'content://tree/a.m4a', fileInfo: { extension: 'm4a', source: 'saf' } }),
      draft,
      'android',
    );
    const mp4Plan = createTagWriteOperationPlan(
      song({ uri: 'content://tree/a.mp4', fileInfo: { extension: 'mp4', source: 'saf' } }),
      draft,
      'android',
    );
    expect(m4aPlan.blockingReasons).not.toContain('UnsupportedFormat');
    expect(mp4Plan.blockingReasons).not.toContain('UnsupportedFormat');
    expect(simulateTagWriteOperation(m4aPlan).ok).toBe(true);
    expect(assertSafeWriteAllowed(m4aPlan)).toBeNull();
  });

  test('content:// mp3 is blocked on non-Android platforms', () => {
    const iosPlan = createTagWriteOperationPlan(safMp3Song(), draft, 'ios');
    const webPlan = createTagWriteOperationPlan(safMp3Song(), draft, 'web');
    expect(iosPlan.blockingReasons).toContain('WriteNotImplemented');
    expect(webPlan.blockingReasons).toContain('WriteNotImplemented');
    expect(simulateTagWriteOperation(iosPlan).ok).toBe(false);
  });

  test('file:// cover edit is not blocked by the SAF cover rule', () => {
    const plan = createTagWriteOperationPlan(
      song({ uri: 'file:///media/a.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: { title: 'X' }, cover: { mimeType: 'image/jpeg', data: new Uint8Array([0xff, 0xd8, 0xff]) } },
      'android',
    );
    expect(plan.blockingReasons).not.toContain('WriteNotImplemented');
  });

  test('assertSafeWriteAllowed returns primary blocking reason', () => {
    const plan = createTagWriteOperationPlan(safMp3Song(), {
      songId: '1',
      tags: { year: '12' },
    }, 'android');
    expect(getPrimaryBlockingReason(plan)).toBe('InvalidTagData');
    expect(assertSafeWriteAllowed(plan)).toBe('InvalidTagData');
  });

  test('android m4a/mp4 file plans are writable and not blocked as WriteNotImplemented', () => {
    const m4aPlan = createTagWriteOperationPlan(song({ uri: 'file:///a.m4a', fileInfo: { extension: 'm4a' } }), draft, 'android');
    const mp4Plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp4', fileInfo: { extension: 'mp4' } }), draft, 'android');
    expect(m4aPlan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(mp4Plan.blockingReasons).not.toContain('WriteNotImplemented');
    expect(m4aPlan.permission.canWrite).toBe(true);
    expect(mp4Plan.permission.canWrite).toBe(true);
  });

  test('invalid draft yields InvalidTagData', () => {
    const codes = validateWritePreconditions(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), {
      songId: '1',
      tags: { year: '12' },
    });
    expect(codes).toContain('InvalidTagData');
  });

  test('removeCover=true prioritizes cover payload', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), {
      songId: '1',
      tags: {},
      cover: { mimeType: 'image/jpeg', data: new Uint8Array([0x00]) },
      removeCover: true,
    });
    expect(plan.warnings).toContain('removeCover=true takes precedence over cover payload.');
    expect(plan.blockingReasons).not.toContain('InvalidTagData');
  });

  test('rollback plan is conceptual and simulation does not mutate files', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft, 'android');
    const rollback = createRollbackPlan(plan);
    expect(rollback.steps.length).toBeGreaterThan(0);
    expect(plan.safetyCapabilities.durableBackup).toBe(true);
    expect(plan.safetyCapabilities.postWriteVerification).toBe(true);
    const result = simulateTagWriteOperation(plan);
    expect(result.primaryBlockingReason).toBeUndefined();
    expect(result.simulatedSteps.join(' ')).toMatch(/no filesystem mutation/i);
  });


  test('SAF capability plan claims durable transaction backup and crash recovery but not atomic replace', () => {
    const plan = createTagWriteOperationPlan(safMp3Song(), draft, 'android');

    expect(plan.backup.strategy).toBe('app-private-transaction-backup');
    expect(plan.backup.required).toBe(true);
    expect(plan.backup.backupUri).toBeUndefined();
    expect(plan.requiresBackup).toBe(true);
    expect(plan.requiresTempFile).toBe(true);
    expect(plan.rollback.required).toBe(true);
    expect(plan.rollback.supportsRollback).toBe(true);
    expect(plan.rollback.steps.join(' ')).toMatch(/app-private transaction backup/i);
    expect(plan.supportsRollback).toBe(true);
    expect(plan.atomicWrite.tempUri).toBeUndefined();
    expect(plan.safetyCapabilities).toEqual({
      durableBackup: true,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: true,
      crashRecovery: true,
    });
    const dryRun = simulateTagWriteOperation(plan).simulatedSteps.join(' ');
    expect(dryRun).toMatch(/app-private SAF transaction backup/i);
    expect(dryRun).toMatch(/Durable backup/i);
    expect(dryRun).not.toMatch(/\.bak|backup sidecar before any write/i);
  });


  test('blocked or unavailable writers expose no safety capabilities', () => {
    const blockedPlans = [
      createTagWriteOperationPlan(
        song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3', source: 'media-library' } }),
        draft,
        'android',
      ),
      createTagWriteOperationPlan(safMp3Song(), draft, 'ios'),
      createTagWriteOperationPlan(song({ uri: 'content://tree/a.flac', fileInfo: { extension: 'flac', source: 'saf' } }), draft, 'android'),
      createTagWriteOperationPlan(song({ uri: '   ', fileInfo: { extension: 'mp3' } }), draft, 'android'),
      createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft, 'ios'),
    ];

    for (const plan of blockedPlans) {
      expect(plan.permission.canWrite).toBe(false);
      expect(plan.safetyCapabilities).toEqual({
        durableBackup: false,
        inMemoryRollback: false,
        atomicReplace: false,
        postWriteVerification: false,
        crashRecovery: false,
      });
      expect(plan.requiresBackup).toBe(false);
      expect(plan.requiresTempFile).toBe(false);
      expect(plan.rollback.required).toBe(false);
      expect(plan.rollback.supportsRollback).toBe(false);
    }
  });

  test('supported file writer exposes durable backup and post-write verification only when writable', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft, 'android');

    expect(plan.permission.canWrite).toBe(true);
    expect(plan.backup.strategy).toBe('sidecar-copy');
    expect(plan.requiresBackup).toBe(true);
    expect(plan.requiresTempFile).toBe(true);
    expect(plan.rollback.required).toBe(true);
    expect(plan.rollback.supportsRollback).toBe(true);
    expect(plan.safetyCapabilities).toEqual({
      durableBackup: true,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: true,
      crashRecovery: false,
    });
  });

  test('writeTagsToFile with content uri returns controlled native-unavailable result', async () => {
    const result = await writeTagsToFile(
      safMp3Song(),
      { songId: '1', tags: { title: 'X' } },
    );

    expect(result).toMatchObject({
      status: 'writeFailed',
      errorCode: 'WriteNotImplemented',
    });
  });
});