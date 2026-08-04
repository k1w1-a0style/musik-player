import type { Song } from '../../types/Song';
import type { TagFileWriteAdapter } from '../tagFileWriteAdapter';
import { expoTagFileWriteAdapter } from '../tagFileWriteAdapter';
import { prepareTagEditPlan, writeTagsToFile } from '../tagWriterPublicApi';

const localSong: Song = {
  id: 'local-song',
  title: 'Local',
  artist: 'Artist',
  uri: 'file:///music/local.mp3',
  fileInfo: { extension: 'mp3' },
};

const draft = { songId: localSong.id, tags: {} };

describe('public local tag write crash-safety boundary', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('production plan exposes no write or recovery guarantees for file targets', () => {
    const plan = prepareTagEditPlan(localSong, draft);

    expect(plan.permission.canRead).toBe(true);
    expect(plan.permission.canWrite).toBe(false);
    expect(plan.permission.reason).toMatch(/persistent crash-recovery journal/i);
    expect(plan.blockingReasons).toContain('WriteNotImplemented');
    expect(plan.backup).toEqual({ required: false, strategy: 'none' });
    expect(plan.atomicWrite).toEqual({ required: false, supportsAtomicReplace: false });
    expect(plan.rollback).toEqual({ required: false, supportsRollback: false, steps: [] });
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

  test('default file writer fails before touching the filesystem adapter', async () => {
    const adapterSpies = [
      jest.spyOn(expoTagFileWriteAdapter, 'getInfo'),
      jest.spyOn(expoTagFileWriteAdapter, 'readBytes'),
      jest.spyOn(expoTagFileWriteAdapter, 'copyFile'),
      jest.spyOn(expoTagFileWriteAdapter, 'writeBytes'),
      jest.spyOn(expoTagFileWriteAdapter, 'moveOrReplaceFile'),
      jest.spyOn(expoTagFileWriteAdapter, 'deleteFile'),
    ];

    await expect(writeTagsToFile(localSong, draft)).resolves.toMatchObject({
      status: 'writeFailed',
      sourceUri: localSong.uri,
      errorCode: 'WriteNotImplemented',
      errorMessage: expect.stringMatching(/persistent crash-recovery journal/i),
    });
    adapterSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });

  test('explicit adapter injection still exercises the internal guarded algorithm', async () => {
    const original = new Uint8Array([1, 2, 3]);
    const adapter: TagFileWriteAdapter = {
      canReplaceExistingFile: async () => true,
      getInfo: async () => ({ exists: true, size: original.length, isDirectory: false }),
      readBytes: async () => original.slice(),
      writeBytes: jest.fn(async () => undefined),
      copyFile: jest.fn(async () => undefined),
      moveOrReplaceFile: jest.fn(async () => undefined),
      deleteFile: jest.fn(async () => undefined),
    };

    await expect(writeTagsToFile(localSong, draft, { adapter })).resolves.toMatchObject({
      status: 'noop',
      sourceUri: localSong.uri,
    });
    expect(adapter.readBytes).toHaveBeenCalledWith(localSong.uri);
    expect(adapter.copyFile).not.toHaveBeenCalled();
    expect(adapter.writeBytes).not.toHaveBeenCalled();
    expect(adapter.moveOrReplaceFile).not.toHaveBeenCalled();
  });
});
