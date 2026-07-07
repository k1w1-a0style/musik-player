import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';

export const clampMiniPlayerProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
};

export const getMiniPlayerProgressRatio = (position: number, duration: number): number => {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return 0;
  return clampMiniPlayerProgress(position / duration);
};

export const useMiniPlayerProgress = (): number => {
  const { position, duration } = usePlaybackProgress();
  return getMiniPlayerProgressRatio(position, duration);
};
