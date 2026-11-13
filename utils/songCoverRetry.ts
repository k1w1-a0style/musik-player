import type { Song } from '../types/Song';

const RETRY_DELAYS_MS = [60 * 60_000, 24 * 60 * 60_000] as const;
const MAX_AUTOMATIC_FAILURES = 3;

export const coverSourceRevision = (song: Song): string => JSON.stringify([
  song.uri ?? '', song.fileInfo?.uri ?? '', song.fileInfo?.size ?? null,
  song.fileInfo?.modificationTime ?? null, song.fileInfo?.contentHash ?? '',
  song.coverInfo?.embeddedArtworkRevision ?? null,
]);

export const coverRetryIsDeferred = (song: Song, now = Date.now()): boolean => {
  const retry = song.coverInfo?.embeddedArtworkRetry;
  return Boolean(retry && retry.revision === coverSourceRevision(song)
    && Number.isFinite(retry.after) && retry.after > now);
};

/** A one-shot foreground wake-up is only useful for a live, bounded delay. */
export const nextCoverRetryAt = (songs: Song[], now = Date.now()): number | undefined => {
  let earliest: number | undefined;
  for (const song of songs) {
    const retry = song.coverInfo?.embeddedArtworkRetry;
    if (!retry || retry.revision !== coverSourceRevision(song) || !Number.isFinite(retry.after)
      || retry.after <= now || retry.after >= Number.MAX_SAFE_INTEGER) continue;
    if (earliest === undefined || retry.after < earliest) earliest = retry.after;
  }
  return earliest;
};

export const recordCoverReadFailure = (song: Song, now = Date.now()): Song => {
  const revision = coverSourceRevision(song);
  const previous = song.coverInfo?.embeddedArtworkRetry;
  const previousCount = previous?.revision === revision && Number.isSafeInteger(previous.failures)
    ? Math.max(0, Math.min(previous.failures, MAX_AUTOMATIC_FAILURES)) : 0;
  const failures = Math.min(previousCount + 1, MAX_AUTOMATIC_FAILURES);
  const after = failures >= MAX_AUTOMATIC_FAILURES ? Number.MAX_SAFE_INTEGER : now + RETRY_DELAYS_MS[failures - 1];
  return { ...song, coverInfo: { ...song.coverInfo, status: song.coverInfo?.status ?? 'none',
    embeddedArtworkRetry: { revision, failures, after } } };
};
