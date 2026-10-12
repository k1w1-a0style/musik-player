import { createLibrarySelectionStore } from '../librarySelectionStore';
import type { Song } from '../../types/Song';
const song = (id: string, patch: Partial<Song> = {}): Song => ({ id, title: id, artist: 'Artist', uri: `file:///music/${id}.mp3`, ...patch });

test('retains selections across sorted tabs and title changes, drops replaced physical revision', () => {
  const a = song('a', { fileInfo: { size: 50, modificationTime: 1 } }); const b = song('b');
  const store = createLibrarySelectionStore(); store.reconcile([a,b], [a]); store.start(a);
  store.reconcile([b,{ ...a, title: 'Edited title' }], [b]);
  expect(store.getSnapshot()).toMatchObject({ active: true, count: 1, visibleCount: 1, songIds: ['a'] });
  store.reconcile([{ ...a, fileInfo: { size: 50, modificationTime: 2 } },b], [b]);
  expect(store.getSnapshot().count).toBe(0);
});
test('deduplicates document aliases, preserves URI case and freezes public snapshots', () => {
  const a = song('a', { uri: 'content://provider/tree/root/document/primary%3AMusic%2Fa.mp3' });
  const alias = song('alias', { uri: 'content://provider/document/primary%3AMusic%2Fa.mp3' });
  const other = song('other', { uri: 'content://provider/document/primary%3AMusic%2FA.mp3' });
  const store = createLibrarySelectionStore(); store.reconcile([a,alias,other], [alias,a,other]); store.selectVisible();
  expect(store.getSnapshot()).toMatchObject({ count: 2, visibleCount: 2, songIds: ['a','other'] });
  expect(store.getRowSnapshot(alias)).toBe(2);
  expect(Object.isFrozen(store.getSnapshot())).toBe(true);
  expect(Object.isFrozen(store.getSnapshot().songIds)).toBe(true);
  const ids = store.getCurrentIds(); ids.length = 0; expect(store.getSnapshot().count).toBe(2);
});
test('visible selection adds only the current filtered list and stale callbacks cannot select missing songs', () => {
  const a = song('a'); const b = song('b'); const c = song('c'); const store = createLibrarySelectionStore();
  store.reconcile([a,b,c], [a]); store.selectVisible(); store.reconcile([a,b,c], [b]); store.selectVisible();
  expect(store.getCurrentIds()).toEqual(['a','b']); store.reconcile([a,c], [c]); store.toggle(b);
  expect(store.getCurrentIds()).toEqual(['a']); store.close(); expect(store.getRowSnapshot(a)).toBe(0);
});


test('a removed ID or changed source drops its receipt even if another duplicate is still present', () => {
  const a = song('a'); const alias = { ...a, id: 'alias' }; const store = createLibrarySelectionStore();
  store.reconcile([a,alias], [a]); store.start(a); store.reconcile([alias], [alias]); expect(store.getSnapshot().count).toBe(0);
  store.reconcile([a], [a]); store.start(a); store.reconcile([{ ...a, uri: 'file:///new.mp3' }], []);
  expect(store.getSnapshot().count).toBe(0);
});


test('visible count excludes removed and stale rows before all-visible selection', () => {
  const a = song('a', { fileInfo: { modificationTime: 1 } }); const b = song('b');
  const store = createLibrarySelectionStore(); store.reconcile([{ ...a, fileInfo: { modificationTime: 2 } }], [a,b]);
  expect(store.getSnapshot().visibleCount).toBe(0); store.selectVisible(); expect(store.getSnapshot().count).toBe(0);
});
