import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import {
  formatBitrate,
  formatBitrateMode,
  formatBytes,
  formatChannels,
  formatCoverDimensions,
  formatCoverStatus,
  formatDuration,
  formatSampleRate,
  getTrackInfoAlbum,
  getTrackInfoAlbumArtist,
  getTrackInfoArtist,
  getTrackInfoCodec,
  getTrackInfoContainer,
  getTrackInfoDurationMs,
  getTrackInfoFilename,
  getTrackInfoMimeType,
  getTrackInfoTitle,
  valueOrNA,
} from './trackInfoHelpers';
import TrackInfoRow from './TrackInfoRow';
import type { TrackInfoCoverDimensions } from './useTrackInfoCoverState';

interface TrackInfoSectionsProps {
  song: Song;
  coverUri?: string;
  coverStatus: string;
  coverDimensions?: TrackInfoCoverDimensions;
  importedAt: string;
}

const TrackInfoSections: React.FC<TrackInfoSectionsProps> = ({
  song,
  coverUri,
  coverStatus,
  coverDimensions,
  importedAt,
}) => {
  const coverWidth = coverDimensions?.width ?? song.coverInfo?.width;
  const coverHeight = coverDimensions?.height ?? song.coverInfo?.height;

  return (
    <>
      <Text style={styles.section}>Basis</Text>
      <TrackInfoRow label="Titel" value={getTrackInfoTitle(song)} />
      <TrackInfoRow label="Künstler" value={getTrackInfoArtist(song)} />
      <TrackInfoRow label="Album" value={getTrackInfoAlbum(song)} />
      <TrackInfoRow label="Album-Künstler" value={getTrackInfoAlbumArtist(song)} />
      <TrackInfoRow label="Jahr" value={valueOrNA(song.year)} />
      <TrackInfoRow label="Genre" value={valueOrNA(song.genre)} />
      <TrackInfoRow label="Tracknummer" value={valueOrNA(song.trackNumber)} />
      <TrackInfoRow label="Discnummer" value={valueOrNA(song.discNumber)} />
      <TrackInfoRow label="Kommentar" value={valueOrNA(song.comment)} long />
      <TrackInfoRow label="Dauer" value={formatDuration(getTrackInfoDurationMs(song))} />

      <Text style={styles.section}>Datei</Text>
      <TrackInfoRow label="Dateiname" value={getTrackInfoFilename(song)} />
      <TrackInfoRow label="Dateiendung" value={valueOrNA(song.fileInfo?.extension)} />
      <TrackInfoRow label="Container" value={getTrackInfoContainer(song)} />
      <TrackInfoRow label="MIME-Type" value={getTrackInfoMimeType(song)} />
      <TrackInfoRow label="Dateigröße" value={formatBytes(song.fileInfo?.size)} />
      <TrackInfoRow label="Import-Quelle" value={valueOrNA(song.fileInfo?.source)} />
      <TrackInfoRow label="Import-Zeitpunkt" value={importedAt} />
      <TrackInfoRow label="Datei-Pfad / URI" value={valueOrNA(song.fileInfo?.uri ?? song.uri)} long />

      <Text style={styles.section}>Audio-Technik</Text>
      <TrackInfoRow label="Codec" value={getTrackInfoCodec(song)} />
      <TrackInfoRow label="Bitrate" value={formatBitrate(song.audioInfo?.bitrate)} />
      <TrackInfoRow label="Bitrate-Modus" value={formatBitrateMode(song.audioInfo?.bitrateMode)} />
      <TrackInfoRow label="Sample Rate" value={formatSampleRate(song.audioInfo?.sampleRate)} />
      <TrackInfoRow label="Kanäle" value={formatChannels(song.audioInfo?.channels)} />

      <Text style={styles.section}>Cover</Text>
      <TrackInfoRow label="Cover vorhanden" value={coverUri ? 'Ja' : 'Nein'} />
      <TrackInfoRow label="Cover-Typ" value={formatCoverStatus(coverStatus)} />
      <TrackInfoRow label="Cover-MIME-Type" value={valueOrNA(song.coverInfo?.mimeType)} />
      <TrackInfoRow label="Cover-Dateigröße" value={formatBytes(song.coverInfo?.byteLength)} />
      <TrackInfoRow label="Cover-Abmessungen" value={formatCoverDimensions(coverWidth, coverHeight)} />
      <TrackInfoRow label="Cover-URI" value={valueOrNA(coverUri)} long />
    </>
  );
};

const styles = StyleSheet.create({
  section: { color: theme.palette.primary, fontFamily: theme.fonts.heading, marginTop: 8 },
});

export default TrackInfoSections;
