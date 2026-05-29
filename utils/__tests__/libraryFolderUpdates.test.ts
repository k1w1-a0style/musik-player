import {
  buildFolderUpdatesResult,
  dedupeFolderUpdatesById,
  getChangedFolderUpdates,
  shouldPersistFolderErrorUpdate,
} from '../libraryFolderUpdates';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (patch: Partial<ScanFolder>): ScanFolder => ({
  id: 'folder-1',
  name: 'Music',
  uri: 'content://music',
  addedAt: 1,
  enabled: true,
  ...patch,
});

test('skips update when original folder is missing', () => {
  expect(shouldPersistFolderErrorUpdate(undefined, { lastError: 'No access' })).toBe(false);
});

test('persists update when folder error changed', () => {
  expect(shouldPersistFolderErrorUpdate(folder({ lastError: 'Old' }), { lastError: 'New' })).toBe(true);
});

test('skips update when folder error is unchanged', () => {
  expect(shouldPersistFolderErrorUpdate(folder({ lastError: 'Same' }), { lastError: 'Same' })).toBe(false);
});

test('returns no changed updates when updates are missing', () => {
  expect(getChangedFolderUpdates([folder({})], undefined)).toEqual([]);
});

test('dedupes folder updates by id and keeps the latest update', () => {
  expect(dedupeFolderUpdatesById([
    folder({ id: 'a', lastError: 'old' }),
    folder({ id: 'b', lastError: 'x' }),
    folder({ id: 'a', lastError: 'new' }),
    folder({ id: '   ', lastError: 'ignored' }),
  ])).toEqual([
    folder({ id: 'a', lastError: 'new' }),
    folder({ id: 'b', lastError: 'x' }),
  ]);
});

test('returns only changed updates for currently known folders', () => {
  const current = [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'old' })];
  const updated = [
    folder({ id: 'a', lastError: 'same' }),
    folder({ id: 'b', lastError: 'new' }),
    folder({ id: 'c', lastError: 'stale deleted folder' }),
  ];

  expect(getChangedFolderUpdates(current, updated).map(item => item.id)).toEqual(['b']);
});

test('buildFolderUpdatesResult returns none without changed known updates', () => {
  expect(buildFolderUpdatesResult([folder({})], undefined)).toEqual({ kind: 'none' });
  expect(buildFolderUpdatesResult([folder({ id: 'a', lastError: 'same' })], [folder({ id: 'a', lastError: 'same' })])).toEqual({ kind: 'none' });
  expect(buildFolderUpdatesResult([folder({ id: 'a' })], [folder({ id: 'deleted', lastError: 'No access' })])).toEqual({ kind: 'none' });
});

test('buildFolderUpdatesResult returns changed updates', () => {
  const current = [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'old' })];
  const updated = [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'new' })];

  expect(buildFolderUpdatesResult(current, updated)).toEqual({
    kind: 'changed',
    updates: [folder({ id: 'b', lastError: 'new' })],
  });
});
