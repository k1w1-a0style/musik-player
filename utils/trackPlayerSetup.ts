import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
} from 'react-native-track-player';

const SETUP_ALREADY_DONE_PATTERNS = [
  /already\s+(initialized|initialised|setup|set up)/i,
  /player\s+has\s+already\s+been\s+initialized/i,
  /trackplayer\s+is\s+already\s+initialized/i,
];

export const TRACK_PLAYER_OPTIONS = {
  android: {
    appKilledPlaybackBehavior:
      AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
  },
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo,
    Capability.Stop,
  ],
  compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
  notificationCapabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo,
  ],
  progressUpdateEventInterval: 2,
} as const;

export type TrackPlayerSetupLogger = (message: string, error?: unknown) => void;

export const isTrackPlayerAlreadySetUpError = (error: unknown): boolean => {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return SETUP_ALREADY_DONE_PATTERNS.some(pattern => pattern.test(message));
};

export const formatTrackPlayerSetupError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'Unknown TrackPlayer setup error';
};

export const setupTrackPlayer = async (
  logger: TrackPlayerSetupLogger = console.warn,
): Promise<void> => {
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
  } catch (error) {
    if (!isTrackPlayerAlreadySetUpError(error)) {
      logger(`TrackPlayer setup failed: ${formatTrackPlayerSetupError(error)}`, error);
      return;
    }
  }

  try {
    await TrackPlayer.updateOptions(TRACK_PLAYER_OPTIONS);
  } catch (error) {
    logger(`TrackPlayer options update failed: ${formatTrackPlayerSetupError(error)}`, error);
  }
};
