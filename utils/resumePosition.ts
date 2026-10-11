import { z } from 'zod';
import type { Song } from '../types/Song';
import { getSongSourceKey } from './songSourceIdentity';

export const RESUME_ENABLED_KEY = 'playbackResumeEnabled';
export const RESUME_POSITIONS_KEY = 'playbackResumePositionsV1';
export const RESUME_MIN_DURATION_MS = 20 * 60 * 1000;
export const RESUME_MIN_POSITION_MS = 15 * 1000;
export const RESUME_END_MARGIN_MS = 30 * 1000;
export const RESUME_MAX_ENTRIES = 200;
export const RESUME_MAX_CODE_UNITS = 1024 * 1024;
export const RESUME_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
export interface ResumeEntry {
  songId: string; source: string; positionMs: number; durationMs: number; updatedAt: number;
}
const entrySchema = z.object({ songId: z.string().min(1).max(512), source: z.string().min(1).max(8192),
  positionMs: z.number().finite().nonnegative(), durationMs: z.number().finite().positive(),
  updatedAt: z.number().finite().nonnegative() }).strict();
const storeSchema = z.object({ version: z.literal(1), entries: z.array(entrySchema).max(RESUME_MAX_ENTRIES) }).strict();
export const getResumeSource = (song: Song): string | null => {
  const uri = getSongSourceKey(song.fileInfo?.uri ?? song.uri);
  const size = song.fileInfo?.size;
  const time = song.fileInfo?.modificationTime;
  const hash = /^[a-f0-9]{64}$/i.test(song.fileInfo?.contentHash ?? '') ? song.fileInfo!.contentHash!.toLowerCase() : undefined;
  const dated = Number.isSafeInteger(size) && size! > 0 && Number.isFinite(time) && time! > 0;
  if (!song.id.trim() || !uri || (!hash && !dated)) return null;
  const source = JSON.stringify([song.id, uri, hash ? ['sha256', hash] : ['size-time', size, time]]);
  return song.id.length <= 512 && source.length <= 8192 ? source : null;
};
export const isUsefulResumePosition = (positionMs: number, durationMs: number): boolean =>
  Number.isFinite(positionMs) && Number.isFinite(durationMs) && durationMs >= RESUME_MIN_DURATION_MS
  && positionMs >= RESUME_MIN_POSITION_MS && positionMs < durationMs - RESUME_END_MARGIN_MS;
export const pruneResumeEntries = (entries: ResumeEntry[], now: number): ResumeEntry[] => {
  const latest = new Map<string, ResumeEntry>();
  for (const entry of entries) {
    if (!isUsefulResumePosition(entry.positionMs, entry.durationMs) || now - entry.updatedAt > RESUME_MAX_AGE_MS
      || entry.updatedAt > now + 60_000) continue;
    const previous = latest.get(entry.source);
    if (!previous || previous.updatedAt < entry.updatedAt) latest.set(entry.source, entry);
  }
  return [...latest.values()].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, RESUME_MAX_ENTRIES);
};
export const parseResumePositions = (raw: string | null, now = Date.now()): ResumeEntry[] => {
  if (raw === null) return [];
  if (raw.length > RESUME_MAX_CODE_UNITS) throw new Error('Resume positions exceed the safe read budget.');
  return pruneResumeEntries(storeSchema.parse(JSON.parse(raw)).entries, now);
};
export const serializeResumePositions = (entries: ResumeEntry[]): string => {
  const raw = JSON.stringify(storeSchema.parse({ version: 1, entries }));
  if (raw.length > RESUME_MAX_CODE_UNITS) throw new Error('Resume positions exceed the safe write budget.');
  return raw;
};
export const findResumeEntry = (song: Song, entries: ResumeEntry[], now = Date.now()): ResumeEntry | undefined => {
  const source = getResumeSource(song);
  if (!source) return undefined;
  const entry = pruneResumeEntries(entries, now).find(item => item.songId === song.id && item.source === source);
  if (!entry) return undefined;
  const reportedDuration = song.duration ?? song.audioInfo?.durationMs;
  if (reportedDuration && (reportedDuration < RESUME_MIN_DURATION_MS || Math.abs(reportedDuration - entry.durationMs) > 2000)) return undefined;
  return entry;
};
