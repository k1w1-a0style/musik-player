import { usePlaylistActions } from './usePlaylistActions';
import type { PlaylistActions, PlaylistActionsArgs } from './usePlaylistActions';

export type PlaylistDomainActionsInput = PlaylistActionsArgs;
export type PlaylistDomainActions = PlaylistActions;

export const usePlaylistDomainActions = (
  input: PlaylistDomainActionsInput,
): PlaylistDomainActions => usePlaylistActions(input);
