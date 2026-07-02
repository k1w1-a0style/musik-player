import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLibraryScreenState } from '../useLibraryScreenState';
import { storage } from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  storage: {
    getAlbumViewMode: jest.fn().mockResolvedValue('grid'),
    setAlbumViewMode: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('useLibraryScreenState', () => {
  beforeEach(() => {
    mockedStorage.getAlbumViewMode.mockResolvedValue('grid');
    mockedStorage.setAlbumViewMode.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const waitForAlbumViewHydration = async () => {
    await waitFor(() => expect(mockedStorage.getAlbumViewMode).toHaveBeenCalled());
  };

  test('starts with default library screen state', async () => {
    const { result } = renderHook(() => useLibraryScreenState());

    expect(result.current.loading).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.menuOpen).toBe(false);
    expect(result.current.searchOpen).toBe(false);
    expect(result.current.importStatus).toBeNull();
    expect(result.current.activeTab).toBe('tracks');
    expect(result.current.albumViewMode).toBe('grid');
    await waitForAlbumViewHydration();
  });

  test('updates library screen state through setters', async () => {
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
    await waitForAlbumViewHydration();
  });
});
