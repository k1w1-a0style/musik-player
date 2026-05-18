import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import TrackPlayer, { Event } from 'react-native-track-player';
import type { Song } from '../types/Song';

interface CurrentSongSyncArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  persistCurrentSongId: (song: Song | null) => Promise<void>;
}

export const findTrackSongById = (
  trackId: string | undefined,
  songSources: Song[][],
): Song | undefined => {
  if (!trackId) return undefined;
  for (const source of songSources) {
    const song = source.find(item => item.id === trackId);
    if (song) return song;
  }
  return undefined;
};

export const useCurrentSongSync = ({
  songsRef,
  queueContextRef,
  baseQueueContextRef,
  setCurrentSong,
  persistCurrentSongId,
}: CurrentSongSyncArgs): void => {
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, event => {
      const trackId = typeof event.track?.id === 'string' ? event.track.id : undefined;
      const song = findTrackSongById(trackId, [
        songsRef.current,
        queueContextRef.current,
        baseQueueContextRef.current,
      ]);
      if (!song) return;
      setCurrentSong(song);
      void persistCurrentSongId(song);
    });
    return () => sub.remove();
  }, [baseQueueContextRef, persistCurrentSongId, queueContextRef, setCurrentSong, songsRef]);
};
