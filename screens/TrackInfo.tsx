import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Music2 } from 'lucide-react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

export const formatDuration = (ms?: number): string => {
  if (!ms || ms <= 0) return 'Nicht verfügbar';
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export const formatBytes = (value?: number): string => {
  if (!value || value <= 0) return 'Nicht verfügbar';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
};


export const formatSampleRate = (value?: number): string => {
  if (!value || value <= 0) return 'Nicht verfügbar';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kHz`;
  return `${value} Hz`;
};

export const formatCoverStatus = (status?: string): string => {
  switch (status) {
    case 'cached':
      return 'Gecachtes Cover';
    case 'embedded':
      return 'Eingebettetes Cover';
    case 'external':
      return 'Externe URI';
    case 'none':
      return 'Kein Cover';
    default:
      return 'Unbekannt';
  }
};

const valueOrNA = (value?: string | number): string => (value === undefined || value === null || value === '' ? 'Nicht verfügbar' : String(value));
type TrackInfoRoute = RouteProp<{ TrackInfo: { songId: string } }, 'TrackInfo'>;

const TrackInfo: React.FC = () => {
  const route = useRoute<TrackInfoRoute>();
  const { songs } = useLibraryMusicContext();
  const [coverFailed, setCoverFailed] = useState(false);

  const song = useMemo(() => songs.find(s => s.id === route.params.songId), [route.params.songId, songs]);

  useEffect(() => {
    setCoverFailed(false);
  }, [song?.id, song?.cover]);

  if (!song) return <AppBackground><Screen contentStyle={styles.container}><Text style={styles.error}>Song nicht gefunden.</Text></Screen></AppBackground>;

  const coverUri = song.coverInfo?.uri ?? song.cover;
  const coverStatus = song.coverInfo?.status ?? (coverUri ? 'unknown' : 'none');

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
          <Text style={styles.section}>Basis</Text>
          <Text style={styles.row}>Titel: {valueOrNA(song.title)}</Text>
          <Text style={styles.row}>Artist: {valueOrNA(song.artist)}</Text>
          <Text style={styles.row}>Album: {valueOrNA(song.album)}</Text>
          <Text style={styles.row}>Jahr: {valueOrNA(song.year)}</Text>
          <Text style={styles.row}>Genre: {valueOrNA(song.genre)}</Text>
          <Text style={styles.row}>Dauer: {formatDuration(song.duration)}</Text>

          <Text style={styles.section}>Datei</Text>
          <Text style={styles.row}>Dateiname: {valueOrNA(song.fileInfo?.filename)}</Text>
          <Text style={styles.row}>Dateiendung: {valueOrNA(song.fileInfo?.extension)}</Text>
          <Text style={styles.row}>Container: {valueOrNA(song.fileInfo?.container)}</Text>
          <Text style={styles.row}>MIME-Type: {valueOrNA(song.fileInfo?.mimeType)}</Text>
          <Text style={styles.row}>Dateigröße: {formatBytes(song.fileInfo?.size)}</Text>
          <Text style={styles.row}>Import-Quelle: {valueOrNA(song.fileInfo?.source)}</Text>
          <Text style={styles.row}>Import-Zeitpunkt: {song.fileInfo?.importedAt ? new Date(song.fileInfo.importedAt).toLocaleString('de-DE') : 'Nicht verfügbar'}</Text>
          <Text style={styles.longRow}>Datei-Pfad / URI: {valueOrNA(song.fileInfo?.uri ?? song.uri)}</Text>

          <Text style={styles.section}>Audio-Technik</Text>
          <Text style={styles.row}>Codec: {valueOrNA(song.audioInfo?.codec)}</Text>
          <Text style={styles.row}>Bitrate: {song.audioInfo?.bitrate ? `${song.audioInfo.bitrate} kbps` : 'Nicht verfügbar'}</Text>
          <Text style={styles.row}>Sample Rate: {formatSampleRate(song.audioInfo?.sampleRate)}</Text>
          <Text style={styles.row}>Kanäle: {valueOrNA(song.audioInfo?.channels)}</Text>

          <Text style={styles.section}>Cover</Text>
          <Text style={styles.row}>Cover vorhanden: {coverUri ? 'Ja' : 'Nein'}</Text>
          <Text style={styles.row}>Cover-Typ: {formatCoverStatus(coverStatus)}</Text>
          <Text style={styles.longRow}>Cover-URI: {valueOrNA(coverUri)}</Text>
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
  section: { color: theme.palette.primary, fontFamily: theme.fonts.heading, marginTop: 8 },
  row: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  longRow: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 16 },
});

export default TrackInfo;
