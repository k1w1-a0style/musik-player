import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import {
  clearSafWriteOperationsForTests, getActiveSafWrite, getSafWriteOperation,
} from '../tagWriterLocks';
import { mapNativeRecoveryOutcome, restoreAndReconcileTagWrites } from '../tagWriterRecovery';

const STORAGE_KEY = '@musik-player/tag-write-operations/v1';
const NATIVE_ONLY_STORAGE_KEY = '@musik-player/tag-write-native-only-outcomes/v1';

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
    expect(JSON.parse((await AsyncStorage.getItem(NATIVE_ONLY_STORAGE_KEY)) ?? '[]')).toEqual([{
      kind: 'native-only-recovery-outcome', operationId: 'native-only',
      outcome: { operationStatus: 'completed', phase: 'completed', terminal: true, retryable: false },
    }]);
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
    expect(JSON.parse((await AsyncStorage.getItem(NATIVE_ONLY_STORAGE_KEY)) ?? '[]'))
      .toEqual([expect.objectContaining({ operationId: 'native-first' })]);
  });

  test('opens startup normally when both JavaScript and native journals are empty', async () => {
    Object.defineProperty(SystemAudio, 'hasNativeTagWriter', { configurable: true, value: true });
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockResolvedValueOnce({
      success: true, transactions: [],
    });

    await expect(restoreAndReconcileTagWrites()).resolves.toEqual([]);
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
