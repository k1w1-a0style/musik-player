import * as player from './player';
import { addEventListener, registerPlaybackService, setRemoteCommandGuard } from './events';

export * from './types';
export * from './hooks';
export {
  setupPlayer, updateOptions, play, pause, stop, reset, seekTo, seekBy, add,
  skip, skipToNext, skipToPrevious, move, updateMetadataForTrack,
  setRepeatMode, setVolume, getQueue, getNavigationSnapshot, getActiveTrack, getActiveTrackIndex,
  getProgress, getPlayWhenReady, getPlaybackState, getRepeatMode, getAudioSessionId,
} from './player';
export { addEventListener, registerPlaybackService, setRemoteCommandGuard };

export default { ...player, addEventListener, registerPlaybackService, setRemoteCommandGuard };
