import {
  buildScanFolderFromDirectoryUri,
  canUseScanFolderPicker,
  getEnabledScanFolders,
  hasGrantedDirectoryPermission,
  wasScanFolderAdded,
} from '../libraryScanFolders';

jest.mock('../libraryPresentation', () => ({
  displayFolderName: (folder: { uri: string }) => folder.uri.includes('Music') ? 'Music' : 'Ordner',
}));

const folder = (id: string) => ({ id, name: id, uri: `content://${id}`, addedAt: 1, enabled: true });

test('getEnabledScanFolders filters disabled folders', () => {
  const folders = [
    { id: 'a', name: 'A', uri: 'content://a', addedAt: 1, enabled: true },
    { id: 'b', name: 'B', uri: 'content://b', addedAt: 2, enabled: false },
    { id: 'c', name: 'C', uri: 'content://c', addedAt: 3, enabled: true },
  ];

  expect(getEnabledScanFolders(folders).map(folder => folder.id)).toEqual(['a', 'c']);
});

test('canUseScanFolderPicker only allows android', () => {
  expect(canUseScanFolderPicker('android')).toBe(true);
  expect(canUseScanFolderPicker('ios')).toBe(false);
  expect(canUseScanFolderPicker('web')).toBe(false);
});

test('hasGrantedDirectoryPermission requires grant and directory uri', () => {
  expect(hasGrantedDirectoryPermission({ granted: true, directoryUri: 'content://Music' })).toBe(true);
  expect(hasGrantedDirectoryPermission({ granted: false, directoryUri: 'content://Music' })).toBe(false);
  expect(hasGrantedDirectoryPermission({ granted: true, directoryUri: '' })).toBe(false);
  expect(hasGrantedDirectoryPermission({ granted: true })).toBe(false);
});

test('wasScanFolderAdded checks whether a folder was added', () => {
  expect(wasScanFolderAdded([folder('a')], [folder('a'), folder('b')])).toBe(true);
  expect(wasScanFolderAdded([folder('a')], [folder('a')])).toBe(false);
  expect(wasScanFolderAdded([folder('a'), folder('b')], [folder('a')])).toBe(false);
});

test('buildScanFolderFromDirectoryUri creates deterministic scan folder', () => {
  const folder = buildScanFolderFromDirectoryUri('content://Music', {
    now: () => 123,
    random: () => 0.5,
  });

  expect(folder).toEqual({
    id: '123-i',
    name: 'Music',
    uri: 'content://Music',
    addedAt: 123,
    enabled: true,
  });
});
