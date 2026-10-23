import React, { useContext } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LibraryMusicContext } from '../contexts/musicContexts';
import { useAppTheme } from '../contexts/AppThemeContext';
import { usePlaylistFileImport } from '../hooks/usePlaylistFileImport';
import type { M3uUnresolved } from '../utils/m3uPlaylist';

const reasons: Record<M3uUnresolved['reason'], string> = {
  missing: 'Nicht in der Bibliothek', ambiguous: 'Nicht eindeutig zuordenbar', relative: 'Relativer Pfad ohne zugänglichen Basisordner',
  unsupported: 'Keine unterstützte lokale Quelle', unreadable: 'Datei fehlt oder Leseberechtigung entzogen',
};
const EMPTY_SONGS: never[] = [];

const PlaylistFileImportButton = () => {
  const context = useContext(LibraryMusicContext);
  const { theme } = useAppTheme();
  const transfer = usePlaylistFileImport(context?.songs ?? EMPTY_SONGS, context?.saveQueueAsPlaylist);
  const buttonStyle = [styles.button, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }];
  const textStyle = { color: theme.palette.text.primary };
  const visible = Boolean(transfer.preview || transfer.busy || transfer.error);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="M3U oder M3U8 importieren" testID="playlist-file-import"
      disabled={!context?.saveQueueAsPlaylist || transfer.busy} onPress={() => { void transfer.pick(); }} style={buttonStyle}>
      <Text style={textStyle}>M3U / M3U8 importieren</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={transfer.cancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.palette.background }]} accessibilityViewIsModal>
          <FlatList testID="playlist-import-unresolved" data={transfer.preview?.unresolved ?? []}
            style={{ flexGrow: 0, flexShrink: 1 }}
            keyExtractor={(_entry, index) => String(index)} initialNumToRender={10} windowSize={5}
            ListHeaderComponent={<View style={styles.copy}>
          <Text accessibilityRole="header" style={[textStyle, styles.title]}>Playlist importieren</Text>
          {transfer.busy && <ActivityIndicator color={theme.palette.primary} />}
          <Text style={textStyle} accessibilityLiveRegion="polite">{transfer.progress || transfer.preview?.name}</Text>
          {!!transfer.error && <Text style={textStyle} accessibilityLiveRegion="polite">{transfer.error}</Text>}
          {transfer.preview && <>
            <Text style={textStyle}>{transfer.preview.songs.length} lokale Titel · {transfer.preview.unresolved.length} nicht zugeordnet · {transfer.preview.duplicates} doppelte Einträge ausgelassen</Text>
            <Text style={textStyle}>Nur bekannte lokale Titel werden übernommen. Originaldateien bleiben unverändert. Danach kannst du die Playlist bearbeiten und sortieren.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Lokale Titel als Playlist übernehmen"
              testID="playlist-import-confirm" disabled={transfer.busy || !transfer.preview.songs.length}
              accessibilityState={{ disabled: transfer.busy || !transfer.preview.songs.length }}
              onPress={() => { void transfer.confirm(); }} style={buttonStyle}>
              <Text style={textStyle}>Lokale Titel übernehmen</Text>
            </Pressable>
          </>}
          </View>}
          renderItem={({ item }) => <Text style={[textStyle, styles.issue]}>
            {item.line > 0 ? `Zeile ${item.line}: ` : ''}{item.label || item.location}{'\n'}{reasons[item.reason]}
          </Text>}
          ListFooterComponent={
          <Pressable accessibilityRole="button" accessibilityLabel="Playlist-Import abbrechen" onPress={transfer.cancel} style={buttonStyle}>
            <Text style={textStyle}>Abbrechen</Text>
          </Pressable>
          } />
        </View>
      </View>
    </Modal>
  </>;
};
const styles = StyleSheet.create({
  button: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 16 },
  card: { maxHeight: '90%', flexShrink: 1, padding: 16, borderRadius: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  issue: { paddingVertical: 8 },
  copy: { gap: 12 },
});
export default PlaylistFileImportButton;
