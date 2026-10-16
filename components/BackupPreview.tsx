import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Song } from '../types/Song';
import type { MusicBackup } from '../utils/backupFormat';
import { backupReferenceLabel, mapBackupSongs, type ManualBackupMapping } from '../utils/backupMapping';
import { backupLibrarySignature, type RestoreBackupRequest } from '../utils/backupService';
import BackupSongPicker from './BackupSongPicker';
import BackupSettingSummary from './BackupSettingSummary';

interface Props { backup: MusicBackup; songs: Song[]; onRestore?: (request: RestoreBackupRequest) => void; onClose: () => void }
const BackupPreview = ({ backup, songs, onRestore, onClose }: Props) => {
  const { theme } = useAppTheme();
  const [manual, setManual] = useState<ManualBackupMapping>({});
  const [applySettings, setApplySettings] = useState(false);
  const [mappingId, setMappingId] = useState<string | null>(null);
  const matches = useMemo(() => mapBackupSongs(backup, songs, manual), [backup, songs, manual]);
  const matched = matches.filter(match => match.status === 'mapped').length;
  const missing = matches.filter(match => match.status === 'missing').length;
  const conflicts = matches.filter(match => match.status === 'conflict').length;
  const text = { color: theme.palette.text.primary };
  const mapping = backup.songs.find(song => song.id === mappingId);
  return <Modal visible onRequestClose={onClose} animationType="none">
    <View testID="backup-preview" style={[styles.root, { backgroundColor: theme.palette.background }]}>
      <FlatList data={matches} keyExtractor={match => match.reference.id} contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.content}>
      <Text style={[styles.heading, text]}>Backup-Inhalt prüfen</Text>
      <Text style={text}>Format {backup.version} · {new Date(backup.createdAt).toLocaleString('de-DE')}</Text>
      <Text style={text}>{backup.playlists.length} Playlists · {backup.favorites.length} Favoriten · {backup.songs.length} referenzierte Titel</Text>
      <Text testID="backup-match-summary" style={text}>{matched} zugeordnet · {missing} fehlend/übersprungen · {conflicts} Konflikte</Text>
      <Text style={text}>Playlists werden als neue Listen ergänzt, Favoriten zusammengeführt. Nicht zugeordnete Titel werden übersprungen. Musikdateien sind nicht im Backup enthalten.</Text>
      <Text style={text}>Bei geändertem Ordner zuerst die Musik über die Bibliothek neu freigeben und scannen. Danach die Vorschau erneut öffnen.</Text>
      {onRestore && <View style={styles.settingsRow}>
        <Text style={[styles.settingsCopy, text]}>Einstellungen und eigenes EQ-Profil ebenfalls übernehmen ({Object.keys(backup.settings).length} Werte ersetzen)</Text>
        <Switch testID="backup-apply-settings" accessibilityLabel="Backup-Einstellungen übernehmen"
          value={applySettings} onValueChange={setApplySettings} />
      </View>}
      <BackupSettingSummary settings={backup.settings} />
      </View>}
        renderItem={({ item }) => <Pressable accessibilityRole="button" testID={`backup-reference-${item.reference.id}`}
          accessibilityLabel={`${backupReferenceLabel(item.reference)}, ${item.status === 'mapped' ? 'zugeordnet' : item.status === 'conflict' ? 'Konflikt' : 'fehlend oder übersprungen'}, Zuordnung ändern`}
          onPress={() => setMappingId(item.reference.id)} style={[styles.action, { borderColor: theme.palette.border }]}>
          <Text style={text}>{backupReferenceLabel(item.reference)}</Text>
          <Text style={[styles.source, { color: theme.palette.text.secondary }]}>{item.song ? `→ ${item.song.title} · ${item.song.fileInfo?.uri ?? item.song.uri ?? 'Quelle unbekannt'}`
            : item.status === 'conflict' ? 'Konflikt – manuell zuordnen oder überspringen' : 'Fehlt oder wird übersprungen – manuell zuordnen'}</Text>
        </Pressable>}
        ListFooterComponent={<View style={styles.content}>
      {onRestore ? <Pressable testID="backup-restore-apply" accessibilityRole="button"
        onPress={() => onRestore({ backup, manual, applySettings,
          previewSources: backupLibrarySignature(songs) })} style={[styles.action, { borderColor: theme.palette.primary }]}>
        <Text style={text}>Vorschau anwenden: {backup.playlists.length} Listen ergänzen</Text></Pressable>
        : <Text style={text}>Inhaltsprüfung: Es werden keine Daten übernommen. Zum Anwenden wähle in den Einstellungen „Backup wiederherstellen“.</Text>}
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}><Text style={text}>Schließen</Text></Pressable>
      </View>} />
    </View>
    {mapping && <BackupSongPicker referenceTitle={backupReferenceLabel(mapping)} songs={songs} onClose={() => setMappingId(null)}
      onChoose={id => { setManual(previous => ({ ...previous, [mapping.id]: id })); setMappingId(null); }} />}
  </Modal>;
};
const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 10 }, heading: { fontSize: 18 }, source: { fontSize: 12 },
  content: { gap: 10 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, settingsCopy: { flex: 1 },
  action: { minHeight: 48, borderWidth: 1, padding: 12, gap: 6 },
});
export default BackupPreview;
