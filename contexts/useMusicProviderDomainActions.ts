import { useMemo } from 'react';
import { buildMusicProviderActionsInput } from './musicProviderActionsInput';
import { useMusicProviderActions } from './useMusicProviderActions';
import type { MusicProviderActions } from './useMusicProviderActions';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';

export type MusicProviderDomainActions = MusicProviderActions;

const getCurrentSongId = ({ state }: MusicProviderRuntime): string | undefined =>
  state.currentSong?.id;

export const useMusicProviderDomainActions = (
  runtime: MusicProviderRuntime,
): MusicProviderDomainActions => {
  const actions = useMusicProviderActions(
    buildMusicProviderActionsInput({
      playbackRefs: runtime.refs,
      providerState: runtime.state,
      currentSongId: getCurrentSongId(runtime),
    }),
  );
  return useMemo(() => {
    if (runtime.state.hydrationStatus !== 'degraded') return actions;
    const blocked = async () => ({ status: 'failed' as const, error: new Error('Native queue hydration requires verification.') });
    const blockedVoid = async () => undefined;
    return {
      ...actions,
      playSong: blocked,
      playSongNext: blocked,
      addSongToQueue: blocked,
      reorderQueue: blocked,
      toggleShuffle: blocked,
      playPlaylist: blockedVoid,
    };
  }, [actions, runtime.state.hydrationStatus]);
};
