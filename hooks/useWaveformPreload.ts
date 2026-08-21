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
    void preloadSongWaveform(songRef.current).catch(() => undefined);
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
    let active = true;
    const targets = songsRef.current;
    void (async () => {
      await preloadSongWaveform(targets.nextSong, { priority: 'preload' }).catch(() => null);
      if (active) {
        await preloadSongWaveform(targets.previousSong, { priority: 'background' })
          .catch(() => null);
      }
    })().catch(() => undefined);
    return () => { active = false; };
  }, [
    nextIdentity.sourceFingerprint,
    nextIdentity.sourceKey,
    previousIdentity.sourceFingerprint,
    previousIdentity.sourceKey,
  ]);
};
