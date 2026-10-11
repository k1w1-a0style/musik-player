import React, { useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useBackupMaintenance } from './BackupMaintenanceBoundary';
import { backupFileLabel, chooseBackupFolder, readBackupFile, writeBackupFile } from '../utils/backupFiles';
import { createMusicBackup } from '../utils/backupService';
import type { MusicBackup } from '../utils/backupFormat';
import type { Song } from '../types/Song';
import { storage } from '../utils/storage';
import { isMetadataRefreshActive } from '../utils/metadataRefreshActivity';
import { getLibraryScanOperation } from '../utils/libraryScanOperation';
import { hasActiveSafWriteOperations, isSafWriteStartupReady } from '../utils/tagWriterLocks';
import BackupPreview from './BackupPreview';

const BackupSettings = () => {
  const { theme } = useAppTheme();
  const maintenance = useBackupMaintenance();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [files, setFiles] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<{ backup: MusicBackup; songs: Song[]; restore: boolean } | null>(null);
  const intentRef = useRef<'inspect' | 'restore'>('inspect');
  const text = { color: theme.palette.text.primary, fontFamily: theme.tokens.fonts.body };
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    if (isMetadataRefreshActive() || getLibraryScanOperation().status === 'running'
      || !isSafWriteStartupReady() || hasActiveSafWriteOperations()) {
      Alert.alert('Sammlung wird bearbeitet', 'Bitte warte auf den Abschluss des laufenden Scans oder der Metadatenbearbeitung.');
      return;
    }
    busyRef.current = true; setBusy(true);
    try { await operation(); }
    catch (error) { Alert.alert('Backup nicht abgeschlossen', error instanceof Error ? error.message : String(error)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const exportBackup = () => run(async () => {
    const uri = await writeBackupFile(await createMusicBackup());
    if (uri) Alert.alert('Backup gespeichert', 'Die Sicherung wurde geschrieben und anschließend vollständig geprüft.');
  });
  const selectBackup = (intent: 'inspect' | 'restore') => run(async () => {
    intentRef.current = intent;
    const selected = await chooseBackupFolder();
    if (selected === null) return;
    if (selected.length === 0) { Alert.alert('Ordner leer', 'In diesem Ordner wurde keine Datei gefunden.'); return; }
    setFiles(selected);
  });
  const openFile = (uri: string) => run(async () => {
    const [{ backup }, songs] = await Promise.all([readBackupFile(uri), storage.getSongs()]);
    setFiles(null); setPreview({ backup, songs, restore: intentRef.current === 'restore' });
  });
  const action = (id: string, label: string, callback: () => Promise<void>) => <Pressable testID={id}
    accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void callback()}
    style={[styles.action, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }]}>
    <Text style={text}>{label}</Text></Pressable>;
  return <View testID="settings-backup" style={styles.section}>
    <Text style={[styles.heading, { color: theme.palette.text.primary, fontFamily: theme.tokens.fonts.heading }]}>Sammlung & Daten</Text>
    <Text style={[styles.title, text]}>Backup & Wiederherstellung</Text>
    <Text style={text}>Sichere Playlists, Favoriten, Einstellungen und dein eigenes EQ-Profil. Wähle einen Backup-Ordner; Musikdateien werden nicht kopiert.</Text>
    {action('backup-create', 'Backup erstellen', exportBackup)}
    {action('backup-inspect', 'Backup-Inhalt prüfen', () => selectBackup('inspect'))}
    {action('backup-select-restore', 'Backup wiederherstellen', () => selectBackup('restore'))}
    {busy && <Text accessibilityLiveRegion="polite" style={text}>Backup wird geprüft …</Text>}
    {files && <Modal visible animationType="none" onRequestClose={() => setFiles(null)}>
      <View style={[styles.root, { backgroundColor: theme.palette.background }]}>
        <Text style={[styles.heading, text]}>Backupdatei auswählen</Text>
        <Text style={text}>Die Datei wird zuerst geprüft. Erst die folgende Vorschau kann Daten übernehmen.</Text>
        <FlatList data={files} keyExtractor={(uri, index) => `${index}:${uri}`} renderItem={({ item, index }) =>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void openFile(item)}
            style={styles.action}><Text style={text}>{backupFileLabel(item, index)}</Text></Pressable>} />
        <Pressable accessibilityRole="button" onPress={() => setFiles(null)} style={styles.action}><Text style={text}>Abbrechen</Text></Pressable>
      </View>
    </Modal>}
    {preview && <BackupPreview backup={preview.backup} songs={preview.songs} onRestore={preview.restore ? maintenance?.restore : undefined}
      onClose={() => setPreview(null)} />}
  </View>;
};
const styles = StyleSheet.create({
  section: { gap: 10 }, heading: { fontSize: 18 }, title: { fontSize: 16 }, root: { flex: 1, padding: 20, gap: 12 },
  action: { minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 12, justifyContent: 'center' },
});
export default BackupSettings;
