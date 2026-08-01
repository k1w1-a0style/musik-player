import { getActiveSafWrite, getSafWriteOperation, runSafWriteOperation } from '../tagWriterLocks';
import { canonicalSafTarget } from '../tagWriterLocks';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('SAF tag write operation contract', () => {
  afterEach(() => jest.useRealTimers());

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
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(getActiveSafWrite('content://provider/late')).toBeUndefined();
    expect(getSafWriteOperation(timedOut.status.operationId)).toMatchObject({
      operationStatus: outcome === 'success' ? 'completed' : 'failed', terminal: true,
    });
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
