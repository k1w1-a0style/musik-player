import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';

interface Props { referenceTitle: string; songs: Song[]; onChoose: (id: string | null) => void; onClose: () => void }
const BackupSongPicker = ({ referenceTitle, songs, onChoose, onClose }: Props) => {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase('de').trim();
    return query ? songs.filter(song => `${song.title} ${song.artist} ${song.fileInfo?.uri ?? song.uri ?? ''}`
      .toLocaleLowerCase('de').includes(query)) : songs;
  }, [search, songs]);
  const text = { color: theme.palette.text.primary };
  return <Modal visible onRequestClose={onClose} animationType="none">
    <View style={[styles.root, { backgroundColor: theme.palette.background }]}>
      <FlatList data={filtered} keyExtractor={song => song.id} keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.content}>
      <Text style={[styles.title, text]}>Zuordnen: {referenceTitle}</Text>
      <Text style={text}>Wähle bewusst die passende Datei. Gleiche Titel können unterschiedliche Dateien sein.</Text>
      <TextInput testID="backup-song-search" accessibilityLabel="Musikdateien durchsuchen" value={search}
        onChangeText={setSearch} placeholder="Titel, Künstler oder Quelle suchen" placeholderTextColor={theme.palette.text.muted}
        style={[styles.search, text, { borderColor: theme.palette.border }]} />
      <Pressable testID="backup-song-skip" accessibilityRole="button" onPress={() => onChoose(null)} style={styles.action}>
        <Text style={text}>Diesen Titel überspringen</Text></Pressable>
      </View>}
        renderItem={({ item }) => <Pressable testID={`backup-map-song-${item.id}`} accessibilityRole="button"
          accessibilityLabel={`${item.title} von ${item.artist}, ${item.fileInfo?.uri ?? item.uri ?? 'Quelle unbekannt'}`}
          onPress={() => onChoose(item.id)} style={[styles.action, { borderBottomColor: theme.palette.border }]}>
          <Text style={text}>{item.title} · {item.artist}</Text>
          <Text style={[styles.source, { color: theme.palette.text.secondary }]}>{item.fileInfo?.uri ?? item.uri ?? 'Quelle unbekannt'}</Text>
        </Pressable>} ListFooterComponent={<Pressable accessibilityRole="button" onPress={onClose} style={styles.action}>
          <Text style={text}>Abbrechen</Text></Pressable>} />
    </View>
  </Modal>;
};
const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 10 }, title: { fontSize: 18 }, source: { fontSize: 12 },
  content: { gap: 10 },
  search: { minHeight: 48, borderWidth: 1, padding: 10 }, action: { minHeight: 48, paddingVertical: 12, gap: 5, borderBottomWidth: 1 },
});
export default BackupSongPicker;
