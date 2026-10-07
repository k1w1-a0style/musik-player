import { resetImportFileReadsForTests, runImportFileWorkers, withImportFileBudget, withImportInactivityTimeout } from '../libraryImportBudget';
import { throwIfAborted } from '../withTimeout';

beforeEach(() => { jest.useFakeTimers(); resetImportFileReadsForTests(); });
afterEach(() => { jest.useRealTimers(); resetImportFileReadsForTests(); });

test('healthy progress permits a scan longer than its inactivity budget', async () => {
  const result = withImportInactivityTimeout((_signal, activity) => new Promise(resolve => {
    setTimeout(activity, 60);
    setTimeout(activity, 120);
    setTimeout(activity, 180);
    setTimeout(() => resolve('complete'), 240);
  }), 100, 'scan stalled');
  await jest.advanceTimersByTimeAsync(240);
  await expect(result).resolves.toBe('complete');
  expect(jest.getTimerCount()).toBe(0);
});

test('stalled scans abort their source and close late activity', async () => {
  let sourceSignal: AbortSignal | undefined;
  let activity = (): void => undefined;
  const result = withImportInactivityTimeout((signal, report) => {
    sourceSignal = signal;
    activity = report;
    return new Promise(() => undefined);
  }, 100, 'scan stalled');
  const assertion = expect(result).rejects.toThrow('scan stalled');
  await jest.advanceTimersByTimeAsync(100);
  await assertion;
  expect(sourceSignal?.aborted).toBe(true);
  activity();
  expect(jest.getTimerCount()).toBe(0);
});

test('two detached file reads keep reservations across retries until their sources settle', async () => {
  const releases: Array<() => void> = [];
  const read = (signal: AbortSignal) => new Promise<void>(resolve => { releases.push(resolve); })
    .then(() => { throwIfAborted(signal); });
  const first = expect(withImportFileBudget(read, undefined, 10)).rejects.toThrow('Zeitlimits');
  const second = expect(withImportFileBudget(read, undefined, 10)).rejects.toThrow('Zeitlimits');
  await jest.advanceTimersByTimeAsync(10);
  await Promise.all([first, second]);
  const replacement = jest.fn(async () => 'replacement');
  await expect(withImportFileBudget(replacement)).rejects.toThrow('beschäftigt');
  expect(replacement).not.toHaveBeenCalled();
  releases[0]();
  await jest.advanceTimersByTimeAsync(0);
  await expect(withImportFileBudget(replacement)).resolves.toBe('replacement');
  releases[1]();
  await jest.advanceTimersByTimeAsync(0);
});

test('retiring hung workers reports the unprocessed tail instead of issuing unbounded reads', async () => {
  const read = jest.fn(() => new Promise<void>(() => undefined));
  const onFailure = jest.fn();
  const result = runImportFileWorkers([1, 2, 3, 4, 5, 6], { read, onFailure, perFileTimeoutMs: 10 });
  await jest.advanceTimersByTimeAsync(10);
  await expect(result).resolves.toEqual({ processed: 2, remaining: 4, interrupted: true });
  expect(read).toHaveBeenCalledTimes(2);
  expect(onFailure).toHaveBeenCalledTimes(2);
});

test('external cancellation aborts a scan while it waits for progress', async () => {
  const controller = new AbortController();
  let sourceSignal: AbortSignal | undefined;
  const result = withImportInactivityTimeout(signal => {
    sourceSignal = signal;
    return new Promise(() => undefined);
  }, 100, 'stalled', { signal: controller.signal });
  const assertion = expect(result).rejects.toThrow('superseded');
  controller.abort(new Error('superseded'));
  await assertion;
  expect(sourceSignal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
