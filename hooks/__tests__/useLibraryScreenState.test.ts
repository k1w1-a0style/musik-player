import { renderHook, act } from '@testing-library/react-native';
import { useLibraryScreenState } from '../useLibraryScreenState';

test('provides default library screen state', () => {
  const { result } = renderHook(() => useLibraryScreenState());

  expect(result.current.activeTab).toBe('tracks');
  expect(result.current.albumViewMode).toBe('grid');
  expect(result.current.importStatus).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(result.current.menuOpen).toBe(false);
  expect(result.current.query).toBe('');
  expect(result.current.searchOpen).toBe(false);
});

test('updates library screen state', () => {
  const { result } = renderHook(() => useLibraryScreenState());

  act(() => {
    result.current.setActiveTab('albums');
    result.current.setAlbumViewMode('list');
    result.current.setImportStatus('Import läuft');
    result.current.setLoading(true);
    result.current.setMenuOpen(true);
    result.current.setQuery('abc');
    result.current.setSearchOpen(true);
  });

  expect(result.current.activeTab).toBe('albums');
  expect(result.current.albumViewMode).toBe('list');
  expect(result.current.importStatus).toBe('Import läuft');
  expect(result.current.loading).toBe(true);
  expect(result.current.menuOpen).toBe(true);
  expect(result.current.query).toBe('abc');
  expect(result.current.searchOpen).toBe(true);
});
