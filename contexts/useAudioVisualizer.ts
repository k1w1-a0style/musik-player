import { useEffect, useRef, useState } from 'react';
import {
  createDefaultFftBins,
  createVisualizerSubscriptions,
  getVisualizerError,
  shouldAcceptVisualizerFrame,
  stopVisualizer,
  stopVisualizerWhenPlaybackRequires,
} from './audioVisualizerHelpers';

export interface AudioVisualizerState {
  fftBins: number[];
  visualizerRunning: boolean;
  visualizerError: string | null;
}

export const useAudioVisualizer = (isPlaying: boolean): AudioVisualizerState => {
  const [fftBins, setFftBins] = useState<number[]>(createDefaultFftBins);
  const [visualizerRunning, setVisualizerRunning] = useState(false);
  const [visualizerError, setVisualizerError] = useState<string | null>(null);
  const lastVisualizerUpdateRef = useRef(0);

  useEffect(() => {
    const subscriptions = createVisualizerSubscriptions({
      onFft: data => {
        const now = Date.now();
        if (!shouldAcceptVisualizerFrame(now, lastVisualizerUpdateRef.current)) return;
        lastVisualizerUpdateRef.current = now;
        setFftBins(data);
      },
      onState: event => {
        setVisualizerRunning(event.running);
        setVisualizerError(getVisualizerError(event.running, event.reason));
      },
    });

    stopVisualizer();

    return () => {
      subscriptions.remove();
    };
  }, []);

  useEffect(() => {
    stopVisualizerWhenPlaybackRequires(isPlaying);
  }, [isPlaying]);

  return { fftBins, visualizerRunning, visualizerError };
};
