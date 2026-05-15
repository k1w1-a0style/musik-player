import { buildScanFolderFromDirectoryUri, getEnabledScanFolders } from '../libraryScanFolders';

jest.mock('../libraryPresentation', () => ({
  displayFolderName: (folder: { uri: string }) => folder.uri.includes('Music') ? 'Music' : 'Ordner',
}));

test('getEnabledScanFolders filters disabled folders', () => {
  const folders = [
    { id: 'a', name: 'A', uri: 'content://a', addedAt: 1, enabled: true },
    { id: 'b', name: 'B', uri: 'content://b', addedAt: 2, enabled: false },
    { id: 'c', name: 'C', uri: 'content://c', addedAt: 3, enabled: true },
  ];

  expect(getEnabledScanFolders(folders).map(folder => folder.id)).toEqual(['a', 'c']);
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
