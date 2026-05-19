import TrackPlayer, { Event } from 'react-native-track-player';
import { PlaybackService } from '../PlaybackService';

describe('PlaybackService', () => {
  beforeEach(() => {
    (TrackPlayer as unknown as { __reset: () => void }).__reset();
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

    (TrackPlayer as unknown as { __trigger: (event: string, payload?: unknown) => void }).__trigger(Event.RemotePlay);
    await Promise.resolve();

    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
  });

  test('logs remote action failures', async () => {
    const error = new Error('not ready');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.skipToNext as jest.Mock).mockRejectedValueOnce(error);
    await PlaybackService();

    (TrackPlayer as unknown as { __trigger: (event: string, payload?: unknown) => void }).__trigger(Event.RemoteNext);
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith('[PlaybackService] Remote next failed', error);
  });
});
