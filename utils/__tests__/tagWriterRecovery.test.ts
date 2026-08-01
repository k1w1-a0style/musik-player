import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSafWriteOperationsForTests, getActiveSafWrite } from '../tagWriterLocks';

const STORAGE_KEY = '@musik-player/tag-write-operations/v1';

describe('persisted tag-write recovery', () => {
  beforeEach(() => {
    clearSafWriteOperationsForTests();
  });

  test('restores ownership and fails closed when native reconciliation has no matching result', async () => {
    const targetKey = 'content://provider/document/primary:Music/song.mp3';
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([{
      operationId: 'persisted-operation', targetKey, phase: 'pendingNativeResult',
      terminal: false, retryable: false, operationStatus: 'pending', updatedAt: 1,
    }]));
    jest.doMock('expo-system-audio', () => ({
      __esModule: true,
      default: {
        hasNativeTagWriter: true,
        recoverPendingAudioTagTransactions: jest.fn(async () => ({ success: true, transactions: [] })),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { restoreAndReconcileTagWrites } = require('../tagWriterRecovery') as typeof import('../tagWriterRecovery');
    await restoreAndReconcileTagWrites();
    expect(getActiveSafWrite(targetKey)).toMatchObject({
      operationId: 'persisted-operation', operationStatus: 'recovery-pending',
      terminal: false, retryable: true, errorCode: 'RecoveryPending',
    });
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
});
