import TrackPlayer from 'react-native-track-player';
import type { Song } from '../types/Song';
import { getSongSourceKey } from './songSourceIdentity';
import { runExclusiveNativePlaybackControl } from './nativeQueueMutationLock';
import { withTimeout } from './withTimeout';
export const cleanerQueuedSourceReason = (target: Song, queue: readonly { id?: unknown; url?: unknown }[], songs: readonly Song[]): string | undefined => {
  const targetKey = getSongSourceKey(target.fileInfo?.uri ?? target.uri);
  if (!targetKey) return 'Quellidentität nicht bestätigt.';
  const byId = new Map(songs.map(song => [song.id, getSongSourceKey(song.fileInfo?.uri ?? song.uri)]));
  const knownSources = new Set(byId.values());
  for (const track of queue) {
    if (typeof track.url !== 'string' || !track.url.trim()) return 'Native Warteschlange enthält unbestätigte Quellen.';
    const id = typeof track.id === 'string' ? track.id : undefined;
    const source = id ? byId.get(id) : undefined;
    const nativeKey = getSongSourceKey(track.url);
    if (id === target.id || source === targetKey || nativeKey === targetKey)
      return 'Quelle liegt in der nativen Warteschlange (auch automatische nächste Titel). Vorher entfernen.';
    if (!source && !knownSources.has(nativeKey)) return 'Native Warteschlange enthält nicht aufgelöste Quellen.';
  }
  return undefined;
};
export const checkCleanerNativeQueue = async (target: Song, songs: readonly Song[]): Promise<string | undefined> => {
  try {
    return await runExclusiveNativePlaybackControl(async ({ assertHydrationCurrent }) => {
      const queue = await withTimeout(TrackPlayer.getQueue(), 5000, 'Native Warteschlange nicht bestätigt.');
      assertHydrationCurrent();
      if (!Array.isArray(queue)) return 'Native Warteschlange nicht bestätigt.';
      return cleanerQueuedSourceReason(target, queue, songs);
    }, { requireStableReadyHydration: true });
  } catch { return 'Playback-Bereitschaft oder native Warteschlange nicht bestätigt; Datei übersprungen.'; }
};
