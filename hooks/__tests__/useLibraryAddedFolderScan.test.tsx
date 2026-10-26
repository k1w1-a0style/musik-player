import { act, renderHook } from '@testing-library/react-native';
import { useLibraryAddedFolderScan } from '../useLibraryAddedFolderScan';
import { beginLibraryScan, getLibraryScanOperation, stopLibraryScan, recordLibraryScanResult, completeLibraryScan } from '../../utils/libraryScanOperation';
import { emptyImportScanStatistics } from '../../utils/libraryImportStatistics';
import type { ScanFolder } from '../../types/ScanFolder';

const folder: ScanFolder = { id: 'new', uri: 'content://new/tree', name: 'New', addedAt: 2, enabled: true };
const finish = (id: number) => { recordLibraryScanResult(id, { statistics: emptyImportScanStatistics() }); completeLibraryScan(id); };
afterEach(() => stopLibraryScan(getLibraryScanOperation().id, 'cancelled'));

test('serializes two explicit selections after the active scan without overlapping imports', async () => {
  const running = beginLibraryScan(false);
  const releases: Array<() => void> = [];
  const action = jest.fn(async () => {
    const id = beginLibraryScan(false);
    await new Promise<void>(resolve => releases.push(resolve));
    finish(id);
  });
  const hook = renderHook(() => useLibraryAddedFolderScan({ current: action }, []));
  let first!: Promise<void>; let second!: Promise<void>;
  await act(async () => { first = hook.result.current(folder); second = hook.result.current({ ...folder, id: 'second', uri: 'content://second' }); });
  expect(action).not.toHaveBeenCalled();
  await act(async () => { finish(running); await Promise.resolve(); });
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => { releases[0](); await first; });
  expect(action).toHaveBeenCalledTimes(2);
  await act(async () => { releases[1](); await second; });
  hook.unmount();
});

test('unmount releases the waiting subscription and prevents any late scan', async () => {
  const running = beginLibraryScan(false); const action = jest.fn(async () => undefined);
  const hook = renderHook(() => useLibraryAddedFolderScan({ current: action }, []));
  let task!: Promise<void>;
  await act(async () => { task = hook.result.current(folder); await Promise.resolve(); });
  hook.unmount();
  await task;
  act(() => stopLibraryScan(running, 'cancelled'));
  expect(action).not.toHaveBeenCalled();
});

test('a folder removed while queued is never scanned after capacity returns', async () => {
  const running = beginLibraryScan(false); const action = jest.fn(async () => undefined);
  const hook = renderHook(({ folders }: { folders: ScanFolder[] }) => useLibraryAddedFolderScan({ current: action }, folders), { initialProps: { folders: [folder] } });
  let task!: Promise<void>;
  await act(async () => { task = hook.result.current(folder); await Promise.resolve(); });
  hook.rerender({ folders: [{ ...folder, removed: true }] });
  await act(async () => { finish(running); await task; });
  expect(action).not.toHaveBeenCalled();
});

test('a stale older tombstone cannot suppress a newly reauthorized selection', async () => {
  const action = jest.fn(async () => undefined);
  const hook = renderHook(() => useLibraryAddedFolderScan({ current: action }, [{ ...folder, addedAt: 1, removed: true }]));
  await act(async () => hook.result.current(folder));
  expect(action).toHaveBeenCalledWith({ folders: [folder], refreshExisting: false, automatic: true });
});


test('explicit cancellation also stops an already queued folder selection', async () => {
  const running = beginLibraryScan(false); const action = jest.fn(async () => undefined);
  const hook = renderHook(() => useLibraryAddedFolderScan({ current: action }, []));
  let task!: Promise<void>;
  await act(async () => { task = hook.result.current(folder); await Promise.resolve(); });
  await act(async () => { stopLibraryScan(running, 'cancelled'); await task; });
  expect(action).not.toHaveBeenCalled();
  await act(async () => hook.result.current(folder));
  expect(action).toHaveBeenCalledTimes(1);
});
