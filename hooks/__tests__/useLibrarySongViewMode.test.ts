import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLibrarySongViewMode } from '../useLibrarySongViewMode';
import { storage } from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  storage: {
    getLibrarySongViewMode: jest.fn().mockResolvedValue('list'),
    setLibrarySongViewMode: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedStorage = storage as unknown as jest.Mocked<Pick<typeof storage, 'getLibrarySongViewMode' | 'setLibrarySongViewMode'>>;

describe('useLibrarySongViewMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.getLibrarySongViewMode.mockResolvedValue('list');
  });

  test('hydrates the persisted view mode on mount', async () => {
    mockedStorage.getLibrarySongViewMode.mockResolvedValue('gridSmall');
    const { result } = renderHook(() => useLibrarySongViewMode());

    await waitFor(() => expect(result.current.viewMode).toBe('gridSmall'));
  });

  test('cycles and persists the next view mode', async () => {
    const { result } = renderHook(() => useLibrarySongViewMode());
    await waitFor(() => expect(result.current.viewMode).toBe('list'));

    act(() => {
      result.current.cycleViewMode();
    });

    expect(result.current.viewMode).toBe('gridLarge');
    expect(mockedStorage.setLibrarySongViewMode).toHaveBeenCalledWith('gridLarge');
  });
});
