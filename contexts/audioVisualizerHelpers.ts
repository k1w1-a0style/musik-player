import SystemAudio from 'expo-system-audio';
import {
  shouldApplyVisualizerFrame,
  shouldStopVisualizerForPlaybackState,
} from '../utils/audioEffects';

export const VISUALIZER_UPDATE_INTERVAL_MS = 120;

export interface VisualizerSubscriptions {
  remove: () => void;
}

export const createDefaultFftBins = (): number[] => new Array(16).fill(0);

export const shouldAcceptVisualizerFrame = (
  now: number,
  lastUpdate: number,
  intervalMs: number = VISUALIZER_UPDATE_INTERVAL_MS,
): boolean => shouldApplyVisualizerFrame(now, lastUpdate, intervalMs);

export const getVisualizerError = (running: boolean, reason: string | null | undefined): string | null =>
  running ? null : reason ?? null;

export const stopVisualizer = (): void => {
  SystemAudio.visualizerStop();
};

export const stopVisualizerWhenPlaybackRequires = (isPlaying: boolean): void => {
  if (shouldStopVisualizerForPlaybackState(isPlaying)) stopVisualizer();
};

export const createVisualizerSubscriptions = ({
  onFft,
  onState,
}: {
  onFft: (data: number[]) => void;
  onState: (event: { running: boolean; reason: string | null }) => void;
}): VisualizerSubscriptions => {
  const subFft = SystemAudio.onFft(onFft);
  const subState = SystemAudio.onVisualizerState(onState);

  return {
    remove: () => {
      subFft.remove();
      subState.remove();
      stopVisualizer();
    },
  };
};
