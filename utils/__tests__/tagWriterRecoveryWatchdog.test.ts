import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import {
  clearSafWriteOperationsForTests,
  isSafWriteStartupReady,
} from '../tagWriterLocks';
import {
  restoreAndReconcileTagWrites,
  TAG_WRITE_STARTUP_RECOVERY_TIMEOUT_MS,
  TagWriteStartupTimeoutError,
} from '../tagWriterRecovery';

describe('tag-write startup recovery watchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearSafWriteOperationsForTests();
    const storage = AsyncStorage as typeof AsyncStorage & { __reset: () => void };
    storage.__reset();
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    Object.defineProperty(SystemAudio, 'acknowledgeAudioTagRecoveryOutcomes', {
      configurable: true,
      value: jest.fn().mockResolvedValue(true),
    });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('times out, coalesces retries and reopens the write gate after a late success', async () => {
    let finishNative!: (value: {
      success: boolean;
      pendingCount: number;
      failedCount: number;
      transactions: [];
    }) => void;
    const pendingNative = new Promise<{
      success: boolean;
      pendingCount: number;
      failedCount: number;
      transactions: [];
    }>(resolve => { finishNative = resolve; });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockImplementationOnce(() => pendingNative)
      .mockResolvedValueOnce({ success: true, pendingCount: 0, failedCount: 0, transactions: [] });

    const first = restoreAndReconcileTagWrites();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(TAG_WRITE_STARTUP_RECOVERY_TIMEOUT_MS);
    await expect(first).rejects.toBeInstanceOf(TagWriteStartupTimeoutError);
    expect(isSafWriteStartupReady()).toBe(false);

    const retry = restoreAndReconcileTagWrites();
    await jest.advanceTimersByTimeAsync(TAG_WRITE_STARTUP_RECOVERY_TIMEOUT_MS);
    await expect(retry).rejects.toBeInstanceOf(TagWriteStartupTimeoutError);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);

    finishNative({ success: true, pendingCount: 0, failedCount: 0, transactions: [] });
    await jest.advanceTimersByTimeAsync(0);
    expect(isSafWriteStartupReady()).toBe(true);

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(2);
  });
});
