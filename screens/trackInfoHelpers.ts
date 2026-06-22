import type { BitrateMode, Song } from '../types/Song';

export const formatDuration = (ms?: number): string => {
  if (!ms || ms <= 0) return 'Nicht verfügbar';
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
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

export const formatChannels = (value?: number): string => {
  if (!value || value <= 0) return 'Nicht verfügbar';
  if (value === 1) return '1 Kanal (Mono)';
  if (value === 2) return '2 Kanäle (Stereo)';
  return `${value} Kanäle`;
};

export const formatBitrate = (value?: number): string =>
  value && value > 0 ? `${value} kbps` : 'Nicht verfügbar';

export const formatBitrateMode = (mode?: BitrateMode): string => {
  switch (mode) {
    case 'cbr':
      return 'CBR';
    case 'vbr':
      return 'VBR';
    case 'unknown':
      return 'Unbekannt';
    default:
      return 'Nicht verfügbar';
  }
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
      return 'Kein eingebettetes Cover gefunden';
    default:
      return 'Unbekannt';
  }
};

export const formatCoverDimensions = (width?: number, height?: number): string => {
  if (!width || !height || width <= 0 || height <= 0) return 'Nicht verfügbar';
  return `${width} × ${height} px`;
};

export const valueOrNA = (value?: string | number): string =>
  value === undefined || value === null || value === '' ? 'Nicht verfügbar' : String(value);

export const getTrackInfoCoverUri = (song: Song): string | undefined =>
  song.coverInfo?.uri ?? song.cover;

export const getTrackInfoCoverStatus = (song: Song, coverUri?: string): string =>
  song.coverInfo?.status ?? (coverUri ? 'unknown' : 'none');

export const getTrackInfoDurationMs = (song: Song): number | undefined =>
  song.duration ?? song.audioInfo?.durationMs;

export const formatImportedAt = (value?: string | number): string =>
  value ? new Date(value).toLocaleString('de-DE') : 'Nicht verfügbar';
