import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAppTheme } from '../utils/appTheme';
import { hasBackupRestoreJournal, recoverBackupRestore } from '../utils/backupTransaction';
import { restoreMusicBackup, type RestoreBackupRequest } from '../utils/backupService';
import { blockPersistenceForMaintenance, flushPersistenceOwners, releasePersistenceMaintenance,
  trackPersistenceWork, waitForPersistenceWork } from '../utils/persistenceMaintenance';
import { isMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { getLibraryScanOperation } from '../utils/libraryScanOperation';
import { hasActiveSafWriteOperations, isSafWriteStartupReady } from '../utils/tagWriterLocks';
import { storage } from '../utils/storage';
import { publishFavoriteSongIds } from '../utils/favoriteSongState';

interface MaintenanceApi { restore: (request: RestoreBackupRequest) => void }
const Context = createContext<MaintenanceApi | null>(null);
const fallbackTheme = getAppTheme('dark', 'graphite');
type Phase = 'recovering' | 'ready' | 'restoring' | 'blocked';
export const BackupMaintenanceBoundary = ({ children }: { children: React.ReactNode }) => {
  const [phase, setPhase] = useState<Phase>('recovering');
  const [error, setError] = useState('');
  const requestRef = useRef<RestoreBackupRequest | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const restore = useCallback((request: RestoreBackupRequest) => {
    if (runningRef.current || requestRef.current || phase !== 'ready') return;
    if (isMetadataRefreshActive() || getLibraryScanOperation().status === 'running') {
      Alert.alert('Sammlung wird bearbeitet', 'Bitte warte, bis der laufende Scan oder die Metadatenbearbeitung abgeschlossen ist.');
      return;
    }
    if (!isSafWriteStartupReady() || hasActiveSafWriteOperations()) {
      Alert.alert('Dateiänderung noch offen', 'Bitte schließe die laufende Tagbearbeitung oder deren Wiederherstellung ab, bevor du ein Backup übernimmst.');
      return;
    }
    flushPersistenceOwners();
    requestRef.current = request;
    setPhase('restoring');
  }, [phase]);
  useEffect(() => {
    if ((phase !== 'recovering' && phase !== 'restoring') || runningRef.current) return;
    runningRef.current = true;
    // This effect runs after child providers unmount and flush their final
    // debounced values. Never overlap that real write tail with the journal.
    void (async () => {
      try {
        await waitForPersistenceWork();
        blockPersistenceForMaintenance();
        let message: string | undefined;
        if (phase === 'restoring') {
          if (!requestRef.current) throw new Error('Backup-Vorschau fehlt.');
          message = await trackPersistenceWork(restoreMusicBackup(requestRef.current));
        } else {
          const result = await recoverBackupRestore();
          if (result !== 'none') publishFavoriteSongIds(await storage.getFavoriteSongIds());
          if (result === 'rolled-back') message = 'Eine unterbrochene Wiederherstellung wurde zurückgesetzt. Deine vorherigen Daten sind wieder hergestellt.';
          if (result === 'completed') message = 'Eine zuvor gespeicherte Wiederherstellung wurde vollständig abgeschlossen.';
        }
        releasePersistenceMaintenance();
        if (mountedRef.current) {
          setPhase('ready');
          if (message) Alert.alert('Backup & Wiederherstellung', message);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const retained = await hasBackupRestoreJournal().catch(() => true);
        if (!retained) releasePersistenceMaintenance();
        if (mountedRef.current) {
          setError(message); setPhase(retained ? 'blocked' : 'ready');
          if (!retained) Alert.alert('Wiederherstellung fehlgeschlagen', message);
        }
      } finally {
        runningRef.current = false; requestRef.current = null;
      }
    })();
  }, [phase]);
  return <Context.Provider value={{ restore }}>
    {phase === 'ready' ? children : <View testID="backup-maintenance" style={styles.root}>
      <Text style={styles.title}>Backup & Wiederherstellung</Text>
      <Text style={styles.copy}>{phase === 'blocked' ? error : 'Gespeicherte Daten werden sicher geprüft und abgeschlossen …'}</Text>
      {phase === 'blocked' && <Pressable testID="backup-recovery-retry" accessibilityRole="button"
        onPress={() => setPhase('recovering')} style={styles.button}><Text style={styles.copy}>Erneut versuchen</Text></Pressable>}
    </View>}
  </Context.Provider>;
};
export const useBackupMaintenance = (): MaintenanceApi | null => useContext(Context);
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: fallbackTheme.palette.background },
  title: { fontSize: 20, color: fallbackTheme.palette.text.primary },
  copy: { fontSize: 16, color: fallbackTheme.palette.text.primary },
  button: { minHeight: 48, justifyContent: 'center', padding: 14, borderWidth: 1, borderColor: fallbackTheme.palette.borderStrong },
});
