import { countActiveScanFolders, getLibraryEmptyMessage, LIBRARY_TABS } from '../libraryTabs';

test('exports the expected library tabs in display order', () => {
  expect(LIBRARY_TABS.map(tab => tab.key)).toEqual([
    'tracks',
    'favorites',
    'playlists',
    'albums',
    'artists',
    'genres',
    'folders',
  ]);
});

test('counts active scan folders', () => {
  expect(countActiveScanFolders([
    { id: 'a', name: 'A', uri: 'content://a', addedAt: 1, enabled: true },
    { id: 'b', name: 'B', uri: 'content://b', addedAt: 2, enabled: false },
    { id: 'c', name: 'C', uri: 'content://c', addedAt: 3, enabled: true },
  ])).toBe(2);
});

test('returns tab specific empty messages', () => {
  expect(getLibraryEmptyMessage('folders')).toMatch(/Scan-Ordner/);
  expect(getLibraryEmptyMessage('favorites')).toMatch(/Favoriten/);
  expect(getLibraryEmptyMessage('playlists')).toMatch(/Playlists/);
  expect(getLibraryEmptyMessage('albums')).toMatch(/Alben/);
  expect(getLibraryEmptyMessage('artists')).toMatch(/Interpreten/);
  expect(getLibraryEmptyMessage('genres')).toMatch(/Genres/);
  expect(getLibraryEmptyMessage('tracks')).toBe('Keine Treffer gefunden.');
});
