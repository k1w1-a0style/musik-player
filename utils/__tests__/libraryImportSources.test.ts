import { createImportSourceSelection, getImportSourceKey, preserveImportedSource } from '../libraryImportSources';
import { getWaveformSourceIdentity } from '../waveformGenerator';

const oldUri = 'content://provider/tree/primary%3AMusic/document/primary%3AMusic%2FTrack.mp3';
const newUri = 'content://provider/tree/primary%3A/document/primary%3AMusic%2FTrack.mp3';
const old = { id: 'old', title: 'Old title', artist: 'Artist', uri: oldUri,
  fileInfo: { uri: oldUri, importedAt: 10, size: 1000 } };

test('overlapping SAF grants identify the same physical document', () => {
  expect(getImportSourceKey(oldUri)).toBe(getImportSourceKey(newUri));
  expect(getImportSourceKey('content://other/document/primary%3AMusic%2FTrack.mp3'))
    .not.toBe(getImportSourceKey(oldUri));
  const selection = createImportSourceSelection({ existingSongs: [old] });
  expect(selection.include(newUri)).toBe(false);
  expect(selection.include(newUri)).toBe(false);
  expect(selection.getReusedCount()).toBe(1);
  expect(selection.include('file:///New.mp3')).toBe(true);
});

test('metadata refresh preserves prepared audio identity and track references', () => {
  const incoming = { ...old, id: newUri, uri: newUri, title: 'Corrected title',
    fileInfo: { ...old.fileInfo, uri: newUri, importedAt: 20 } };
  const merged = preserveImportedSource(incoming, old);
  expect(merged).toMatchObject({ id: 'old', title: 'Corrected title', uri: oldUri });
  expect(getWaveformSourceIdentity(merged)).toEqual(getWaveformSourceIdentity(old));
  const replaced = preserveImportedSource({ ...incoming, fileInfo: { ...incoming.fileInfo, size: 2000 } }, old);
  expect(getWaveformSourceIdentity(replaced).sourceFingerprint)
    .not.toBe(getWaveformSourceIdentity(old).sourceFingerprint);
});

test('skips unchanged revisions but includes changed tags, file size and new sources', () => {
  const previous = { ...old, fileInfo: { ...old.fileInfo, modificationTime: 100, contentHash: 'old-hash' } };
  const selection = createImportSourceSelection({ existingSongs: [previous] });
  expect(selection.include(newUri, { size: 1000, modificationTime: 100 })).toBe(false);
  expect(selection.getReusedCount()).toBe(1);
  const changed = createImportSourceSelection({ existingSongs: [previous] });
  expect(changed.include(newUri, { size: 1000, modificationTime: 101 })).toBe(true);
  const changedHash = createImportSourceSelection({ existingSongs: [previous] });
  expect(changedHash.include(newUri, { size: 1000, contentHash: 'new-hash' })).toBe(true);
  const changedSize = createImportSourceSelection({ existingSongs: [previous] });
  expect(changedSize.include(newUri, { size: 2000, modificationTime: 100 })).toBe(true);
});

test('same-size replacement receives a new preparation identity', () => {
  const previous = { ...old, fileInfo: { ...old.fileInfo, modificationTime: 100 } };
  const incoming = { ...previous, fileInfo: { ...previous.fileInfo, modificationTime: 101, importedAt: 20 } };
  expect(getWaveformSourceIdentity(preserveImportedSource(incoming, previous))).not.toEqual(getWaveformSourceIdentity(previous));
});
