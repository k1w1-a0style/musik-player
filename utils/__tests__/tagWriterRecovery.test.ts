import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';
import { clearSafWriteOperationsForTests, getActiveSafWrite } from '../tagWriterLocks';
import { mapNativeRecoveryOutcome, restoreAndReconcileTagWrites } from '../tagWriterRecovery';

const STORAGE_KEY = '@musik-player/tag-write-operations/v1';

describe('persisted tag-write recovery', () => {
  beforeEach(() => {
    clearSafWriteOperationsForTests();
    jest.mocked(SystemAudio.recoverPendingAudioTagTransactions).mockClear();
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
  });
});
