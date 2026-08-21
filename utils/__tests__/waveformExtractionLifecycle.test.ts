import {
  resetWaveformExtractionLifecycleForTests,
  scheduleNativeWaveformExtraction,
  WaveformSchedulerUnavailableError,
  WAVEFORM_EXTRACTION_DEBOUNCE_MS,
} from '../waveformExtractionLifecycle';
import { OperationAbortError } from '../withTimeout';

type NativeResult = { points: number[]; durationMs?: number } | null;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('waveformExtractionLifecycle', () => {
  beforeEach(() => {
    resetWaveformExtractionLifecycleForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    resetWaveformExtractionLifecycleForTests();
    jest.useRealTimers();
  });

  test('lifecycle reset rejects active waiters even when native work ignores cancellation', async () => {
    const native = deferred<NativeResult>();
    const operation = jest.fn(() => native.promise);
    const controller = new AbortController();

    const waiter = scheduleNativeWaveformExtraction('song:stuck-source', operation, controller.signal);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(operation).toHaveBeenCalledTimes(1);

    resetWaveformExtractionLifecycleForTests();

    await expect(waiter).rejects.toThrow('Waveform lifecycle reset');
    native.resolve({ points: [0.2, 0.8] });
    await Promise.resolve();
  });

  test('rejoins a detached same-source flight instead of starting a duplicate native call', async () => {
    const native = deferred<NativeResult>();
    const firstOperation = jest.fn(() => native.promise);
    const duplicateOperation = jest.fn(() => Promise.resolve({ points: [0.1, 0.9] }));
    const firstController = new AbortController();

    const firstWaiter = scheduleNativeWaveformExtraction(
      'song:shared-source',
      firstOperation,
      firstController.signal,
    );
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(firstOperation).toHaveBeenCalledTimes(1);

    firstController.abort(new OperationAbortError('song changed'));
    await expect(firstWaiter).rejects.toThrow('song changed');

    const secondController = new AbortController();
    const secondWaiter = scheduleNativeWaveformExtraction(
      'song:shared-source',
      duplicateOperation,
      secondController.signal,
    );

    native.resolve({ points: [0.1, 0.9] });
    await expect(secondWaiter).resolves.toEqual({ points: [0.1, 0.9] });
    expect(firstOperation).toHaveBeenCalledTimes(1);
    expect(duplicateOperation).not.toHaveBeenCalled();
  });

  test('foreground work preempts an active preload instead of waiting behind it', async () => {
    const preloadNative = deferred<NativeResult>();
    const foregroundNative = deferred<NativeResult>();
    const preloadOperation = jest.fn(() => preloadNative.promise);
    const foregroundOperation = jest.fn(() => foregroundNative.promise);
    const preloadController = new AbortController();
    const foregroundController = new AbortController();

    const preloadWaiter = scheduleNativeWaveformExtraction(
      'song:preload',
      preloadOperation,
      preloadController.signal,
      { priority: 'preload' },
    ).catch(error => error as Error);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(preloadOperation).toHaveBeenCalledTimes(1);

    const foregroundWaiter = scheduleNativeWaveformExtraction(
      'song:foreground',
      foregroundOperation,
      foregroundController.signal,
    );

    await expect(preloadWaiter).resolves.toBeInstanceOf(OperationAbortError);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(foregroundOperation).toHaveBeenCalledTimes(1);

    foregroundNative.resolve({ points: [0.2, 0.8] });
    await expect(foregroundWaiter).resolves.toEqual({ points: [0.2, 0.8] });
    preloadNative.resolve(null);
    await Promise.resolve();
  });

  test('a preload cannot supersede foreground work already waiting to start', async () => {
    const activeNative = deferred<NativeResult>();
    const queuedNative = deferred<NativeResult>();
    const activeOperation = jest.fn(() => activeNative.promise);
    const queuedOperation = jest.fn(() => queuedNative.promise);
    const preloadOperation = jest.fn(() => Promise.resolve({ points: [0.1, 0.9] }));

    const activeWaiter = scheduleNativeWaveformExtraction(
      'song:active-foreground', activeOperation, new AbortController().signal,
    );
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    const queuedWaiter = scheduleNativeWaveformExtraction(
      'song:queued-foreground', queuedOperation, new AbortController().signal,
    );
    const preloadWaiter = scheduleNativeWaveformExtraction(
      'song:late-preload', preloadOperation, new AbortController().signal,
      { priority: 'preload' },
    );

    await expect(preloadWaiter).rejects.toBeInstanceOf(WaveformSchedulerUnavailableError);
    activeNative.resolve({ points: [0.2, 0.8] });
    await expect(activeWaiter).resolves.toEqual({ points: [0.2, 0.8] });
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(queuedOperation).toHaveBeenCalledTimes(1);
    expect(preloadOperation).not.toHaveBeenCalled();

    queuedNative.resolve({ points: [0.3, 0.7] });
    await expect(queuedWaiter).resolves.toEqual({ points: [0.3, 0.7] });
  });

  test('foreground demand for the preloaded source joins the same native flight', async () => {
    const native = deferred<NativeResult>();
    const preloadOperation = jest.fn(() => native.promise);
    const duplicateForegroundOperation = jest.fn(() => Promise.resolve({ points: [0.1, 0.9] }));

    const preloadWaiter = scheduleNativeWaveformExtraction(
      'song:promoted', preloadOperation, new AbortController().signal,
      { priority: 'preload' },
    );
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    const foregroundWaiter = scheduleNativeWaveformExtraction(
      'song:promoted', duplicateForegroundOperation, new AbortController().signal,
    );

    native.resolve({ points: [0.2, 0.8] });
    await expect(Promise.all([preloadWaiter, foregroundWaiter])).resolves.toEqual([
      { points: [0.2, 0.8] },
      { points: [0.2, 0.8] },
    ]);
    expect(preloadOperation).toHaveBeenCalledTimes(1);
    expect(duplicateForegroundOperation).not.toHaveBeenCalled();
  });

  test('drops joined foreground priority after that waiter aborts', async () => {
    const preloadNative = deferred<NativeResult>();
    const nextForegroundNative = deferred<NativeResult>();
    const preloadOperation = jest.fn(() => preloadNative.promise);
    const duplicateForegroundOperation = jest.fn(() => Promise.resolve({ points: [0.1, 0.9] }));
    const nextForegroundOperation = jest.fn(() => nextForegroundNative.promise);
    const joinedForegroundController = new AbortController();

    const preloadWaiter = scheduleNativeWaveformExtraction(
      'song:promoted-then-left', preloadOperation, new AbortController().signal,
      { priority: 'preload' },
    ).catch(error => error as Error);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    const joinedForegroundWaiter = scheduleNativeWaveformExtraction(
      'song:promoted-then-left', duplicateForegroundOperation, joinedForegroundController.signal,
    );
    joinedForegroundController.abort(new OperationAbortError('visible song changed again'));
    await expect(joinedForegroundWaiter).rejects.toThrow('visible song changed again');

    const nextForegroundWaiter = scheduleNativeWaveformExtraction(
      'song:new-visible', nextForegroundOperation, new AbortController().signal,
    ).catch(error => error as Error);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    expect(nextForegroundOperation).toHaveBeenCalledTimes(1);
    await expect(preloadWaiter).resolves.toBeInstanceOf(OperationAbortError);
    expect(duplicateForegroundOperation).not.toHaveBeenCalled();
    nextForegroundNative.resolve({ points: [0.4, 0.6] });
    await expect(nextForegroundWaiter).resolves.toEqual({ points: [0.4, 0.6] });
    preloadNative.resolve(null);
    await Promise.resolve();
  });

  test('a likely-next preload preempts lower-priority previous-track work', async () => {
    const previousNative = deferred<NativeResult>();
    const nextNative = deferred<NativeResult>();
    const previousOperation = jest.fn(() => previousNative.promise);
    const nextOperation = jest.fn(() => nextNative.promise);

    const previousWaiter = scheduleNativeWaveformExtraction(
      'song:previous', previousOperation, new AbortController().signal,
      { priority: 'background' },
    ).catch(error => error as Error);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    const nextWaiter = scheduleNativeWaveformExtraction(
      'song:next', nextOperation, new AbortController().signal,
      { priority: 'preload' },
    );
    await expect(previousWaiter).resolves.toBeInstanceOf(OperationAbortError);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    expect(nextOperation).toHaveBeenCalledTimes(1);
    nextNative.resolve({ points: [0.3, 0.7] });
    await expect(nextWaiter).resolves.toEqual({ points: [0.3, 0.7] });
    previousNative.resolve(null);
    await Promise.resolve();
  });

  test('foreground can restart a preempted source without joining its rejected detached flight', async () => {
    const oldPreviousNative = deferred<NativeResult>();
    const restartedPreviousNative = deferred<NativeResult>();
    const oldPreviousOperation = jest.fn(() => oldPreviousNative.promise);
    const nextOperation = jest.fn(() => Promise.resolve({ points: [0.1, 0.9] }));
    const restartedPreviousOperation = jest.fn(() => restartedPreviousNative.promise);

    const oldPreviousWaiter = scheduleNativeWaveformExtraction(
      'song:return-to-previous', oldPreviousOperation, new AbortController().signal,
      { priority: 'background' },
    ).catch(error => error as Error);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    const nextWaiter = scheduleNativeWaveformExtraction(
      'song:next-after-previous', nextOperation, new AbortController().signal,
      { priority: 'preload' },
    ).catch(error => error as Error);
    await expect(oldPreviousWaiter).resolves.toBeInstanceOf(OperationAbortError);

    const visiblePreviousWaiter = scheduleNativeWaveformExtraction(
      'song:return-to-previous', restartedPreviousOperation, new AbortController().signal,
    );
    await expect(nextWaiter).resolves.toBeInstanceOf(OperationAbortError);
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);

    expect(oldPreviousOperation).toHaveBeenCalledTimes(1);
    expect(restartedPreviousOperation).toHaveBeenCalledTimes(1);
    expect(nextOperation).not.toHaveBeenCalled();
    restartedPreviousNative.resolve({ points: [0.2, 0.8] });
    await expect(visiblePreviousWaiter).resolves.toEqual({ points: [0.2, 0.8] });
    oldPreviousNative.resolve(null);
    await Promise.resolve();
  });

  test('a cancellation-capable caller can restart instead of rejoining an aborting detached flight', async () => {
    const cancelledNative = deferred<NativeResult>();
    const restartedNative = deferred<NativeResult>();
    const cancelledOperation = jest.fn(() => cancelledNative.promise);
    const restartedOperation = jest.fn(() => restartedNative.promise);
    const cancelledController = new AbortController();

    const cancelledWaiter = scheduleNativeWaveformExtraction(
      'song:cancellable-return', cancelledOperation, cancelledController.signal,
      { rejoinDetached: false },
    );
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    cancelledController.abort(new OperationAbortError('left source'));
    await expect(cancelledWaiter).rejects.toThrow('left source');

    const restartedWaiter = scheduleNativeWaveformExtraction(
      'song:cancellable-return', restartedOperation, new AbortController().signal,
      { rejoinDetached: false },
    );
    await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_DEBOUNCE_MS);
    expect(restartedOperation).toHaveBeenCalledTimes(1);

    restartedNative.resolve({ points: [0.25, 0.75] });
    await expect(restartedWaiter).resolves.toEqual({ points: [0.25, 0.75] });
    cancelledNative.resolve(null);
    await Promise.resolve();
  });
});
