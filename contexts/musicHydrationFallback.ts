import TrackPlayer from 'react-native-track-player';
import { runExclusiveNativeQueueReplacement } from '../utils/nativeQueueMutationLock';
import {
  commitNativeQueueTruth,
  readNativeQueueTruth,
  type NativeQueueRecoveryDiagnostics,
} from './nativeQueueRecovery';
import type { RunMusicHydrationArgs } from './musicHydrationTypes';

type HydrationFallbackArgs = Omit<
  RunMusicHydrationArgs,
  | 'setIsReady'
  | 'setSongsState'
  | 'setPlaylists'
  | 'setEqEnabledState'
  | 'setEqBandsState'
  | 'setEqPreset'
  | 'setVolumeState'
  | 'setRepeatMode'
>;

export type HydrationFallbackResult =
  | { status: 'applied'; diagnostics: NativeQueueRecoveryDiagnostics }
  | { status: 'failed'; diagnostics: NativeQueueRecoveryDiagnostics };

export const applyHydrationFailureFallback = async (
  args: HydrationFallbackArgs,
  error: unknown,
): Promise<HydrationFallbackResult> => runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
  const diagnostics: NativeQueueRecoveryDiagnostics = { originalError: error };
  if (!isCurrent()) return { status: 'failed', diagnostics };
  try {
    await TrackPlayer.reset();
    if (args.isCancelled() || !isCurrent()) return { status: 'failed', diagnostics };
    const readback = await readNativeQueueTruth([
      ...args.songsRef.current,
      ...args.nativeQueueRef.current,
      ...args.queueContextRef.current,
    ]);
    if (args.isCancelled() || !isCurrent()) return { status: 'failed', diagnostics };
    await commitNativeQueueTruth({
      readback,
      preferredBaseQueue: [],
      librarySongs: [],
      targets: {
        nativeQueueRef: args.nativeQueueRef,
        queueContextRef: args.queueContextRef,
        baseQueueContextRef: args.baseQueueContextRef,
        setPlaybackQueue: args.setPlaybackQueue,
        setCurrentSong: args.setCurrentSong,
        setShuffle: args.setShuffle,
      },
      shuffleStrategy: { kind: 'confirmed-action', enabled: false },
    });
    console.warn('[MusicHydration:Fatal] Native playback was reset after hydration failure; preserving the library for retry.', error);
    return { status: 'applied', diagnostics };
  } catch (fallbackError) {
    diagnostics.finalReadbackError = fallbackError;
    console.warn('[MusicHydration:TrackPlayerError] Failed to apply serialized hydration fallback.', fallbackError);
    console.warn('[MusicHydration:Fatal] Hydration fallback could not verify native state.', error);
    return { status: 'failed', diagnostics };
  }
});
