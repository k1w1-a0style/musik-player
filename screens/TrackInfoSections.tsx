import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import {
  formatBitrate,
  formatBitrateMode,
  formatBytes,
  formatChannels,
  formatCoverDimensions,
  formatCoverStatus,
  formatDuration,
  formatSampleRate,
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

const hasTagValue = (value?: string | number): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  return Boolean(value?.trim());
};

const OptionalTagRow = ({ label, value, long = false }: { label: string; value?: string | number; long?: boolean }) => (
  hasTagValue(value) ? <TrackInfoRow label={label} value={valueOrNA(value)} long={long} /> : null
);

const TrackInfoSections: React.FC<TrackInfoSectionsProps> = ({
  song,
  coverUri,
  coverStatus,
  coverDimensions,
  importedAt,
}) => {
  const { theme } = useAppTheme();
  const coverWidth = coverDimensions?.width ?? song.coverInfo?.width;
  const coverHeight = coverDimensions?.height ?? song.coverInfo?.height;
  const sectionStyle = [styles.section, { color: theme.palette.text.secondary }];

  return (
    <>
      <Text style={sectionStyle}>Basis</Text>
      <TrackInfoRow label="Titel" value={getTrackInfoTitle(song)} />
      <TrackInfoRow label="Künstler" value={valueOrNA(song.artist)} />
      <OptionalTagRow label="Album" value={song.album} />
      <OptionalTagRow label="Album-Künstler" value={song.albumArtist} />
      <OptionalTagRow label="Jahr" value={song.year} />
      <OptionalTagRow label="Genre" value={song.genre} />
      <OptionalTagRow label="Tracknummer" value={song.trackNumber} />
      <OptionalTagRow label="Discnummer" value={song.discNumber} />
      <OptionalTagRow label="Kommentar" value={song.comment} long />
      <TrackInfoRow label="Dauer" value={formatDuration(getTrackInfoDurationMs(song))} />

      <Text style={sectionStyle}>Datei</Text>
      <TrackInfoRow label="Dateiname" value={getTrackInfoFilename(song)} />
      <TrackInfoRow label="Dateiendung" value={valueOrNA(song.fileInfo?.extension)} />
      <TrackInfoRow label="Container" value={getTrackInfoContainer(song)} />
      <TrackInfoRow label="MIME-Type" value={getTrackInfoMimeType(song)} />
      <TrackInfoRow label="Dateigröße" value={formatBytes(song.fileInfo?.size)} />
      <TrackInfoRow label="Import-Quelle" value={valueOrNA(song.fileInfo?.source)} />
      <TrackInfoRow label="Import-Zeitpunkt" value={importedAt} />
      <TrackInfoRow label="Datei-Pfad / URI" value={valueOrNA(song.fileInfo?.uri ?? song.uri)} long />

      <Text style={sectionStyle}>Audio-Technik</Text>
      <TrackInfoRow label="Codec" value={getTrackInfoCodec(song)} />
      <TrackInfoRow label="Bitrate" value={formatBitrate(song.audioInfo?.bitrate)} />
      <TrackInfoRow label="Bitrate-Modus" value={formatBitrateMode(song.audioInfo?.bitrateMode)} />
      <TrackInfoRow label="Sample Rate" value={formatSampleRate(song.audioInfo?.sampleRate)} />
      <TrackInfoRow label="Kanäle" value={formatChannels(song.audioInfo?.channels)} />

      <Text style={sectionStyle}>Cover</Text>
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
  section: { fontFamily: APP_THEME_TOKENS.fonts.heading, marginTop: 8, letterSpacing: 0.2 },
});

export default TrackInfoSections;
