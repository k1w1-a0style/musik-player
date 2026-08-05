import SystemAudio, { type AudioInfoResult } from 'expo-system-audio';
import type { Song, SongAudioInfo, SongFileInfo } from '../types/Song';
import { runNativeReadWithTimeout } from './nativeReadTimeout';

export interface AudioInfoBackfillOptions {
  concurrency?: number;
  batchSize?: number;
  signal?: AbortSignal;
  nativeReadTimeoutMs?: number;
  shouldProcessSong?: (song: Song, index: number) => boolean;
  onSongProcessed?: (song: Song, index: number) => void;
}

export interface AudioInfoBackfillResult {
  songs: Song[];
  attempted: number;
  updated: number;
  aborted: boolean;
}

const DEFAULT_AUDIO_INFO_BACKFILL_CONCURRENCY = 2;
const DEFAULT_AUDIO_INFO_BACKFILL_BATCH_SIZE = 8;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const preferPositiveNumber = (current: unknown, incoming: unknown): number | undefined => {
  if (isPositiveFiniteNumber(current)) return current;
  if (isPositiveFiniteNumber(incoming)) return incoming;
  return undefined;
};

const resolveAudioInfoUri = (song: Song): string | undefined => song.fileInfo?.uri ?? song.uri;

const isNativeAudioInfoUri = (uri?: string): uri is string =>
  Boolean(uri && (uri.startsWith('file://') || uri.startsWith('content://')));

const bitrateKbpsFromNative = (bitrateBps?: number): number | undefined =>
  isPositiveFiniteNumber(bitrateBps) ? Math.round(bitrateBps / 1000) : undefined;

const hasUsableAudioDuration = (song: Song): boolean =>
  isPositiveFiniteNumber(song.duration) || isPositiveFiniteNumber(song.audioInfo?.durationMs);

const hasUsableAudioInfo = (song: Song): boolean =>
  hasUsableAudioDuration(song)
  && isPositiveFiniteNumber(song.audioInfo?.bitrate)
  && isPositiveFiniteNumber(song.audioInfo?.sampleRate)
  && isPositiveFiniteNumber(song.audioInfo?.channels)
  && isPositiveFiniteNumber(song.fileInfo?.size);

export const needsAudioInfoBackfill = (song: Song): boolean => {
  const uri = resolveAudioInfoUri(song);
  if (!isNativeAudioInfoUri(uri)) return false;
  return !hasUsableAudioInfo(song);
};

export const buildAudioInfoBackfillAttemptKey = (song: Song): string =>
  [
    song.id,
    resolveAudioInfoUri(song) ?? '',
    song.duration ?? '',
    song.fileInfo?.size ?? '',
    song.fileInfo?.mimeType ?? '',
    song.audioInfo?.codec ?? '',
    song.audioInfo?.durationMs ?? '',
    song.audioInfo?.bitrate ?? '',
    song.audioInfo?.bitrateMode ?? '',
    song.audioInfo?.sampleRate ?? '',
    song.audioInfo?.channels ?? '',
  ].join('|');

const shallowEqualSongAudioInfo = (left?: SongAudioInfo, right?: SongAudioInfo): boolean =>
  left?.codec === right?.codec
  && left?.durationMs === right?.durationMs
  && left?.bitrate === right?.bitrate
  && left?.bitrateMode === right?.bitrateMode
  && left?.sampleRate === right?.sampleRate
  && left?.channels === right?.channels;

const shallowEqualSongFileInfo = (left?: SongFileInfo, right?: SongFileInfo): boolean =>
  left?.filename === right?.filename
  && left?.uri === right?.uri
  && left?.extension === right?.extension
  && left?.container === right?.container
  && left?.mimeType === right?.mimeType
  && left?.size === right?.size
  && left?.source === right?.source
  && left?.importedAt === right?.importedAt;

const mergeMissingFileInfo = (
  current: SongFileInfo | undefined,
  incoming: AudioInfoResult,
): SongFileInfo => {
  const next: SongFileInfo = { ...(current ?? {}) };
  if (!next.filename && incoming.displayName) next.filename = incoming.displayName;
  if (!next.mimeType && incoming.mimeType) next.mimeType = incoming.mimeType;
  if (!isPositiveFiniteNumber(next.size) && isPositiveFiniteNumber(incoming.sizeBytes)) {
    next.size = incoming.sizeBytes;
  }
  return next;
};

