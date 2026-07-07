import type { Song } from '../types/Song';
import { normalizeMetadataText } from './musicParser';

const MIME_FORMAT_LABELS: Record<string, string> = {
  'audio/aac': 'AAC',
  'audio/flac': 'FLAC',
  'audio/mp4': 'M4A',
  'audio/mpeg': 'MP3',
  'audio/ogg': 'OGG',
  'audio/wav': 'WAV',
};

const normalizeShortToken = (value?: string): string | null => {
  const normalized = normalizeMetadataText(value)?.replace(/^\.+/, '').trim();
  if (!normalized || normalized.length > 8) return null;
  return normalized.toUpperCase();
};

const getMimeFormatLabel = (value?: string): string | null => {
  const normalized = normalizeMetadataText(value)?.toLocaleLowerCase('de-DE');
  if (!normalized) return null;
  if (MIME_FORMAT_LABELS[normalized]) return MIME_FORMAT_LABELS[normalized];
  if (!normalized.startsWith('audio/')) return null;
  return normalizeShortToken(normalized.split('/').pop());
};

export const getSongCardFormatLabel = (song: Pick<Song, 'audioInfo' | 'fileInfo'>): string | null =>
  normalizeShortToken(song.fileInfo?.extension)
  ?? normalizeShortToken(song.fileInfo?.container)
  ?? getMimeFormatLabel(song.fileInfo?.mimeType)
  ?? getMimeFormatLabel(song.audioInfo?.codec)
  ?? normalizeShortToken(song.audioInfo?.codec);

export const formatSongCardDuration = (durationMs?: number): string | null => {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const totalSeconds = Math.floor(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const getSongCardDurationMs = (song: Pick<Song, 'audioInfo' | 'duration'>): number | undefined =>
  typeof song.duration === 'number' && Number.isFinite(song.duration) && song.duration > 0
    ? song.duration
    : song.audioInfo?.durationMs;

export const getSongCardMetadataLabel = (song: Pick<Song, 'audioInfo' | 'duration' | 'fileInfo'>): string | null => {
  const parts = [
    formatSongCardDuration(getSongCardDurationMs(song)),
    getSongCardFormatLabel(song),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' • ') : null;
};
