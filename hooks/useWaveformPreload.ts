import { useEffect, useRef } from 'react';
import type { Song } from '../types/Song';
import { getWaveformSourceIdentity } from '../utils/waveformGenerator';
import { preloadSongWaveform } from '../utils/waveformPreload';

/** Starts bounded background cache warming only when the audio source changes. */
export const useWaveformPreload = (song: Song | null | undefined): void => {
  const songRef = useRef(song);
  songRef.current = song;
  const identity = getWaveformSourceIdentity(song);
  const { sourceKey, sourceFingerprint } = identity;

  useEffect(() => {
    const controller = new AbortController();
    void preloadSongWaveform(songRef.current, { signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [sourceFingerprint, sourceKey]);
};

/**
 * Warms adjacent tracks in navigation order. The likely next track goes first;
 * the previous track follows only while the same adjacency snapshot is active.
 */
export const useAdjacentWaveformPreload = (
  nextSong: Song | null | undefined,
  previousSong: Song | null | undefined,
): void => {
  const songsRef = useRef({ nextSong, previousSong });
  songsRef.current = { nextSong, previousSong };
  const nextIdentity = getWaveformSourceIdentity(nextSong);
  const previousIdentity = getWaveformSourceIdentity(previousSong);

  useEffect(() => {
    const controller = new AbortController();
    const targets = songsRef.current;
    void (async () => {
      await preloadSongWaveform(targets.nextSong, { priority: 'preload', signal: controller.signal }).catch(() => null);
      if (!controller.signal.aborted) {
        await preloadSongWaveform(targets.previousSong, { priority: 'background', signal: controller.signal })
          .catch(() => null);
      }
    })().catch(() => undefined);
    return () => controller.abort();
  }, [
    nextIdentity.sourceFingerprint,
    nextIdentity.sourceKey,
    previousIdentity.sourceFingerprint,
    previousIdentity.sourceKey,
  ]);
};
