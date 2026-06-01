import type { LibraryDomainActions } from './useLibraryDomainActions';
import type { PlaybackDomainActions } from './usePlaybackDomainActions';
import type { PlaylistDomainActions } from './usePlaylistDomainActions';

export interface MusicProviderActionDomains {
  playback: PlaybackDomainActions;
  library: LibraryDomainActions;
  playlists: PlaylistDomainActions;
}

export type MusicProviderActions = PlaybackDomainActions & LibraryDomainActions & PlaylistDomainActions;

export const composeMusicProviderActions = ({
  playback,
  library,
  playlists,
}: MusicProviderActionDomains): MusicProviderActions => ({
  ...playback,
  ...library,
  ...playlists,
});
