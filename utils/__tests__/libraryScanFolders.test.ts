import {
  buildDirectoryPermissionSelectionResult,
  buildScanFolderAddResult,
  buildScanFolderFromDirectoryUri,
  buildScanFolderStateUpdate,
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

test('buildDirectoryPermissionSelectionResult returns granted result with uri', () => {
  expect(buildDirectoryPermissionSelectionResult({ granted: true, directoryUri: 'content://Music' })).toEqual({
    kind: 'granted',
    directoryUri: 'content://Music',
  });
});

test('buildDirectoryPermissionSelectionResult returns cancelled result without granted uri', () => {
  expect(buildDirectoryPermissionSelectionResult({ granted: false })).toEqual({ kind: 'cancelled' });
  expect(buildDirectoryPermissionSelectionResult({ granted: true, directoryUri: '' })).toEqual({ kind: 'cancelled' });
});

test('wasScanFolderAdded checks whether a folder was added', () => {
  expect(wasScanFolderAdded([folder('a')], [folder('a'), folder('b')])).toBe(true);
  expect(wasScanFolderAdded([folder('a')], [folder('a')])).toBe(false);
  expect(wasScanFolderAdded([folder('a'), folder('b')], [folder('a')])).toBe(false);
});

test('buildScanFolderStateUpdate selects folders tab', () => {
  const scanFolders = [folder('a'), folder('b')];

  expect(buildScanFolderStateUpdate(scanFolders)).toEqual({
    scanFolders,
    activeTab: 'folders',
  });
});

test('buildScanFolderAddResult returns added result with folder tab update', () => {
  const previousFolders = [folder('a')];
  const nextFolders = [folder('a'), folder('b')];

  expect(buildScanFolderAddResult(previousFolders, nextFolders)).toEqual({
    kind: 'added',
    update: buildScanFolderStateUpdate(nextFolders),
  });
});

test('buildScanFolderAddResult returns duplicate result without added folder', () => {
  expect(buildScanFolderAddResult([folder('a')], [folder('a')])).toEqual({ kind: 'duplicate' });
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
