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

  test('keeps a user choice made before hydration resolves', async () => {
    let resolveStored!: (value: 'list' | 'gridSmall') => void;
    mockedStorage.getLibrarySongViewMode.mockImplementationOnce(() => new Promise(resolve => {
      resolveStored = resolve;
    }));
    const { result } = renderHook(() => useLibrarySongViewMode());

    act(() => {
      result.current.setViewMode('gridSmall');
    });
    expect(result.current.viewMode).toBe('gridSmall');

    await act(async () => {
      resolveStored('list');
    });

    expect(result.current.viewMode).toBe('gridSmall');
    expect(mockedStorage.setLibrarySongViewMode).toHaveBeenCalledWith('gridSmall');
  });

  test('late hydration cannot replace the rollback target after a successful user write', async () => {
    let resolveStored!: (value: 'list' | 'gridSmall') => void;
    let rejectSecondWrite!: (error: Error) => void;
    mockedStorage.getLibrarySongViewMode.mockImplementationOnce(() => new Promise(resolve => {
      resolveStored = resolve;
    }));
    mockedStorage.setLibrarySongViewMode
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectSecondWrite = reject;
      }));
    const { result } = renderHook(() => useLibrarySongViewMode());

    act(() => result.current.setViewMode('gridSmall'));
    await waitFor(() => expect(mockedStorage.setLibrarySongViewMode).toHaveBeenCalledWith('gridSmall'));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.setViewMode('list'));

    await act(async () => resolveStored('list'));
    await act(async () => rejectSecondWrite(new Error('write failed')));

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
