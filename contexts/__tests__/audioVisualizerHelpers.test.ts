import SystemAudio from 'expo-system-audio';
import {
  VISUALIZER_UPDATE_INTERVAL_MS,
  createDefaultFftBins,
  createVisualizerSubscriptions,
  getVisualizerError,
  shouldAcceptVisualizerFrame,
  stopVisualizer,
  stopVisualizerWhenPlaybackRequires,
} from '../audioVisualizerHelpers';

describe('audioVisualizerHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates default fft bins', () => {
    expect(createDefaultFftBins()).toEqual(new Array(16).fill(0));
  });

  test('checks visualizer frame throttle interval', () => {
    expect(shouldAcceptVisualizerFrame(0, 0)).toBe(false);
    expect(shouldAcceptVisualizerFrame(VISUALIZER_UPDATE_INTERVAL_MS, 0)).toBe(true);
  });

  test('maps visualizer running state to error value', () => {
    expect(getVisualizerError(true, 'permission')).toBeNull();
    expect(getVisualizerError(false, 'permission')).toBe('permission');
    expect(getVisualizerError(false, undefined)).toBeNull();
  });

  test('stops visualizer directly and when playback requires it', () => {
    stopVisualizer();
    stopVisualizerWhenPlaybackRequires(false);

    expect(SystemAudio.visualizerStop).toHaveBeenCalledTimes(2);
  });

  test('creates and removes visualizer subscriptions', () => {
    const onFft = jest.fn();
    const onState = jest.fn();

    const subscriptions = createVisualizerSubscriptions({ onFft, onState });

    expect(SystemAudio.onFft).toHaveBeenCalledWith(onFft);
    expect(SystemAudio.onVisualizerState).toHaveBeenCalledWith(onState);

    subscriptions.remove();

    expect(SystemAudio.visualizerStop).toHaveBeenCalled();
  });
});
