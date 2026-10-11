import { renderHook } from '@testing-library/react-native';
import TrackPlayer, { State } from 'react-native-track-player';
import { useResumePlayPause } from '../useResumePlayPause';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';
import { resetNativePlaybackIntentForTests } from '../../utils/nativePlaybackIntent';
import type { MusicProviderRuntime } from '../../contexts/useMusicProviderRuntime';
import type { MusicProviderDomainActions } from '../../contexts/useMusicProviderDomainActions';
let mockEnabled = true;
jest.mock('../../contexts/PlaybackResumeContext', () => ({ usePlaybackResume: () => ({ enabled: mockEnabled }) }));
const toggle = jest.fn().mockResolvedValue(undefined);
const playSong = jest.fn().mockResolvedValue({ status: 'applied' });
const song = { id: 'mix', title: 'Mix', artist: 'DJ' };
const runtime = { state: { currentSong: song }, playback: { isPlaying: false, togglePlayPause: toggle },
  refs: { queueContextRef: { current: [song] } } } as unknown as MusicProviderRuntime;
const actions = { playSong } as unknown as MusicProviderDomainActions;
beforeEach(() => {
  jest.clearAllMocks(); mockEnabled = true; resetNativeHydrationGateForTests(); resetNativePlaybackIntentForTests();
  const owner = acquireNativeHydrationGate(); publishNativeHydrationGate(owner, 'ready');
  (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Paused });
  (TrackPlayer.getPlayWhenReady as jest.Mock).mockResolvedValue(false);
});
test('Off keeps the original toggle and adds no native reads', async () => {
  mockEnabled = false; const view = renderHook(() => useResumePlayPause(runtime, actions));
  expect(view.result.current).toBe(toggle); await view.result.current();
  expect(TrackPlayer.getPlaybackState).not.toHaveBeenCalled(); expect(playSong).not.toHaveBeenCalled();
});
test('a cold-start UI play uses the same selection dialog and queue owner as a song tap', async () => {
  const view = renderHook(() => useResumePlayPause(runtime, actions)); await view.result.current();
  expect(playSong).toHaveBeenCalledWith(song, [song]); expect(toggle).not.toHaveBeenCalled();
});
test('actual playing state pauses immediately even when the render state is stale', async () => {
  (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Playing });
  const view = renderHook(() => useResumePlayPause(runtime, actions)); await view.result.current();
  expect(toggle).toHaveBeenCalled(); expect(playSong).not.toHaveBeenCalled();
});
