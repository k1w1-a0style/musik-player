const SETUP_ALREADY_DONE_PATTERNS = [
  /already\s+(initialized|initialised|setup|set up)/i,
  /player\s+has\s+already\s+been\s+initialized/i,
  /trackplayer\s+is\s+already\s+initialized/i,
];

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
