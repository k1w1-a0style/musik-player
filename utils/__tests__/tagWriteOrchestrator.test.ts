import type { Song } from '../../types/Song';
import { assertSafeWriteAllowed, createRollbackPlan, createTagWriteOperationPlan, getPrimaryBlockingReason, simulateTagWriteOperation, validateWritePreconditions } from '../tagWriteOrchestrator';
import { writeTagsToFile } from '../tagWriter';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });
const draft = { songId: '1', tags: { title: 'New' } };

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

  test('content:// mp3 shows SAF warning and blocks with MissingWritePermission', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.warnings.join(' ')).toMatch(/SAF/i);
    expect(plan.blockingReasons).toContain('MissingWritePermission');
    expect(plan.estimatedRisk).toBe('high');
  });

  test('assertSafeWriteAllowed returns primary blocking reason', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }), {
      songId: '1',
      tags: { year: '12' },
    });
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
    const result = simulateTagWriteOperation(plan);
    expect(result.primaryBlockingReason).toBeUndefined();
    expect(result.simulatedSteps.join(' ')).toMatch(/no filesystem mutation/i);
  });

  test('writeTagsToFile with content uri returns controlled permissionDenied result', async () => {
    const result = await writeTagsToFile(
      song({ uri: 'content://x.mp3', fileInfo: { extension: 'mp3' } }),
      { songId: '1', tags: {} },
    );

    expect(result).toMatchObject({
      status: 'permissionDenied',
      errorCode: 'MissingWritePermission',
    });
  });
});
