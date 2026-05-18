import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Music2 } from 'lucide-react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import {
  formatBytes,
  formatCoverStatus,
  formatDuration,
  formatSampleRate,
  valueOrNA,
} from './trackInfoHelpers';
import { useTrackInfoScreenState } from './useTrackInfoScreenState';

const dangerColor = theme.palette.error;

const InfoRow: React.FC<{ label: string; value: string; long?: boolean }> = ({ label, value, long = false }) => (
  <Text style={long ? styles.longRow : styles.row}>{label}: {value}</Text>
);

const TrackInfo: React.FC = () => {
  const {
    song,
    coverUri,
    coverStatus,
    importedAt,
    coverFailed,
    setCoverFailed,
    openTagEditor,
    removeFromLibrary,
  } = useTrackInfoScreenState();

  if (!song) {
    return (
      <AppBackground>
        <Screen contentStyle={styles.container}>
          <Text style={styles.error}>Song nicht gefunden.</Text>
        </Screen>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Screen contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.coverWrap}>
            {coverUri && !coverFailed ? (
              <Image source={{ uri: coverUri }} style={styles.cover} onError={() => setCoverFailed(true)} />
            ) : (
              <Music2 color={theme.palette.text.muted} size={42} />
            )}
          </View>

          <Text style={styles.header}>TrackInfo</Text>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" style={styles.editButton} onPress={openTagEditor}>
              <Text style={styles.editButtonText}>ID3/M4A Tags bearbeiten</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Track aus Bibliothek entfernen" style={styles.removeButton} onPress={removeFromLibrary}>
              <Text style={styles.removeButtonText}>Aus Bibliothek entfernen</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Hinweis: Entfernen löscht nicht die Datei vom Gerät.</Text>
          <Text style={styles.section}>Basis</Text>
          <InfoRow label="Titel" value={valueOrNA(song.title)} />
          <InfoRow label="Artist" value={valueOrNA(song.artist)} />
          <InfoRow label="Album" value={valueOrNA(song.album)} />
          <InfoRow label="Jahr" value={valueOrNA(song.year)} />
          <InfoRow label="Genre" value={valueOrNA(song.genre)} />
          <InfoRow label="Tracknummer" value={valueOrNA(song.trackNumber)} />
          <InfoRow label="Discnummer" value={valueOrNA(song.discNumber)} />
          <InfoRow label="Kommentar" value={valueOrNA(song.comment)} long />
          <InfoRow label="Dauer" value={formatDuration(song.duration)} />

          <Text style={styles.section}>Datei</Text>
          <InfoRow label="Dateiname" value={valueOrNA(song.fileInfo?.filename)} />
          <InfoRow label="Dateiendung" value={valueOrNA(song.fileInfo?.extension)} />
          <InfoRow label="Container" value={valueOrNA(song.fileInfo?.container)} />
          <InfoRow label="MIME-Type" value={valueOrNA(song.fileInfo?.mimeType)} />
          <InfoRow label="Dateigröße" value={formatBytes(song.fileInfo?.size)} />
          <InfoRow label="Import-Quelle" value={valueOrNA(song.fileInfo?.source)} />
          <InfoRow label="Import-Zeitpunkt" value={importedAt} />
          <InfoRow label="Datei-Pfad / URI" value={valueOrNA(song.fileInfo?.uri ?? song.uri)} long />

          <Text style={styles.section}>Audio-Technik</Text>
          <InfoRow label="Codec" value={valueOrNA(song.audioInfo?.codec)} />
          <InfoRow label="Bitrate" value={song.audioInfo?.bitrate ? `${song.audioInfo.bitrate} kbps` : 'Nicht verfügbar'} />
          <InfoRow label="Sample Rate" value={formatSampleRate(song.audioInfo?.sampleRate)} />
          <InfoRow label="Kanäle" value={valueOrNA(song.audioInfo?.channels)} />

          <Text style={styles.section}>Cover</Text>
          <InfoRow label="Cover vorhanden" value={coverUri ? 'Ja' : 'Nein'} />
          <InfoRow label="Cover-Typ" value={formatCoverStatus(coverStatus)} />
          <InfoRow label="Cover-URI" value={valueOrNA(coverUri)} long />
        </ScrollView>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: 120, gap: 6 },
  coverWrap: {
    width: 130,
    height: 130,
    borderRadius: 16,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.palette.surfaceElevated,
    marginBottom: 8,
  },
  cover: { width: '100%', height: '100%' },
  header: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 24, marginBottom: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  section: { color: theme.palette.primary, fontFamily: theme.fonts.heading, marginTop: 8 },
  editButton: { backgroundColor: theme.palette.primary, borderRadius: theme.radii.input, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  editButtonText: { color: theme.palette.text.onPrimary, fontFamily: theme.fonts.heading, fontSize: 13 },
  removeButton: { borderRadius: theme.radii.input, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: dangerColor },
  removeButtonText: { color: dangerColor, fontFamily: theme.fonts.heading, fontSize: 13 },
  hint: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12, marginBottom: 4 },
  row: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  longRow: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 16 },
});

export default TrackInfo;
