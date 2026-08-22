import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  type UpdateOptions,
} from 'react-native-track-player';

const SETUP_ALREADY_DONE_PATTERNS = [
  /already\s+(initialized|initialised|setup|set up)/i,
  /player\s+has\s+already\s+been\s+initialized/i,
  /trackplayer\s+is\s+already\s+initialized/i,
];

export const TRACK_PLAYER_OPTIONS: UpdateOptions = {
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
  // Controls native PlaybackProgressUpdated and notification-related events (interval: 2 s);
  // UI progress polling is handled separately via useProgress(500).
  progressUpdateEventInterval: 2,
};

export type TrackPlayerSetupLogger = (message: string, error?: unknown) => void;
export const TRACK_PLAYER_SETUP_TIMEOUT_MS = 10_000;

export interface TrackPlayerSetupOptions { timeoutMs?: number }

export class TrackPlayerSetupTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`TrackPlayer setup timed out after ${timeoutMs} ms`);
    this.name = 'TrackPlayerSetupTimeoutError';
  }
}

let activeSetupAttempt: Promise<void> | null = null;

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

const runTrackPlayerSetup = async (logger: TrackPlayerSetupLogger): Promise<void> => {
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
  } catch (error) {
    if (!isTrackPlayerAlreadySetUpError(error)) {
      logger(`TrackPlayer setup failed: ${formatTrackPlayerSetupError(error)}`, error);
      throw error;
    }
  }

  try {
    await TrackPlayer.updateOptions(TRACK_PLAYER_OPTIONS);
  } catch (error) {
    logger(`TrackPlayer options update failed: ${formatTrackPlayerSetupError(error)}`, error);
    throw error;
  }
};

const getOrStartTrackPlayerSetup = (logger: TrackPlayerSetupLogger): Promise<void> => {
  if (activeSetupAttempt) return activeSetupAttempt;
  const attempt = runTrackPlayerSetup(logger);
  activeSetupAttempt = attempt;
  void attempt.then(
    () => {
      if (activeSetupAttempt === attempt) activeSetupAttempt = null;
    },
    () => {
      if (activeSetupAttempt === attempt) activeSetupAttempt = null;
    },
  );
  return attempt;
};

export const setupTrackPlayer = async (
  logger: TrackPlayerSetupLogger = console.warn,
  options: TrackPlayerSetupOptions = {},
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? TRACK_PLAYER_SETUP_TIMEOUT_MS;
  const attempt = getOrStartTrackPlayerSetup(logger);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      attempt,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new TrackPlayerSetupTimeoutError(timeoutMs);
          logger(error.message, error);
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

export const resetTrackPlayerSetupForTests = (): void => {
  activeSetupAttempt = null;
};
