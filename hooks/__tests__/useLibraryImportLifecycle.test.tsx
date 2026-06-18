import { renderHook } from '@testing-library/react-native';
import { OperationAbortError } from '../../utils/withTimeout';
import { useLibraryImportLifecycle } from '../useLibraryImportLifecycle';

describe('useLibraryImportLifecycle', () => {
  test('ensureCurrentImport throws when generation is non-current but not aborted', () => {
    const { result } = renderHook(() => useLibraryImportLifecycle({ setLoading: jest.fn(), setImportStatus: jest.fn() }));
    const generation = result.current.startImport();
    result.current.finishImport(generation);

    expect(generation.controller.signal.aborted).toBe(false);
    expect(() => result.current.ensureCurrentImport(generation)).toThrow(OperationAbortError);
    expect(() => result.current.ensureCurrentImport(generation)).toThrow('Import superseded or no longer current');
  });
});
