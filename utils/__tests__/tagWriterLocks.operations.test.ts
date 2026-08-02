import {
  beginSafWriteStartupRestoration, finishSafWriteStartupRestoration,
  getActiveSafWrite, getSafWriteOperation, resetSafWriteStartupForTests,
  runSafWriteOperation,
} from '../tagWriterLocks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canonicalSafTarget } from '../tagWriterLocks';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('SAF tag write operation contract', () => {
  beforeEach(() => {
    resetSafWriteStartupForTests();
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue();
  });

  test('waits at the API barrier and opens exactly once after restoration', async () => {
    beginSafWriteStartupRestoration();
    const native = jest.fn(async () => 'written');
    const write = runSafWriteOperation('content://provider/startup', native);
    await Promise.resolve();
    expect(native).not.toHaveBeenCalled();
    finishSafWriteStartupRestoration();
    finishSafWriteStartupRestoration();
    await expect(write).resolves.toMatchObject({ kind: 'result', value: 'written' });
    expect(native).toHaveBeenCalledTimes(1);
  });

  test('stays fail-closed after restoration failure and a retry can open it', async () => {
    beginSafWriteStartupRestoration();
    const blocked = runSafWriteOperation('content://provider/startup-failed', async () => 'never');
    finishSafWriteStartupRestoration(new Error('storage unavailable'));
    await expect(blocked).rejects.toThrow('storage unavailable');
    await expect(runSafWriteOperation('content://provider/startup-failed', async () => 'never'))
      .rejects.toThrow('storage unavailable');
    beginSafWriteStartupRestoration();
    finishSafWriteStartupRestoration();
    await expect(runSafWriteOperation('content://provider/startup-failed', async () => 'written'))
      .resolves.toMatchObject({ kind: 'result', value: 'written' });
  });

  test('same canonical target is busy while different targets run concurrently', async () => {
    const first = deferred<string>();
    const a = runSafWriteOperation('CONTENT://provider/song', () => first.promise);
    await Promise.resolve();
    const duplicate = await runSafWriteOperation('content://provider/song', async () => 'duplicate');
    const other = await runSafWriteOperation('content://provider/other', async () => 'other');
    expect(duplicate.kind).toBe('busy');
    expect(duplicate.status).toMatchObject({ phase: 'failed', terminal: true, retryable: true });
    const active = getActiveSafWrite('content://provider/song');
    expect(duplicate.status.operationId).not.toBe(active?.operationId);
    expect(duplicate.status.blockedByOperationId).toBe(active?.operationId);
    expect(other).toMatchObject({ kind: 'result', value: 'other' });
    first.resolve('first');
    await expect(a).resolves.toMatchObject({ kind: 'result', value: 'first' });
    expect(duplicate.status).toMatchObject({ phase: 'failed', terminal: true, retryable: true });
  });

  test('tree and encoded document aliases share one target while distinct documents do not', () => {
    const direct = 'content://provider/document/primary:Music/song.mp3';
    const tree = 'content://PROVIDER/tree/primary%3AMusic/document/primary%3AMusic%2Fsong.mp3';
    expect(canonicalSafTarget(tree)).toBe(canonicalSafTarget(direct));
    expect(canonicalSafTarget('content://provider/document/primary:Music/other.mp3'))
      .not.toBe(canonicalSafTarget(direct));
  });

  test('busy uses the rejected caller operation ID without replacing the active operation', async () => {
    const first = deferred<string>();
    const running = runSafWriteOperation('content://provider/identity', () => first.promise, { operationId: 'first' });
    await Promise.resolve();
    const busy = await runSafWriteOperation('content://provider/identity', async () => 'never', { operationId: 'second' });
    expect(busy).toMatchObject({
      kind: 'busy',
      status: { operationId: 'second', blockedByOperationId: 'first', phase: 'failed', terminal: true, retryable: true },
    });
    expect(getActiveSafWrite('content://provider/identity')?.operationId).toBe('first');
    first.reject(new Error('first failed'));
    await expect(running).rejects.toThrow('first failed');
    expect(busy.status).toMatchObject({ operationId: 'second', phase: 'failed', terminal: true, retryable: true });
  });

  test('zero timeout cancels before native mutation and releases the target', async () => {
    const native = jest.fn(async () => 'never');
    const result = await runSafWriteOperation('content://provider/pre', native, { timeoutMs: 0 });
    expect(result).toMatchObject({ kind: 'result', status: { phase: 'cancelledBeforeMutation', terminal: true } });
    expect(native).not.toHaveBeenCalled();
    expect(getActiveSafWrite('content://provider/pre')).toBeUndefined();
  });

  test.each(['success', 'failure'] as const)('late native %s owns lock until terminal settlement', async outcome => {
    jest.useFakeTimers();
    const native = deferred<string>();
    const request = runSafWriteOperation('content://provider/late', () => native.promise, { timeoutMs: 10 });
    await Promise.resolve();
    jest.advanceTimersByTime(10);
    const timedOut = await request;
    expect(timedOut).toMatchObject({ kind: 'pending', status: { phase: 'pendingNativeResult', terminal: false } });
    const retry = await runSafWriteOperation('content://provider/late', async () => 'duplicate');
    expect(retry.kind).toBe('busy');
    if (outcome === 'success') native.resolve('done');
    else native.reject(new Error('native failed'));
    await native.promise.catch(() => undefined);
    for (let turn = 0; turn < 30 && getActiveSafWrite('content://provider/late'); turn += 1)
      await Promise.resolve();
    expect(getActiveSafWrite('content://provider/late')).toBeUndefined();
    expect(getSafWriteOperation(timedOut.status.operationId)).toMatchObject({
      operationStatus: outcome === 'success' ? 'completed' : 'failed', terminal: true,
    });
  });

  test('publishes a late success only after its terminal journal is durable', async () => {
    jest.useFakeTimers();
    const native = deferred<string>();
    const terminalPersistence = deferred<void>();
    const setItem = jest.mocked(AsyncStorage.setItem)
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockImplementationOnce(() => terminalPersistence.promise);
    const request = runSafWriteOperation('content://provider/late-durable', () => native.promise, {
      timeoutMs: 10, operationId: 'late-durable',
    });
    await Promise.resolve();
    jest.advanceTimersByTime(10);
    await expect(request).resolves.toMatchObject({ kind: 'pending' });
    native.resolve('written');
    for (let turn = 0; turn < 20 && setItem.mock.calls.length < 3; turn += 1)
      await Promise.resolve();

    expect(getSafWriteOperation('late-durable')).toMatchObject({ operationStatus: 'pending', terminal: false });
    expect(getActiveSafWrite('content://provider/late-durable')?.operationId).toBe('late-durable');
    await expect(runSafWriteOperation('content://provider/late-durable', async () => 'duplicate'))
      .resolves.toMatchObject({ kind: 'busy', status: { blockedByOperationId: 'late-durable' } });
    const pendingSnapshots = setItem.mock.calls.slice(0, 2).map(([, value]) => String(value));
    expect(pendingSnapshots.every(value => value.includes('"operationStatus":"pending"'))).toBe(true);

    terminalPersistence.resolve();
    for (let turn = 0; turn < 10 && getActiveSafWrite('content://provider/late-durable'); turn += 1)
      await Promise.resolve();
    expect(getSafWriteOperation('late-durable')).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(getActiveSafWrite('content://provider/late-durable')).toBeUndefined();
    const durableCompletions = setItem.mock.calls.filter(([, value]) =>
      (JSON.parse(String(value)) as Array<{ operationId: string; operationStatus: string }>).some(
        item => item.operationId === 'late-durable' && item.operationStatus === 'completed',
      ));
    expect(durableCompletions).toHaveLength(1);
  });

  test('keeps a late committed write fail-closed when terminal persistence fails', async () => {
    jest.useFakeTimers();
    const observed: unknown[] = [];
    const listener = (reason: unknown) => observed.push(reason);
    process.on('unhandledRejection', listener);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const native = deferred<string>();
    const setItem = jest.mocked(AsyncStorage.setItem)
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValue();
    const request = runSafWriteOperation('content://provider/late-undurable', () => native.promise, {
      timeoutMs: 10, operationId: 'late-undurable',
    });
    await Promise.resolve();
    jest.advanceTimersByTime(10);
    await request;
    native.resolve('written');
    for (let turn = 0; turn < 30 && getSafWriteOperation('late-undurable')?.errorCode === undefined; turn += 1)
      await Promise.resolve();

    expect(getSafWriteOperation('late-undurable')).toMatchObject({
      operationStatus: 'recovery-pending', terminal: false, retryable: true,
      errorCode: 'TerminalJournalPersistenceFailed',
    });
    expect(getActiveSafWrite('content://provider/late-undurable')?.operationId).toBe('late-undurable');
    await expect(runSafWriteOperation('content://provider/late-undurable', async () => 'duplicate'))
      .resolves.toMatchObject({ kind: 'busy' });
    await Promise.resolve();
    process.off('unhandledRejection', listener);
    warning.mockRestore();
    expect(observed).toEqual([]);
    expect(setItem.mock.calls.some(([, value]) => String(value).includes('"operationStatus":"completed"'))).toBe(true);
  });

  test('native rejection is observed and releases the target without an unhandled rejection', async () => {
    const observed: unknown[] = [];
    const listener = (reason: unknown) => observed.push(reason);
    process.on('unhandledRejection', listener);
    await expect(runSafWriteOperation('content://provider/error', async () => { throw new Error('failed'); })).rejects.toThrow('failed');
    await Promise.resolve();
    process.off('unhandledRejection', listener);
    expect(observed).toEqual([]);
    expect(getActiveSafWrite('content://provider/error')).toBeUndefined();
  });

  test('does not expose confirmed success until terminal journal persistence completes', async () => {
    const persisted = deferred<void>();
    const setItem = jest.mocked(AsyncStorage.setItem)
      .mockResolvedValueOnce()
      .mockImplementationOnce(() => persisted.promise);
    let visible = false;
    const write = runSafWriteOperation('content://provider/durable-success', async () => 'written')
      .then(result => { visible = true; return result; });
    for (let turn = 0; turn < 20 && setItem.mock.calls.length < 2; turn += 1)
      await Promise.resolve();
    const callCountBeforePersistence = setItem.mock.calls.length;
    const visibleBeforePersistence = visible;
    persisted.resolve();
    expect(callCountBeforePersistence).toBe(2);
    expect(visibleBeforePersistence).toBe(false);
    await expect(write).resolves.toMatchObject({ kind: 'result', value: 'written' });
  });

  test('propagates terminal journal failure instead of confirming native success', async () => {
    const setItem = jest.mocked(AsyncStorage.setItem)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(runSafWriteOperation('content://provider/undurable-success', async () => 'written'))
      .rejects.toThrow('terminal journal could not be persisted');
    const calls = setItem.mock.calls.length;
    expect(getActiveSafWrite('content://provider/undurable-success')).toMatchObject({
      operationStatus: 'recovery-pending', terminal: false, errorCode: 'TerminalJournalPersistenceFailed',
    });
    expect(setItem).toHaveBeenCalledTimes(calls);
  });

  test.each([
    [{ status: 'written' }, 'completed'],
    [{ status: 'noop' }, 'completed'],
    [{ status: 'writeFailed' }, 'failed'],
    [{ status: 'permissionDenied' }, 'failed'],
    [{ status: 'unsupportedUri' }, 'failed'],
  ] as const)('derives a consistent phase for resolved result %j', async (value, phase) => {
    const result = await runSafWriteOperation('content://provider/phase', async () => value, {
      phaseForResult: output => output.status === 'written' || output.status === 'noop' ? 'completed' : 'failed',
    });
    expect(result.status.phase).toBe(phase);
  });
});
