import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
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
import TrackInfoActions from './TrackInfoActions';
import TrackInfoCover from './TrackInfoCover';
import { useTrackInfoScreenState } from './useTrackInfoScreenState';

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
          <TrackInfoCover
            coverUri={coverUri}
            coverFailed={coverFailed}
            onCoverError={() => setCoverFailed(true)}
          />

          <Text style={styles.header}>TrackInfo</Text>
          <TrackInfoActions
            onOpenTagEditor={openTagEditor}
            onRemoveFromLibrary={removeFromLibrary}
          />
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
  header: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 24, marginBottom: 4 },
  section: { color: theme.palette.primary, fontFamily: theme.fonts.heading, marginTop: 8 },
  row: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  longRow: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 16 },
});

export default TrackInfo;
