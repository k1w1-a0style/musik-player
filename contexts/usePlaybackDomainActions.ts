import { usePlaybackQueueActions } from './usePlaybackQueueActions';
import type { PlaybackQueueActions, PlaybackQueueActionsArgs } from './usePlaybackQueueActions';

export type PlaybackDomainActionsInput = PlaybackQueueActionsArgs;
export type PlaybackDomainActions = PlaybackQueueActions;

export const usePlaybackDomainActions = (
  input: PlaybackDomainActionsInput,
): PlaybackDomainActions => usePlaybackQueueActions(input);
