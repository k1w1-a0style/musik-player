import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLibrarySortMode } from '../useLibrarySortMode';
import { storage } from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  storage: {
    getLibrarySortMode: jest.fn().mockResolvedValue('alphabet'),
    setLibrarySortMode: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedStorage = storage as unknown as jest.Mocked<Pick<typeof storage, 'getLibrarySortMode' | 'setLibrarySortMode'>>;

describe('useLibrarySortMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.getLibrarySortMode.mockResolvedValue('alphabet');
  });

  test('hydrates the persisted sort mode on mount', async () => {
    mockedStorage.getLibrarySortMode.mockResolvedValue('year');
    const { result } = renderHook(() => useLibrarySortMode());

    await waitFor(() => expect(result.current.sortMode).toBe('year'));
  });

  test('cycles and persists the next sort mode', async () => {
    const { result } = renderHook(() => useLibrarySortMode());
    await waitFor(() => expect(result.current.sortMode).toBe('alphabet'));

    act(() => {
      result.current.cycleSortMode();
    });

    expect(result.current.sortMode).toBe('trackNumber');
    expect(mockedStorage.setLibrarySortMode).toHaveBeenCalledWith('trackNumber');
  });

  test('sets and persists an explicit sort mode', async () => {
    const { result } = renderHook(() => useLibrarySortMode());
    await waitFor(() => expect(result.current.sortMode).toBe('alphabet'));

    act(() => {
      result.current.setSortMode('year');
    });

    expect(result.current.sortMode).toBe('year');
    expect(mockedStorage.setLibrarySortMode).toHaveBeenCalledWith('year');
  });
});
