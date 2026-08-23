import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import {
  clearSafWriteOperationsForTests, getActiveSafWrite, getSafWriteOperation, runSafWriteOperation,
} from '../tagWriterLocks';
import { mapNativeRecoveryOutcome, restoreAndReconcileTagWrites } from '../tagWriterRecovery';

const STORAGE_KEY = '@musik-player/tag-write-operations/v1';
const NATIVE_ONLY_STORAGE_KEY = '@musik-player/tag-write-native-only-outcomes/v1';
const nativeOnlyRecordKey = (id: string) => `${NATIVE_ONLY_STORAGE_KEY}/record/${encodeURIComponent(id)}`;

describe('persisted tag-write recovery', () => {
  beforeEach(() => {
    clearSafWriteOperationsForTests();
    const storage = AsyncStorage as typeof AsyncStorage & {
      __reset: () => void;
      __getStore: () => Map<string, string>;
    };
    storage.__reset();
    jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(async (key, value) => {
      storage.__getStore().set(key, value);
    });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockReset().mockResolvedValue({
      available: true,
      pendingCount: 1,
      transactions: [{ transactionId: 'pending-native', state: 'WRITE_STARTED' }],
    });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockReset();
    Object.defineProperty(SystemAudio, 'acknowledgeAudioTagRecoveryOutcomes', {
      configurable: true, value: jest.fn().mockResolvedValue(true),
    });
  });

  test('releases stale ownership as failed when authoritative native recovery has no matching result', async () => {
    const targetKey = 'content://provider/document/primary:Music/song.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'persisted-operation', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({ success: true, transactions: [] });
    await restoreAndReconcileTagWrites();
    expect(getActiveSafWrite(targetKey)).toBeUndefined();
  });

  test('runs native startup recovery without a persisted JavaScript owner', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true,
      transactions: [{
        transactionId: 'native-only', previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
        recovered: false, pending: false,
      }],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem(nativeOnlyRecordKey('native-only'))) ?? 'null')).toEqual({
      kind: 'native-only-recovery-outcome', operationId: 'native-only',
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    });
    expect(getSafWriteOperation('native-only')).toMatchObject({
      operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false,
    });
    expect(getActiveSafWrite('native-only:native-only')).toBeUndefined();
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenCalledWith(['native-only']);
  });

  test('acknowledges only the native-only prefix whose evidence was persisted', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true, transactions: [
        { transactionId: 'native-first', previousState: 'WRITE_STARTED', resultState: 'COMMITTED', recovered: false, pending: false },
        { transactionId: 'native-second', previousState: 'RECOVERY_REQUIRED', resultState: 'RECOVERED', recovered: true, pending: false },
        { transactionId: 'native-third', previousState: 'RECOVERY_FAILED', resultState: 'RECOVERY_FAILED', recovered: false, pending: false, errorCode: 'BackupCorrupted' },
      ],
    });
    const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem)
      .mockImplementationOnce(write)
      .mockRejectedValueOnce(new Error('second evidence failed'));

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('second evidence failed');
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenCalledWith(['native-first']);
    expect(JSON.parse((await AsyncStorage.getItem(nativeOnlyRecordKey('native-first'))) ?? 'null'))
      .toEqual(expect.objectContaining({ operationId: 'native-first' }));
    expect(await AsyncStorage.getItem(nativeOnlyRecordKey('native-second'))).toBeNull();
  });

  test.each([
    ['native-commit', { previousState: 'WRITE_STARTED', resultState: 'COMMITTED', recovered: false, pending: false },
      { operationStatus: 'completed', retryable: false, errorCode: undefined }],
    ['native-rollback', { previousState: 'RECOVERY_REQUIRED', resultState: 'RECOVERED', recovered: true, pending: false },
      { operationStatus: 'failed', retryable: true, errorCode: 'TagWriteRolledBack' }],
    ['native-failure', { previousState: 'RECOVERY_FAILED', resultState: 'RECOVERY_FAILED', recovered: false, pending: false, errorCode: 'BackupCorrupted' },
      { operationStatus: 'failed', retryable: true, errorCode: 'BackupCorrupted' }],
  ])('restores public native-only status after restart for %s', async (operationId, report, expected) => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockResolvedValueOnce({ success: true, transactions: [{ transactionId: operationId, ...report }] })
      .mockResolvedValueOnce({ success: true, transactions: [] });
    await restoreAndReconcileTagWrites();
    expect(getSafWriteOperation(operationId)).toMatchObject({ ...expected, terminal: true });

    clearSafWriteOperationsForTests();
    await restoreAndReconcileTagWrites();
    expect(getSafWriteOperation(operationId)).toMatchObject({ ...expected, terminal: true });
    expect(getActiveSafWrite(`native-only:${operationId}`)).toBeUndefined();
  });

  test.each([
    ['native-domain-commit', { previousState: 'WRITE_STARTED', resultState: 'COMMITTED', recovered: false, pending: false },
      { operationStatus: 'completed', errorCode: undefined }],
    ['native-domain-rollback', { previousState: 'RECOVERY_REQUIRED', resultState: 'RECOVERED', recovered: true, pending: false },
      { operationStatus: 'failed', errorCode: 'TagWriteRolledBack' }],
    ['native-domain-failure', { previousState: 'RECOVERY_FAILED', resultState: 'RECOVERY_FAILED', recovered: false, pending: false, errorCode: 'BackupCorrupted' },
      { operationStatus: 'failed', errorCode: 'BackupCorrupted' }],
  ])('keeps %s outside the owner journal after a later normal write and restart', async (
    operationId, report, expected,
  ) => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockResolvedValueOnce({ success: true, transactions: [{ transactionId: operationId, ...report }] })
      .mockResolvedValueOnce({ success: true, transactions: [] });
    await restoreAndReconcileTagWrites();
    await runSafWriteOperation(
      'content://provider/document/normal-after-native.mp3', async () => ({ ok: true }),
      { operationId: `owner-after-${operationId}` },
    );
    const journal = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as Array<{ operationId: string }>;
    expect(journal.some(item => item.operationId === operationId)).toBe(false);
    expect(journal.some(item => item.operationId === `owner-after-${operationId}`)).toBe(true);

    clearSafWriteOperationsForTests();
    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(getSafWriteOperation(operationId)).toMatchObject({ ...expected, terminal: true });
    expect(getSafWriteOperation(`owner-after-${operationId}`)).toMatchObject({
      operationStatus: 'completed', terminal: true,
    });
    expect(getActiveSafWrite(`native-only:${operationId}`)).toBeUndefined();
  });

  test('migrates the exact synthetic a6164137 duplicate out of the owner journal', async () => {
    const evidence = {
      kind: 'native-only-recovery-outcome', operationId: 'legacy-synthetic-duplicate',
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    };
    await AsyncStorage.setItem(nativeOnlyRecordKey(evidence.operationId), JSON.stringify(evidence));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: evidence.operationId, targetKey: `native-only:${encodeURIComponent(evidence.operationId)}`,
      phase: 'completed', terminal: true, retryable: false, operationStatus: 'completed', updatedAt: 0,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({ success: true, transactions: [] });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(getSafWriteOperation(evidence.operationId)).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null')).toEqual([]);
  });

  test.each([
    ['a real owner target', { targetKey: 'content://provider/document/real-owner.mp3' }],
    ['a different outcome', { operationStatus: 'failed', phase: 'failed', retryable: true, errorCode: 'DifferentOutcome' }],
  ])('fails closed when native-only evidence collides with %s', async (_label, override) => {
    const operationId = 'native-owner-collision';
    await AsyncStorage.setItem(nativeOnlyRecordKey(operationId), JSON.stringify({
      kind: 'native-only-recovery-outcome', operationId,
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId, targetKey: `native-only:${operationId}`, phase: 'completed', terminal: true,
      retryable: false, operationStatus: 'completed', updatedAt: 0, ...override,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow(
      'Operation ID exists in both owned and native-only recovery evidence',
    );
    expect(SystemAudio.recoverPendingAudioTagTransactions).not.toHaveBeenCalled();
  });

  test.each([49, 50, 51])(
    'keeps native-only evidence separate while rotating %i owner-history records', async historyCount => {
      const operationId = `native-with-${historyCount}-owners`;
      await AsyncStorage.setItem(nativeOnlyRecordKey(operationId), JSON.stringify({
        kind: 'native-only-recovery-outcome', operationId,
        outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
      }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from({ length: historyCount }, (_, index) => ({
        operationId: `history-${historyCount}-${index}`, targetKey: `content://provider/document/history-${index}.mp3`,
        phase: 'completed', terminal: true, retryable: false, operationStatus: 'completed', updatedAt: index + 1,
      }))));
      Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
      jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
        .mockResolvedValueOnce({ success: true, transactions: [] })
        .mockResolvedValueOnce({ success: true, transactions: [] });
      await restoreAndReconcileTagWrites();
      await runSafWriteOperation(
        `content://provider/document/rotation-${historyCount}.mp3`, async () => ({ ok: true }),
        { operationId: `rotation-${historyCount}` },
      );
      const journal = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as Array<{ operationId: string }>;
      expect(journal).toHaveLength(50);
      expect(journal.some(item => item.operationId === operationId)).toBe(false);
      expect(await AsyncStorage.getItem(nativeOnlyRecordKey(operationId))).not.toBeNull();
      clearSafWriteOperationsForTests();
      await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
      expect(getSafWriteOperation(operationId)).toMatchObject({ operationStatus: 'completed', terminal: true });
    },
  );

  test('keeps all 51 acknowledged native-only outcomes in immutable public evidence', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    const transactions = Array.from({ length: 51 }, (_, index) => ({
      transactionId: `native-capacity-${index}`, previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
      recovered: false, pending: false,
    }));
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({ success: true, transactions });

    await restoreAndReconcileTagWrites();
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenCalledWith(
      transactions.map(item => item.transactionId),
    );
    for (const { transactionId } of transactions) {
      expect(await AsyncStorage.getItem(nativeOnlyRecordKey(transactionId))).not.toBeNull();
      expect(getSafWriteOperation(transactionId)).toMatchObject({ operationStatus: 'completed', terminal: true });
    }
    await runSafWriteOperation(
      'content://provider/document/after-large-native-batch.mp3', async () => ({ ok: true }),
      { operationId: 'owner-after-large-native-batch' },
    );
    const journal = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as Array<{ operationId: string }>;
    expect(journal.some(item => item.operationId.startsWith('native-capacity-'))).toBe(false);
    for (let restart = 0; restart < 2; restart += 1) {
      clearSafWriteOperationsForTests();
      jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({ success: true, transactions: [] });
      await restoreAndReconcileTagWrites();
      for (const { transactionId } of transactions)
        expect(getSafWriteOperation(transactionId)).toMatchObject({ operationStatus: 'completed', terminal: true });
    }
  });

  test('keeps native-only history out of busy/conflict persistence', async () => {
    const operationId = 'native-before-busy';
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true, transactions: [{
        transactionId: operationId, previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
        recovered: false, pending: false,
      }],
    });
    await restoreAndReconcileTagWrites();
    let finishNative!: (value: { ok: true }) => void;
    const native = new Promise<{ ok: true }>(resolve => { finishNative = resolve; });
    const first = runSafWriteOperation(
      'content://provider/document/busy-after-native.mp3', async () => native,
      { operationId: 'busy-owner' },
    );
    await Promise.resolve();
    await Promise.resolve();
    const conflict = await runSafWriteOperation(
      'content://provider/document/busy-after-native.mp3', async () => ({ ok: true }),
      { operationId: 'busy-rejected' },
    );
    expect(conflict.kind).toBe('busy');
    finishNative({ ok: true });
    await first;
    const journal = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as Array<{ operationId: string }>;
    expect(journal.some(item => item.operationId === operationId)).toBe(false);
    clearSafWriteOperationsForTests();
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({ success: true, transactions: [] });
    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(getSafWriteOperation(operationId)).toMatchObject({ operationStatus: 'completed', terminal: true });
  });

  test.each([
    ['corrupt JSON', '{'],
    ['unknown field', JSON.stringify({
      kind: 'native-only-recovery-outcome', operationId: 'invalid-native-only', extra: true,
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    })],
    ['invalid ID', JSON.stringify({
      kind: 'native-only-recovery-outcome', operationId: ' invalid-native-only ',
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    })],
    ['contradictory outcome', JSON.stringify({
      kind: 'native-only-recovery-outcome', operationId: 'invalid-native-only',
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: true },
    })],
  ])('fails startup closed for %s immutable native-only evidence', async (_label, value) => {
    await AsyncStorage.setItem(nativeOnlyRecordKey('invalid-native-only'), value);
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    await expect(restoreAndReconcileTagWrites()).rejects.toThrow(/native-only|terminal tag-write outcome/i);
    expect(SystemAudio.recoverPendingAudioTagTransactions).not.toHaveBeenCalled();
  });

  test('rejects contradictory duplicate native-only evidence for the same operation ID', async () => {
    const completed = {
      kind: 'native-only-recovery-outcome', operationId: 'duplicate-native-only',
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    };
    await AsyncStorage.setItem(NATIVE_ONLY_STORAGE_KEY, JSON.stringify([completed]));
    await AsyncStorage.setItem(nativeOnlyRecordKey('duplicate-native-only'), JSON.stringify({
      ...completed,
      outcome: { operationStatus: 'failed', phase: 'failed', terminal: true, retryable: true, errorCode: 'BackupCorrupted' },
    }));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('Contradictory native-only recovery evidence');
    expect(SystemAudio.recoverPendingAudioTagTransactions).not.toHaveBeenCalled();
  });

  test('opens startup normally when both JavaScript and native journals are empty', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: true,
      pendingCount: 0,
      retainedOutcomeCount: 0,
      transactions: [],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.getAudioTagRecoveryStatus).toHaveBeenCalledTimes(1);
    expect(SystemAudio.recoverPendingAudioTagTransactions).not.toHaveBeenCalled();
  });

  test('runs full recovery for a retained native receipt without an active journal', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: true,
      pendingCount: 0,
      retainedOutcomeCount: 1,
      transactions: [],
    });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true,
      transactions: [{
        transactionId: 'retained-native-only',
        previousState: 'WRITE_STARTED',
        resultState: 'COMMITTED',
        recovered: false,
        pending: false,
      }],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenCalledWith(['retained-native-only']);
  });

  test('does not let confirmed JavaScript evidence hide a later native-only receipt', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'confirmed-owner',
      targetKey: 'content://provider/document/confirmed-owner.mp3',
      phase: 'pendingNativeResult',
      terminal: false,
      retryable: true,
      operationStatus: 'recovery-pending',
      errorCode: 'TerminalJournalPersistenceFailed',
      updatedAt: 1,
      confirmedTerminalOutcome: {
        operationStatus: 'completed',
        phase: 'completed',
        terminal: true,
        retryable: false,
        nativeRecoverySummaryComplete: true,
      },
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: true,
      pendingCount: 0,
      retainedOutcomeCount: 1,
      transactions: [],
    });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true,
      transactions: [{
        transactionId: 'native-after-confirmed-owner',
        previousState: 'WRITE_STARTED',
        resultState: 'COMMITTED',
        recovered: false,
        pending: false,
      }],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
    expect(getSafWriteOperation('confirmed-owner')).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(getSafWriteOperation('native-after-confirmed-owner')).toMatchObject({ operationStatus: 'completed', terminal: true });
  });

  test('falls back to full native recovery when the status fast path fails', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockRejectedValueOnce(new Error('status unavailable'));
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true,
      transactions: [],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
  });

  test('falls back to full native recovery when native storage could not be inspected', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: false,
      pendingCount: 0,
      retainedOutcomeCount: 0,
      transactions: [],
    });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true,
      transactions: [],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
  });

  test('can retry after native-only startup recovery rejects', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockRejectedValueOnce(new Error('native unavailable'))
      .mockResolvedValueOnce({ success: true, transactions: [] });

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('native unavailable');
    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(2);
  });

  test.each([
    { success: false, pendingCount: 1, failedCount: 0 },
    { success: false, pendingCount: 0, failedCount: 1, errorCode: 'RecoveryFailed' },
  ])('keeps startup fail-closed for an unsuccessful native-only summary %#', async summary => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      ...summary, transactions: [],
    });

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow(
      summary.errorCode ?? 'Native tag-write recovery incomplete',
    );
  });

  test('reconciles a terminal report but keeps startup closed for remaining pending evidence', async () => {
    const targetKey = 'content://provider/document/mixed.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'mixed-terminal', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: false, pendingCount: 1, failedCount: 0,
      transactions: [{
        transactionId: 'mixed-terminal', previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
        recovered: false, pending: false,
      }],
    });

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('recovery incomplete');
    expect(getSafWriteOperation('mixed-terminal')).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(getActiveSafWrite(targetKey)).toBeUndefined();
  });

  test('opens startup after a persisted terminal native recovery failure is acknowledged', async () => {
    const targetKey = 'content://provider/document/corrupted-backup.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'corrupted-backup', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    Object.defineProperty(SystemAudio, 'acknowledgeAudioTagRecoveryOutcomes', {
      configurable: true, value: jest.fn().mockResolvedValue(undefined),
    });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: false, pendingCount: 0, failedCount: 1, errorCode: 'BackupCorrupted',
      transactions: [{
        transactionId: 'corrupted-backup', previousState: 'RECOVERY_FAILED', resultState: 'RECOVERY_FAILED',
        recovered: false, pending: false, errorCode: 'BackupCorrupted',
      }],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(getSafWriteOperation('corrupted-backup')).toMatchObject({
      operationStatus: 'failed', terminal: true, errorCode: 'BackupCorrupted',
    });
    expect(getActiveSafWrite(targetKey)).toBeUndefined();
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenCalledWith(['corrupted-backup']);
  });

  test('acknowledges a replayed receipt whose terminal owner survived a failed acknowledgement', async () => {
    const operationId = 'replayed-terminal-owner';
    const targetKey = 'content://provider/document/replayed-terminal-owner.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId, targetKey, phase: 'pendingNativeResult', terminal: false,
      retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    const report = {
      success: true, pendingCount: 0, failedCount: 0, transactions: [{
        transactionId: operationId, previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
        recovered: false, pending: false,
      }],
    };
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockResolvedValueOnce(report).mockResolvedValueOnce(report);
    jest.mocked(SystemAudio.acknowledgeAudioTagRecoveryOutcomes)
      .mockRejectedValueOnce(new Error('acknowledgement unavailable'))
      .mockResolvedValue(true);

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('acknowledgement unavailable');
    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(getSafWriteOperation(operationId)).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(await AsyncStorage.getItem(nativeOnlyRecordKey(operationId))).toBeNull();
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenLastCalledWith([operationId]);
  });

  test('acknowledges a regenerated terminal failure receipt as owned evidence on a later launch', async () => {
    const operationId = 'regenerated-terminal-failure';
    const targetKey = 'content://provider/document/regenerated-terminal-failure.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId, targetKey, phase: 'failed', terminal: true, retryable: true,
      operationStatus: 'failed', errorCode: 'BackupCorrupted', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: false, pendingCount: 0, failedCount: 1, errorCode: 'BackupCorrupted',
      transactions: [{
        transactionId: operationId, previousState: 'RECOVERY_FAILED', resultState: 'RECOVERY_FAILED',
        recovered: false, pending: false, errorCode: 'BackupCorrupted',
      }],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
    expect(getSafWriteOperation(operationId)).toMatchObject({
      operationStatus: 'failed', terminal: true, errorCode: 'BackupCorrupted',
    });
    expect(await AsyncStorage.getItem(nativeOnlyRecordKey(operationId))).toBeNull();
    expect(SystemAudio.acknowledgeAudioTagRecoveryOutcomes).toHaveBeenCalledWith([operationId]);
  });

  test('reuses the canonical restored owner on retry and persists its terminal outcome', async () => {
    const targetKey = 'content://provider/document/retry.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'retry-owner', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockRejectedValueOnce(new Error('transient recovery failure'))
      .mockResolvedValueOnce({
        success: true, pendingCount: 0, failedCount: 0,
        transactions: [{
          transactionId: 'retry-owner', previousState: 'WRITTEN_UNVERIFIED', resultState: 'COMMITTED',
          recovered: false, pending: false,
        }],
      })
      .mockResolvedValueOnce({ success: true, transactions: [] });

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('transient recovery failure');
    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(getActiveSafWrite(targetKey)).toBeUndefined();
    expect(getSafWriteOperation('retry-owner')).toMatchObject({ operationStatus: 'completed', terminal: true });
    const journal = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '[]') as Array<{ operationId: string; terminal: boolean }>;
    expect(journal.find(item => item.operationId === 'retry-owner')).toMatchObject({ terminal: true });
    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
  });

  test('finishes persisted confirmed commit evidence after restart without a native report', async () => {
    const targetKey = 'content://provider/document/confirmed-after-restart.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'confirmed-after-restart', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: true, operationStatus: 'recovery-pending', updatedAt: 1,
      errorCode: 'TerminalJournalPersistenceFailed', commitConfirmed: true,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true, transactions: [],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(getSafWriteOperation('confirmed-after-restart')).toMatchObject({
      operationStatus: 'completed', terminal: true, commitConfirmed: undefined,
    });
    expect(getActiveSafWrite(targetKey)).toBeUndefined();
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
  });

  test('retries a one-shot committed recovery outcome using only durable evidence', async () => {
    const targetKey = 'content://provider/document/recovery-persist-retry.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'recovery-persist-retry', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: true, operationStatus: 'recovery-pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    const report = {
      success: true, transactions: [{
        transactionId: 'recovery-persist-retry', previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
        recovered: false, pending: false,
      }],
    };
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({ success: true, transactions: [] });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: true, pendingCount: 0, retainedOutcomeCount: 0, transactions: [],
    });
    const writeJournal = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem)
      .mockImplementationOnce(writeJournal)
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockRejectedValueOnce(new Error('storage still unavailable'));

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('storage unavailable');
    expect(getSafWriteOperation('recovery-persist-retry')).toMatchObject({
      terminal: false,
      confirmedTerminalOutcome: { operationStatus: 'completed', terminal: true },
    });
    expect(getActiveSafWrite(targetKey)?.operationId).toBe('recovery-persist-retry');

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('storage still unavailable');
    expect(getActiveSafWrite(targetKey)).toMatchObject({
      confirmedTerminalOutcome: { operationStatus: 'completed' },
    });
    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(getSafWriteOperation('recovery-persist-retry')).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(getActiveSafWrite(targetKey)).toBeUndefined();
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
  });

  test('retries a one-shot rollback outcome without reporting a write success', async () => {
    const targetKey = 'content://provider/document/rollback-persist-retry.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'rollback-persist-retry', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: true, operationStatus: 'recovery-pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockResolvedValueOnce({ success: true, transactions: [{
        transactionId: 'rollback-persist-retry', previousState: 'RECOVERY_REQUIRED', resultState: 'RECOVERED',
        recovered: true, pending: false,
      }] })
      .mockResolvedValueOnce({ success: true, transactions: [] });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: true, pendingCount: 0, retainedOutcomeCount: 0, transactions: [],
    });
    const writeJournal = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem)
      .mockImplementationOnce(writeJournal)
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('storage unavailable');
    expect(getActiveSafWrite(targetKey)).toMatchObject({
      confirmedTerminalOutcome: { operationStatus: 'failed', errorCode: 'TagWriteRolledBack' },
    });
    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(getSafWriteOperation('rollback-persist-retry')).toMatchObject({
      operationStatus: 'failed', terminal: true, errorCode: 'TagWriteRolledBack',
    });
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
  });

  test('runs recovery again when the summary which confirmed an outcome was incomplete', async () => {
    const targetKey = 'content://provider/document/incomplete-summary.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'incomplete-summary', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: true, operationStatus: 'recovery-pending', updatedAt: 1,
    }]));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions)
      .mockResolvedValueOnce({
        success: false, pendingCount: 1, transactions: [{
          transactionId: 'incomplete-summary', previousState: 'WRITE_STARTED', resultState: 'COMMITTED',
          recovered: false, pending: false,
        }],
      })
      .mockResolvedValueOnce({ success: true, transactions: [] });
    const writeJournal = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem)
      .mockImplementationOnce(writeJournal)
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('storage unavailable');
    expect(getActiveSafWrite(targetKey)).toMatchObject({
      confirmedTerminalOutcome: { nativeRecoverySummaryComplete: false },
    });
    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(1);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(2);
  });

  test('stages every terminal outcome from one summary before the first evidence write can fail', async () => {
    const owners = [
      { operationId: 'batch-commit', targetKey: 'content://provider/document/batch-commit.mp3' },
      { operationId: 'batch-rollback', targetKey: 'content://provider/document/batch-rollback.mp3' },
    ];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(owners.map(owner => ({
      ...owner, phase: 'pendingNativeResult', terminal: false, retryable: true,
      operationStatus: 'recovery-pending', updatedAt: 1,
    }))));
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true, pendingCount: 0, failedCount: 0, transactions: [
        { transactionId: 'batch-commit', previousState: 'WRITE_STARTED', resultState: 'COMMITTED', recovered: false, pending: false },
        { transactionId: 'batch-rollback', previousState: 'RECOVERY_REQUIRED', resultState: 'RECOVERED', recovered: true, pending: false },
      ],
    });
    jest.mocked(SystemAudio.getAudioTagRecoveryStatus).mockResolvedValueOnce({
      available: true, pendingCount: 0, retainedOutcomeCount: 0, transactions: [],
    });
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('first evidence write failed'));

    await expect(restoreAndReconcileTagWrites()).rejects.toThrow('first evidence write failed');
    expect(getActiveSafWrite(owners[0].targetKey)).toMatchObject({
      confirmedTerminalOutcome: { operationStatus: 'completed', nativeRecoverySummaryComplete: true },
    });
    expect(getActiveSafWrite(owners[1].targetKey)).toMatchObject({
      confirmedTerminalOutcome: { operationStatus: 'failed', errorCode: 'TagWriteRolledBack' },
    });
    await expect(restoreAndReconcileTagWrites()).resolves.toHaveLength(2);
    expect(SystemAudio.recoverPendingAudioTagTransactions).toHaveBeenCalledTimes(1);
    expect(getSafWriteOperation('batch-commit')).toMatchObject({ operationStatus: 'completed', terminal: true });
    expect(getSafWriteOperation('batch-rollback')).toMatchObject({ operationStatus: 'failed', terminal: true });
  });

  test.each([
    'text', [], {},
    { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: true },
    { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false, errorCode: 'bad' },
    { operationStatus: 'failed', phase: 'completed', terminal: true, retryable: true, errorCode: 'Failure' },
    { operationStatus: 'failed', phase: 'failed', terminal: true, retryable: true },
    { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false, nativeRecoverySummaryComplete: 'yes' },
  ])('rejects malformed confirmed terminal outcome %#', async confirmedTerminalOutcome => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'malformed-evidence', targetKey: 'content://provider/document/malformed.mp3',
      phase: 'pendingNativeResult', terminal: false, retryable: true,
      operationStatus: 'recovery-pending', errorCode: 'TerminalJournalPersistenceFailed', updatedAt: 1,
      confirmedTerminalOutcome,
    }]));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSafWriteOperations } = require('../tagWriterLocks') as typeof import('../tagWriterLocks');
    await expect(restoreSafWriteOperations()).rejects.toThrow();
  });

  test('rejects confirmed evidence combined with commit evidence', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'double-evidence', targetKey: 'content://provider/document/double.mp3',
      phase: 'pendingNativeResult', terminal: false, retryable: true, operationStatus: 'recovery-pending',
      errorCode: 'TerminalJournalPersistenceFailed', updatedAt: 1, commitConfirmed: true,
      confirmedTerminalOutcome: {
        operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false,
        nativeRecoverySummaryComplete: true,
      },
    }]));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSafWriteOperations } = require('../tagWriterLocks') as typeof import('../tagWriterLocks');
    await expect(restoreSafWriteOperations()).rejects.toThrow('Contradictory');
  });

  test('rejects contradictory persisted terminal information', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'bad', targetKey: 'content://provider/document/id',
      phase: 'completed', terminal: true, retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreSafWriteOperations } = require('../tagWriterLocks') as typeof import('../tagWriterLocks');
    await expect(restoreSafWriteOperations()).rejects.toThrow('Contradictory');
  });

  test('maps a verified committed rewrite to completed', () => {
    expect(mapNativeRecoveryOutcome({
      transactionId: 'commit', previousState: 'COMMITTED', recovered: false,
      pending: false,
    })).toMatchObject({ operationStatus: 'completed', terminal: true, retryable: false });
  });

  test.each(['WRITE_STARTED', 'WRITTEN_UNVERIFIED'] as const)(
    'maps a %s rewrite with explicit committed evidence to completed', previousState => {
      expect(mapNativeRecoveryOutcome({
        transactionId: `commit-${previousState}`, previousState, resultState: 'COMMITTED',
        recovered: false, pending: false,
      })).toMatchObject({ operationStatus: 'completed', terminal: true, retryable: false });
    },
  );

  test.each(['RECOVERY_REQUIRED', 'RECOVERY_FAILED'] as const)(
    'maps a digest-verified %s rewrite to completed with or without terminal cleanup', previousState => {
      for (const resultState of ['COMMITTED', null] as const) {
        expect(mapNativeRecoveryOutcome({
          transactionId: `recovered-commit-${previousState}-${resultState}`, previousState,
          resultState: resultState as unknown as string,
          recovered: false, pending: false,
        })).toMatchObject({ operationStatus: 'completed', terminal: true, retryable: false });
      }
    },
  );

  test.each(['RECOVERY_REQUIRED', 'RECOVERY_FAILED'] as const)(
    'rejects contradictory commit evidence from %s', previousState => {
      expect(mapNativeRecoveryOutcome({
        transactionId: `pending-${previousState}`, previousState, resultState: 'COMMITTED',
        recovered: false, pending: true,
      })).not.toMatchObject({ operationStatus: 'completed' });
      expect(mapNativeRecoveryOutcome({
        transactionId: `rollback-${previousState}`, previousState, resultState: 'COMMITTED',
        recovered: true, pending: false,
      })).not.toMatchObject({ operationStatus: 'completed' });
      expect(mapNativeRecoveryOutcome({
        transactionId: `error-${previousState}`, previousState, resultState: 'COMMITTED',
        recovered: false, pending: false, errorCode: 'RecoveryFailed',
      })).not.toMatchObject({ operationStatus: 'completed' });
    },
  );

  test('maps restored original content to a retryable rolled-back failure', () => {
    expect(mapNativeRecoveryOutcome({
      transactionId: 'rollback', previousState: 'WRITE_STARTED', resultState: 'RECOVERED',
      recovered: true, pending: false,
    })).toMatchObject({
      operationStatus: 'failed', terminal: true, retryable: true, errorCode: 'TagWriteRolledBack',
    });
  });

  test('keeps pending recovery bound and fails contradictory outcomes closed', () => {
    expect(mapNativeRecoveryOutcome({
      transactionId: 'pending', previousState: 'RECOVERY_REQUIRED', resultState: 'RECOVERY_REQUIRED',
      recovered: false, pending: true, errorCode: 'RecoveryPending',
    })).toMatchObject({ operationStatus: 'recovery-pending', terminal: false });
    expect(mapNativeRecoveryOutcome({
      transactionId: 'unknown', previousState: 'BACKUP_READY', recovered: false, pending: false,
    })).toMatchObject({ operationStatus: 'failed', terminal: true, errorCode: 'RecoveryOutcomeInconsistent' });
    for (const previousState of ['BACKUP_READY', undefined, 'UNKNOWN']) {
      expect(mapNativeRecoveryOutcome({
        transactionId: `invalid-${previousState}`, previousState, resultState: 'COMMITTED',
        recovered: false, pending: false,
      })).toMatchObject({ operationStatus: 'failed', terminal: true, errorCode: 'RecoveryOutcomeInconsistent' });
    }
  });
});
