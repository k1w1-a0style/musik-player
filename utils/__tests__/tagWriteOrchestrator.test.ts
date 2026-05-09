import type { Song } from '../../types/Song';
import { createRollbackPlan, createTagWriteOperationPlan, simulateTagWriteOperation, validateWritePreconditions } from '../tagWriteOrchestrator';
import { writeTagsToFile } from '../tagWriter';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 'A', artist: 'B', ...overrides });
const draft = { songId: '1', tags: { title: 'New' } };

describe('tagWriteOrchestrator dry-run behavior', () => {
  test('remote URL is blocked as UnsupportedUri', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'https://example.com/a.mp3', fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.blockingReasons).toContain('UnsupportedUri');
  });

  test('missing URI is blocked as UnsupportedUri', () => {
    const plan = createTagWriteOperationPlan(song({ fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.blockingReasons).toContain('UnsupportedUri');
  });

  test('unsupported container is blocked as UnsupportedFormat', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.flac', fileInfo: { extension: 'flac' } }), draft);
    expect(plan.blockingReasons).toContain('UnsupportedFormat');
  });

  test('file:// mp3 requires backup/temp/atomic and remains WriteNotImplemented', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.requiresBackup).toBe(true);
    expect(plan.requiresTempFile).toBe(true);
    expect(plan.supportsAtomicReplace).toBe(true);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
  });

  test('content:// mp3 shows SAF warning and blocks with MissingWritePermission', () => {
    const plan = createTagWriteOperationPlan(song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3' } }), draft);
    expect(plan.warnings.join(' ')).toMatch(/SAF/i);
    expect(plan.blockingReasons).toContain('MissingWritePermission');
  });

  test('m4a/mp4 plan created but writer remains not implemented', () => {
    const m4aPlan = createTagWriteOperationPlan(song({ uri: 'file:///a.m4a', fileInfo: { extension: 'm4a' } }), draft);
    const mp4Plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp4', fileInfo: { extension: 'mp4' } }), draft);
    expect(m4aPlan.blockingReasons).toContain('WriteNotImplemented');
    expect(mp4Plan.blockingReasons).toContain('WriteNotImplemented');
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
    const plan = createTagWriteOperationPlan(song({ uri: 'file:///a.mp3', fileInfo: { extension: 'mp3' } }), draft);
    const rollback = createRollbackPlan(plan);
    expect(rollback.steps.length).toBeGreaterThan(0);
    const result = simulateTagWriteOperation(plan);
    expect(result.simulatedSteps.join(' ')).toMatch(/no filesystem mutation/i);
  });

  test('writeTagsToFile remains blocked', async () => {
    await expect(writeTagsToFile()).rejects.toThrow(/disabled/i);
  });
});
