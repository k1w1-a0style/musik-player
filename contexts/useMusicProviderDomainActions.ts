import { buildMusicProviderActionsInput } from './musicProviderActionsInput';
import { useMusicProviderActions } from './useMusicProviderActions';
import type { MusicProviderActions } from './useMusicProviderActions';
import type { MusicProviderRuntime } from './useMusicProviderRuntime';
import { useConfirmedSongMetadata } from './useConfirmedSongMetadata';
import type { MusicContextValue } from './musicContextTypes';

export type MusicProviderDomainActions = MusicProviderActions & Pick<MusicContextValue, 'updateSongMetadataConfirmed'>;

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
  runtime.state.songLibrary?.configureImportPublication(actions.setSongs);
  const updateSongMetadataConfirmed = useConfirmedSongMetadata(runtime.state.songLibrary, actions.updateSongMetadata);
  return { ...actions, updateSongMetadataConfirmed };
};
