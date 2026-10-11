import { persistLibraryScanFolders } from '../libraryScanFolderSave';
import { beginLibraryScan, completeLibraryScan, getLibraryScanOperation, recordLibraryScanResult } from '../libraryScanOperation';
import { emptyImportScanStatistics } from '../libraryImportStatistics';
import { OperationAbortError } from '../withTimeout';

const updates = [{ id: 'folder', name: 'Music', uri: 'content://music', enabled: true, addedAt: 1, lastError: 'read failed' }];
const begin = () => {
  const scanId = beginLibraryScan(false);
  recordLibraryScanResult(scanId, { statistics: emptyImportScanStatistics() });
  return { scanId, signal: new AbortController().signal, timeoutMs: 50, showAlert: jest.fn() };
};
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'warn').mockImplementation(() => undefined); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('retries just failed folder data and returns to the original completed outcome', async () => {
  const options = begin();
  const persist = jest.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
  await persistLibraryScanFolders(persist, updates, options);
  completeLibraryScan(options.scanId);
  const warning = getLibraryScanOperation().folderPersistenceWarning;
  expect(getLibraryScanOperation().status).toBe('partial');
  expect(warning?.retrying).toBe(false);
  await warning?.retry();
  expect(persist.mock.calls).toEqual([[updates], [updates]]);
  expect(getLibraryScanOperation()).toMatchObject({ status: 'completed', folderPersistenceWarning: undefined });
});

test('a timed-out write retains Retry ownership until real settlement', async () => {
  const options = begin(); let settle!: () => void;
  const persist = jest.fn(() => new Promise<void>(resolve => { settle = resolve; }));
  const observed = persistLibraryScanFolders(persist, updates, options);
  await jest.advanceTimersByTimeAsync(51); await observed;
  completeLibraryScan(options.scanId);
  expect(getLibraryScanOperation().folderPersistenceWarning?.retrying).toBe(true);
  await getLibraryScanOperation().folderPersistenceWarning?.retry();
  expect(persist).toHaveBeenCalledTimes(1);
  settle(); await jest.advanceTimersByTimeAsync(0);
  expect(getLibraryScanOperation()).toMatchObject({ status: 'completed', folderPersistenceWarning: undefined });
});

test('a later rejection enables retry and repeated failure retains the warning', async () => {
  const options = begin(); let reject!: (error: Error) => void;
  const persist = jest.fn().mockImplementationOnce(() => new Promise<void>((_, failure) => { reject = failure; }))
    .mockRejectedValue(new Error('still full'));
  const observed = persistLibraryScanFolders(persist, updates, options);
  await jest.advanceTimersByTimeAsync(51); await observed; completeLibraryScan(options.scanId);
  reject(new Error('full')); await jest.advanceTimersByTimeAsync(0);
  expect(getLibraryScanOperation().folderPersistenceWarning?.retrying).toBe(false);
  await getLibraryScanOperation().folderPersistenceWarning?.retry();
  expect(getLibraryScanOperation().status).toBe('partial');
  expect(getLibraryScanOperation().folderPersistenceWarning?.retrying).toBe(false);
});

test('old retry callbacks cannot overwrite a newer scan', async () => {
  const options = begin(); const persist = jest.fn().mockRejectedValue(new Error('full'));
  await persistLibraryScanFolders(persist, updates, options); completeLibraryScan(options.scanId);
  const warning = getLibraryScanOperation().folderPersistenceWarning;
  const next = begin(); await warning?.retry();
  expect(persist).toHaveBeenCalledTimes(1);
  expect(getLibraryScanOperation()).toMatchObject({ id: next.scanId, status: 'running' });
  expect(getLibraryScanOperation().folderPersistenceWarning).toBeUndefined();
});

test('retry success preserves an independently partial file scan', async () => {
  const options = begin();
  recordLibraryScanResult(options.scanId, { statistics: emptyImportScanStatistics(), completed: false, remainingCount: 2 });
  const persist = jest.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
  await persistLibraryScanFolders(persist, updates, options); completeLibraryScan(options.scanId);
  await getLibraryScanOperation().folderPersistenceWarning?.retry();
  expect(getLibraryScanOperation()).toMatchObject({ status: 'partial', remainingCount: 2, folderPersistenceWarning: undefined });
});

test('an already aborted request never starts a folder write', async () => {
  const options = begin(); const controller = new AbortController(); controller.abort(new OperationAbortError('cancel'));
  const persist = jest.fn();
  await expect(persistLibraryScanFolders(persist, updates, { ...options, signal: controller.signal })).rejects.toThrow('cancel');
  expect(persist).not.toHaveBeenCalled();
  expect(options.showAlert).not.toHaveBeenCalled();
});
