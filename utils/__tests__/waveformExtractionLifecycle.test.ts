import {
  resetWaveformExtractionLifecycleForTests,
  scheduleNativeWaveformExtraction,
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
});
