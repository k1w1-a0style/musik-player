import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { writePlaylistFile } from '../utils/playlistFiles';

const PlaylistFileExportButton = ({ name, songs, missingCount = 0 }: { name: string; songs: Song[]; missingCount?: number }) => {
  const { theme } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const exportFile = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const uri = await writePlaylistFile(name, songs);
      if (uri && mounted.current) Alert.alert('Playlist exportiert', 'Die M3U8-Datei wurde am gewählten Speicherziel gespeichert und geprüft. Lokale Dateiverweise benötigen auf anderen Geräten die passenden Dateien und Leseberechtigungen.');
    } catch {
      if (mounted.current) Alert.alert('Export fehlgeschlagen', 'Die Playlist konnte nicht vollständig gespeichert und geprüft werden. Bitte prüfe Speicherplatz und Zugriff auf den Zielordner.');
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const requestExport = () => {
    if (missingCount) Alert.alert('Fehlende Titel', `${missingCount} Titel fehlen in der Bibliothek und werden ausgelassen. Verfügbare Titel exportieren?`, [
      { text: 'Abbrechen', style: 'cancel' }, { text: 'Exportieren', onPress: () => { void exportFile(); } },
    ]);
    else void exportFile();
  };
  return <Pressable accessibilityRole="button" accessibilityLabel="Playlist als M3U8 exportieren"
    testID="playlist-file-export" disabled={busy || !songs.length} accessibilityState={{ disabled: busy || !songs.length, busy }}
    onPress={requestExport} style={[styles.button, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }]}>
    {busy && <ActivityIndicator color={theme.palette.primary} />}
    <Text style={{ color: theme.palette.text.primary }}>{busy ? 'Playlist wird gespeichert …' : 'Als M3U8 exportieren'}</Text>
  </Pressable>;
};
const styles = StyleSheet.create({ button: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' } });
export default PlaylistFileExportButton;
