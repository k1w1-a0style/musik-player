import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useProgress } from 'react-native-track-player';

interface PlaybackProgressContextValue {
  position: number;
  duration: number;
}

const PlaybackProgressContext = createContext<PlaybackProgressContextValue | null>(null);

export const PlaybackProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const progress = useProgress(500);

  const value = useMemo<PlaybackProgressContextValue>(
    () => ({
      position: progress.position * 1000,
      duration: progress.duration * 1000,
    }),
    [progress.position, progress.duration],
  );

  return <PlaybackProgressContext.Provider value={value}>{children}</PlaybackProgressContext.Provider>;
};

export const usePlaybackProgress = (): PlaybackProgressContextValue => {
  const ctx = useContext(PlaybackProgressContext);
  if (!ctx) {
    throw new Error('usePlaybackProgress must be used within a PlaybackProgressProvider');
  }
  return ctx;
};
