import TrackPlayer, { Event } from 'react-native-track-player';
import { PlaybackService } from '../PlaybackService';

type TrackPlayerTestApi = typeof TrackPlayer & {
  __reset: () => void;
  __trigger: (event: string, payload?: unknown) => void;
};

const trackPlayerTestApi = TrackPlayer as unknown as TrackPlayerTestApi;

describe('PlaybackService', () => {
  beforeEach(() => {
    trackPlayerTestApi.__reset();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('registers remote playback controls', async () => {
    await PlaybackService();

    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemotePlay, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemotePause, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteStop, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteNext, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemotePrevious, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteSeek, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteJumpForward, expect.any(Function));
    expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(Event.RemoteJumpBackward, expect.any(Function));
  });

  test('runs remote play action', async () => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemotePlay);
    await Promise.resolve();

    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
  });

  test.each([12.5, 0])('seeks when remote seek position %p is valid', async position => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemoteSeek, { position });
    await Promise.resolve();

    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(position);
  });

  test.each([
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['non-number', '10'],
  ])('ignores invalid remote seek position: %s', async (_label, position) => {
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemoteSeek, { position });
    await Promise.resolve();

    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  test('logs remote action failures', async () => {
    const error = new Error('not ready');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.skipToNext as jest.Mock).mockRejectedValueOnce(error);
    await PlaybackService();

    trackPlayerTestApi.__trigger(Event.RemoteNext);
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith('[PlaybackService] Remote next failed', error);
  });
});
