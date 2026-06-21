import { renderHook, act } from '@testing-library/react-native';
import { OperationAbortError } from '../../utils/withTimeout';
import { useLibraryMetadataRefreshLifecycle } from '../useLibraryMetadataRefreshLifecycle';
import {
  beginMetadataRefreshOperation,
  getMetadataRefreshOperationState,
  resetMetadataRefreshOperationForTests,
} from '../../utils/metadataRefreshOperation';

describe('useLibraryMetadataRefreshLifecycle', () => {
  beforeEach(() => {
    resetMetadataRefreshOperationForTests();
  });

  test('ensureCurrentRefresh throws when generation is non-current but not aborted', () => {
    const { result } = renderHook(() => useLibraryMetadataRefreshLifecycle({ setLoading: jest.fn(), setImportStatus: jest.fn() }));
    const generation = result.current.startRefresh();
    result.current.finishRefresh(generation);

    expect(generation.controller.signal.aborted).toBe(false);
    expect(() => result.current.ensureCurrentRefresh(generation)).toThrow(OperationAbortError);
    expect(() => result.current.ensureCurrentRefresh(generation)).toThrow('Metadata refresh superseded or no longer current');
  });

  test('cancelRefresh aborts the active controller and marks the operation as cancelling', () => {
    const { result } = renderHook(() => useLibraryMetadataRefreshLifecycle({ setLoading: jest.fn(), setImportStatus: jest.fn() }));
    const generation = result.current.startRefresh();
    beginMetadataRefreshOperation(10, 0);
    let cancelled = false;
    act(() => {
      cancelled = result.current.cancelRefresh();
    });
    expect(cancelled).toBe(true);
    expect(generation.controller.signal.aborted).toBe(true);
    expect(getMetadataRefreshOperationState().status).toBe('cancelling');
  });

  test('cancelRefresh is a no-op when no refresh is active', () => {
    const { result } = renderHook(() => useLibraryMetadataRefreshLifecycle({ setLoading: jest.fn(), setImportStatus: jest.fn() }));
    let cancelled = true;
    act(() => {
      cancelled = result.current.cancelRefresh();
    });
    expect(cancelled).toBe(false);
  });
});
