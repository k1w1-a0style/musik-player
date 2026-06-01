import { buildMusicProviderActionsInput } from './musicProviderActionsInput';
import { useMusicProviderActions } from './useMusicProviderActions';
import type { MusicProviderActions } from './useMusicProviderActions';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';

export type MusicProviderDomainActions = MusicProviderActions;

const getCurrentSongId = ({ state }: MusicProviderRuntime): string | undefined =>
  state.currentSong?.id;

export const useMusicProviderDomainActions = (
  runtime: MusicProviderRuntime,
): MusicProviderDomainActions =>
  useMusicProviderActions(
    buildMusicProviderActionsInput({
      playbackRefs: runtime.refs,
      providerState: runtime.state,
      currentSongId: getCurrentSongId(runtime),
    }),
  );
