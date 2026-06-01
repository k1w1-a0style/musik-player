import {
  composeMusicProviderActions,
  type MusicProviderActions,
} from './useMusicProviderActionComposition';
import { useLibraryDomainActions } from './useLibraryDomainActions';
import type { LibraryDomainActionsInput } from './useLibraryDomainActions';
import { usePlaybackDomainActions } from './usePlaybackDomainActions';
import type { PlaybackDomainActionsInput } from './usePlaybackDomainActions';
import { usePlaylistDomainActions } from './usePlaylistDomainActions';
import type { PlaylistDomainActionsInput } from './usePlaylistDomainActions';

type PlaylistDomainActionsInputWithoutPlaySong = Omit<PlaylistDomainActionsInput, 'playSong'>;

export interface MusicProviderActionsArgs {
  playback: PlaybackDomainActionsInput;
  library: LibraryDomainActionsInput;
  playlists: PlaylistDomainActionsInputWithoutPlaySong;
}

export type { MusicProviderActions };

export const useMusicProviderActions = ({
  playback: playbackInput,
  library: libraryInput,
  playlists: playlistInput,
}: MusicProviderActionsArgs): MusicProviderActions => {
  const playback = usePlaybackDomainActions(playbackInput);
  const library = useLibraryDomainActions(libraryInput);
  const playlists = usePlaylistDomainActions({
    ...playlistInput,
    playSong: playback.playSong,
  });

  return composeMusicProviderActions({ playback, library, playlists });
};