const mergeMissingSongAudioInfo = (
  current: SongAudioInfo | undefined,
  incoming: AudioInfoResult,
): SongAudioInfo => {
  const next: SongAudioInfo = { ...(current ?? {}) };
  if (!next.codec && incoming.mimeType) next.codec = incoming.mimeType;
  if (!isPositiveFiniteNumber(next.durationMs) && isPositiveFiniteNumber(incoming.durationMs)) {
    next.durationMs = incoming.durationMs;
  }
  const incomingBitrate = bitrateKbpsFromNative(incoming.bitrateBps);
  if (!isPositiveFiniteNumber(next.bitrate) && incomingBitrate) next.bitrate = incomingBitrate;
  if (incomingBitrate && !next.bitrateMode) next.bitrateMode = incoming.bitrateMode ?? 'unknown';
  if (!isPositiveFiniteNumber(next.sampleRate) && isPositiveFiniteNumber(incoming.sampleRateHz)) {
    next.sampleRate = incoming.sampleRateHz;
  }
  if (!isPositiveFiniteNumber(next.channels) && isPositiveFiniteNumber(incoming.channels)) {
    next.channels = incoming.channels;
  }
  return next;
};

export const mergeNativeAudioInfoIntoSong = (
  song: Song,
  audioInfo: AudioInfoResult | null,
): Song => {
  if (!audioInfo) return song;

  const nextDuration = preferPositiveNumber(song.duration, audioInfo.durationMs);
  const nextFileInfo = mergeMissingFileInfo(song.fileInfo, audioInfo);
  const nextAudioInfo = mergeMissingSongAudioInfo(song.audioInfo, audioInfo);
  const durationChanged = nextDuration !== song.duration;
  const fileInfoChanged = !shallowEqualSongFileInfo(song.fileInfo, nextFileInfo);
  const audioInfoChanged = !shallowEqualSongAudioInfo(song.audioInfo, nextAudioInfo);
  if (!durationChanged && !fileInfoChanged && !audioInfoChanged) return song;

  return {
    ...song,
    ...(durationChanged ? { duration: nextDuration } : {}),
    ...(fileInfoChanged ? { fileInfo: nextFileInfo } : {}),
    ...(audioInfoChanged ? { audioInfo: nextAudioInfo } : {}),
  };
};

const readNativeAudioInfo = async (
  song: Song,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<{ audioInfo: AudioInfoResult | null; timedOut: boolean }> => {
  const uri = resolveAudioInfoUri(song);
  if (!isNativeAudioInfoUri(uri)) return { audioInfo: null, timedOut: false };
  const outcome = await runNativeReadWithTimeout(
    () => SystemAudio.extractAudioInfo(uri),
    { timeoutMs, signal, label: 'Native audio-info extraction' },
  );
  if (outcome.kind === 'success') return { audioInfo: outcome.value, timedOut: false };
  return { audioInfo: null, timedOut: outcome.kind === 'timeout' };
};

const abortError = (): DOMException => {
  try {
    return new DOMException('AudioInfo backfill aborted.', 'AbortError');
  } catch {
    const error = new Error('AudioInfo backfill aborted.');
    error.name = 'AbortError';
    return error as DOMException;
  }
};

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw abortError();
};

export const backfillExistingSongAudioInfo = async (
  songs: Song[],
  options: AudioInfoBackfillOptions = {},
): Promise<AudioInfoBackfillResult> => {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_AUDIO_INFO_BACKFILL_CONCURRENCY));
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? DEFAULT_AUDIO_INFO_BACKFILL_BATCH_SIZE));
  const candidates = songs
    .map((song, index) => ({ song, index }))
    .filter(({ song, index }) => needsAudioInfoBackfill(song) && (options.shouldProcessSong?.(song, index) ?? true));

  const nextSongs = songs.slice();
  let cursor = 0;
  let attempted = 0;
  let updated = 0;
  let aborted = false;

  const worker = async (): Promise<void> => {
    while (cursor < candidates.length) {
      throwIfAborted(options.signal);
      const current = candidates[cursor];
      cursor += 1;
      if (!current) continue;

      attempted += 1;
      const nativeRead = await readNativeAudioInfo(
        current.song,
        options.nativeReadTimeoutMs,
        options.signal,
      );
      throwIfAborted(options.signal);

      const patched = mergeNativeAudioInfoIntoSong(current.song, nativeRead.audioInfo);
      if (patched !== current.song) {
        nextSongs[current.index] = patched;
        updated += 1;
        options.onSongProcessed?.(patched, current.index);
      }

      if (attempted % batchSize === 0) await Promise.resolve();
      // The timed-out native call may still be running. Retire this worker so
      // detached calls can never exceed the configured concurrency.
      if (nativeRead.timedOut) return;
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()));
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      aborted = true;
    } else {
      throw error;
    }
  }

  return { songs: nextSongs, attempted, updated, aborted };
};
