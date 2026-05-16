import { getChangedFolderUpdates, shouldPersistFolderErrorUpdate } from '../libraryFolderUpdates';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (patch: Partial<ScanFolder>): ScanFolder => ({
  id: 'folder-1',
  name: 'Music',
  uri: 'content://music',
  enabled: true,
  ...patch,
});

test('persists update when original folder is missing', () => {
  expect(shouldPersistFolderErrorUpdate(undefined, { lastError: 'No access' })).toBe(true);
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

test('returns only changed folder updates', () => {
  const current = [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'old' })];
  const updated = [folder({ id: 'a', lastError: 'same' }), folder({ id: 'b', lastError: 'new' }), folder({ id: 'c', lastError: 'new folder' })];

  expect(getChangedFolderUpdates(current, updated).map(item => item.id)).toEqual(['b', 'c']);
});
