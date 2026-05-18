import { useEffect, useRef, useState } from 'react';
import SystemAudio from 'expo-system-audio';
import {
  shouldApplyVisualizerFrame,
  shouldStopVisualizerForPlaybackState,
} from '../utils/audioEffects';

const VISUALIZER_UPDATE_INTERVAL_MS = 120;

export interface AudioVisualizerState {
  fftBins: number[];
  visualizerRunning: boolean;
  visualizerError: string | null;
}

export const useAudioVisualizer = (isPlaying: boolean): AudioVisualizerState => {
  const [fftBins, setFftBins] = useState<number[]>(() => new Array(16).fill(0));
  const [visualizerRunning, setVisualizerRunning] = useState(false);
  const [visualizerError, setVisualizerError] = useState<string | null>(null);
  const lastVisualizerUpdateRef = useRef(0);

  useEffect(() => {
    const subFft = SystemAudio.onFft(data => {
      const now = Date.now();
      if (!shouldApplyVisualizerFrame(now, lastVisualizerUpdateRef.current, VISUALIZER_UPDATE_INTERVAL_MS)) return;
      lastVisualizerUpdateRef.current = now;
      setFftBins(data);
    });
    const subState = SystemAudio.onVisualizerState(event => {
      setVisualizerRunning(event.running);
      setVisualizerError(event.running ? null : event.reason);
    });

    SystemAudio.visualizerStop();

    return () => {
      subFft.remove();
      subState.remove();
      SystemAudio.visualizerStop();
    };
  }, []);

  useEffect(() => {
    if (shouldStopVisualizerForPlaybackState(isPlaying)) SystemAudio.visualizerStop();
  }, [isPlaying]);

  return { fftBins, visualizerRunning, visualizerError };
};
