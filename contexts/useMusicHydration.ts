import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import { runMusicHydration } from './musicHydrationHelpers';
import type { BeforeStorageHydrationResult } from './musicHydrationTypes';
import { acquireNativeHydrationGate, publishNativeHydrationGate, releaseNativeHydrationGate } from '../utils/nativeHydrationGate';

interface UseMusicHydrationArgs {
  songsRef: MutableRefObject<Song[]>;
  queueContextRef: MutableRefObject<Song[]>;
  baseQueueContextRef: MutableRefObject<Song[]>;
  nativeQueueRef: MutableRefObject<Song[]>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  libraryHydrationReady: boolean;
  beforeStorageHydration?: () => Promise<BeforeStorageHydrationResult>;
  setLibraryHydrationReady: Dispatch<SetStateAction<boolean>>;
  setHydrationStatus?: Dispatch<SetStateAction<'loading' | 'ready' | 'degraded' | 'retry-required'>>;
  hydrationRetryToken?: number;
  setSongsState: Dispatch<SetStateAction<Song[]>>;
  setCurrentSong: Dispatch<SetStateAction<Song | null>>;
  setPlaybackQueue: Dispatch<SetStateAction<Song[]>>;
  setPlaylists: Dispatch<SetStateAction<Playlist[]>>;
  setEqEnabledState: Dispatch<SetStateAction<boolean>>;
  setEqBandsState: Dispatch<SetStateAction<number[]>>;
  setEqPreset: Dispatch<SetStateAction<EqPresetName | 'custom'>>;
  setVolumeState: Dispatch<SetStateAction<number>>;
  setRepeatMode: Dispatch<SetStateAction<RepeatMode>>;
  setShuffle: Dispatch<SetStateAction<boolean>>;
}

interface HydrationGeneration {
  token: number | undefined;
  gateOwner: ReturnType<typeof acquireNativeHydrationGate>;
  cancelled: boolean;
  started: boolean;
}

type HydrationGenerationRef = MutableRefObject<HydrationGeneration | null>;

const useHydrationGeneration = ({
  hydrationRetryToken,
  setIsReady,
  setLibraryHydrationReady,
  setHydrationStatus,
}: Pick<
  UseMusicHydrationArgs,
  'hydrationRetryToken' | 'setIsReady' | 'setLibraryHydrationReady' | 'setHydrationStatus'
>
): HydrationGenerationRef => {
  const generationRef = useRef<HydrationGeneration | null>(null);

  // Close both action gates for the new generation first. On retries this
  // deliberately causes a render with libraryHydrationReady=false before the
  // storage phase starts, so persistence effects from the last interactive
  // render have a chance to enqueue their final snapshot.
  useEffect(() => {
    const gateOwner = acquireNativeHydrationGate();
    const generation = {
      token: hydrationRetryToken,
      gateOwner,
      cancelled: false,
      started: false,
    };
    generationRef.current = generation;
    publishNativeHydrationGate(gateOwner, 'loading');
    setIsReady(false);
    setLibraryHydrationReady(false);
    setHydrationStatus?.('loading');

    return () => {
      generation.cancelled = true;
      if (generationRef.current === generation) generationRef.current = null;
      releaseNativeHydrationGate(gateOwner);
    };
    // A retry token owns one native gate generation. React setters are stable
    // hand-off targets, not restart signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationRetryToken]);

  return generationRef;
};

const useHydrationRunner = (
  args: UseMusicHydrationArgs,
  generationRef: HydrationGenerationRef,
): void => {
  const { libraryHydrationReady, hydrationRetryToken, ...hydrationArgs } = args;

  useEffect(() => {
    const generation = generationRef.current;
    if (
      libraryHydrationReady
      || generation === null
      || generation.token !== hydrationRetryToken
      || generation.started
    ) return;

    generation.started = true;
    void runMusicHydration({
      ...hydrationArgs,
      gateOwner: generation.gateOwner,
      isCancelled: () => generation.cancelled,
    });
    // The readiness transition is the required second phase of a generation.
    // Refs and setters remain stable hand-off targets, not restart signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationRetryToken, libraryHydrationReady]);
};

export const useMusicHydration = (args: UseMusicHydrationArgs): void => {
  const generationRef = useHydrationGeneration(args);
  useHydrationRunner(args, generationRef);
};
