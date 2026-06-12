import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import {
  formatBytes,
  formatCoverStatus,
  formatDuration,
  formatSampleRate,
  valueOrNA,
} from './trackInfoHelpers';
import TrackInfoRow from './TrackInfoRow';

interface TrackInfoSectionsProps {
  song: Song;
  coverUri?: string;
  coverStatus: string;
  importedAt: string;
}

const TrackInfoSections: React.FC<TrackInfoSectionsProps> = ({
  song,
  coverUri,
  coverStatus,
  importedAt,
}) => (
  <>
    <Text style={styles.section}>Basis</Text>
    <TrackInfoRow label="Titel" value={valueOrNA(song.title)} />
    <TrackInfoRow label="Künstler" value={valueOrNA(song.artist)} />
    <TrackInfoRow label="Album" value={valueOrNA(song.album)} />
    <TrackInfoRow label="Jahr" value={valueOrNA(song.year)} />
    <TrackInfoRow label="Genre" value={valueOrNA(song.genre)} />
    <TrackInfoRow label="Tracknummer" value={valueOrNA(song.trackNumber)} />
    <TrackInfoRow label="Discnummer" value={valueOrNA(song.discNumber)} />
    <TrackInfoRow label="Kommentar" value={valueOrNA(song.comment)} long />
    <TrackInfoRow label="Dauer" value={formatDuration(song.duration)} />

    <Text style={styles.section}>Datei</Text>
    <TrackInfoRow label="Dateiname" value={valueOrNA(song.fileInfo?.filename)} />
    <TrackInfoRow label="Dateiendung" value={valueOrNA(song.fileInfo?.extension)} />
    <TrackInfoRow label="Container" value={valueOrNA(song.fileInfo?.container)} />
    <TrackInfoRow label="MIME-Type" value={valueOrNA(song.fileInfo?.mimeType)} />
    <TrackInfoRow label="Dateigröße" value={formatBytes(song.fileInfo?.size)} />
    <TrackInfoRow label="Import-Quelle" value={valueOrNA(song.fileInfo?.source)} />
    <TrackInfoRow label="Import-Zeitpunkt" value={importedAt} />
    <TrackInfoRow label="Datei-Pfad / URI" value={valueOrNA(song.fileInfo?.uri ?? song.uri)} long />

    <Text style={styles.section}>Audio-Technik</Text>
    <TrackInfoRow label="Codec" value={valueOrNA(song.audioInfo?.codec)} />
    <TrackInfoRow label="Bitrate" value={song.audioInfo?.bitrate ? `${song.audioInfo.bitrate} kbps` : 'Nicht verfügbar'} />
    <TrackInfoRow label="Sample Rate" value={formatSampleRate(song.audioInfo?.sampleRate)} />
    <TrackInfoRow label="Kanäle" value={valueOrNA(song.audioInfo?.channels)} />

    <Text style={styles.section}>Cover</Text>
    <TrackInfoRow label="Cover vorhanden" value={coverUri ? 'Ja' : 'Nein'} />
    <TrackInfoRow label="Cover-Typ" value={formatCoverStatus(coverStatus)} />
    <TrackInfoRow label="Cover-URI" value={valueOrNA(coverUri)} long />
  </>
);

const styles = StyleSheet.create({
  section: { color: theme.palette.primary, fontFamily: theme.fonts.heading, marginTop: 8 },
});

export default TrackInfoSections;
