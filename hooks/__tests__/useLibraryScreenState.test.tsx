import { act, renderHook } from '@testing-library/react-native';
import { useLibraryScreenState } from '../useLibraryScreenState';

describe('useLibraryScreenState', () => {
  test('starts with default library screen state', () => {
    const { result } = renderHook(() => useLibraryScreenState());

    expect(result.current.loading).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.menuOpen).toBe(false);
    expect(result.current.searchOpen).toBe(false);
    expect(result.current.importStatus).toBeNull();
    expect(result.current.activeTab).toBe('tracks');
    expect(result.current.albumViewMode).toBe('grid');
  });

  test('updates library screen state through setters', () => {
    const { result } = renderHook(() => useLibraryScreenState());

    act(() => {
      result.current.setLoading(true);
      result.current.setQuery('bass');
      result.current.setMenuOpen(true);
      result.current.setSearchOpen(true);
      result.current.setImportStatus('Import läuft');
      result.current.setActiveTab('albums');
      result.current.setAlbumViewMode('list');
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.query).toBe('bass');
    expect(result.current.menuOpen).toBe(true);
    expect(result.current.searchOpen).toBe(true);
    expect(result.current.importStatus).toBe('Import läuft');
    expect(result.current.activeTab).toBe('albums');
    expect(result.current.albumViewMode).toBe('list');
  });
});
