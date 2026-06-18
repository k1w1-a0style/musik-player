import { renderHook } from '@testing-library/react-native';
import { OperationAbortError } from '../../utils/withTimeout';
import { useLibraryMetadataRefreshLifecycle } from '../useLibraryMetadataRefreshLifecycle';

describe('useLibraryMetadataRefreshLifecycle', () => {
  test('ensureCurrentRefresh throws when generation is non-current but not aborted', () => {
    const { result } = renderHook(() => useLibraryMetadataRefreshLifecycle({ setLoading: jest.fn(), setImportStatus: jest.fn() }));
    const generation = result.current.startRefresh();
    result.current.finishRefresh(generation);

    expect(generation.controller.signal.aborted).toBe(false);
    expect(() => result.current.ensureCurrentRefresh(generation)).toThrow(OperationAbortError);
    expect(() => result.current.ensureCurrentRefresh(generation)).toThrow('Metadata refresh superseded or no longer current');
  });
});
