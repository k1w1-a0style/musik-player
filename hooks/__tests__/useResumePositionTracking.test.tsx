import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useResumePositionTracking } from '../useResumePositionTracking';
import { notifyProgressMutation } from '../../modules/playback-backend/progressMutations';
import type { Song } from '../../types/Song';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';
const song: Song = { id: 'mix', title: 'Mix', artist: 'DJ', uri: 'file:///mix.mp3' };
const mockRecord = jest.fn().mockResolvedValue(undefined);
const mockFlush = jest.fn().mockResolvedValue(undefined);
let mockEnabled = true;
jest.mock('../../contexts/PlaybackResumeContext', () => ({ usePlaybackResume: () => ({ enabled: mockEnabled, store: { record: mockRecord, flush: mockFlush } }) }));
const listeners = new Map<Event, (value: any) => void>();
let background: (value: any) => void;
let remove: jest.Mock;
let owner: ReturnType<typeof acquireNativeHydrationGate>;
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear(); mockEnabled = true; remove = jest.fn();
  resetNativeHydrationGateForTests(); owner = acquireNativeHydrationGate(); publishNativeHydrationGate(owner, 'ready');
  (TrackPlayer.addEventListener as jest.Mock).mockImplementation((event, callback) => {
    listeners.set(event, callback); return { remove };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    background = callback; return { remove };
  });
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'mix' });
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 120, duration: 3600 });
});
test('hydration seeks and playback receipts cannot erase a cold-start saved position', async () => {
  publishNativeHydrationGate(owner, 'loading');
  const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  await act(async () => notifyProgressMutation());
  await emit(Event.PlaybackState, { state: State.Playing });
  await emit(Event.PlaybackProgressUpdated, { mediaId: 'mix', position: 0, duration: 3600, timestamp: Date.now() });
  publishNativeHydrationGate(owner, 'ready');
  await emit(Event.PlaybackState, { state: State.Paused });
  expect(mockRecord).not.toHaveBeenCalled(); expect(TrackPlayer.getProgress).not.toHaveBeenCalled();
  view.unmount();
});
afterEach(() => jest.restoreAllMocks());
const emit = async (event: Event, receipt: any) => { await act(async () => { listeners.get(event)?.(receipt); }); };
test('Off installs no native or app listeners and reads no positions', () => {
  mockEnabled = false; const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  expect(TrackPlayer.addEventListener).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(TrackPlayer.getProgress).not.toHaveBeenCalled(); expect(mockRecord).not.toHaveBeenCalled();
  view.unmount(); expect(mockFlush).not.toHaveBeenCalled();
});
test('cold-start paused zero does not erase an earlier saved position', async () => {
  const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  await emit(Event.PlaybackState, { state: State.Paused });
  await act(async () => background('background'));
  expect(mockRecord).not.toHaveBeenCalled(); expect(TrackPlayer.getProgress).not.toHaveBeenCalled();
  view.unmount();
});
test('native receipts retain source and timestamp with no extra progress polling', async () => {
  const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  await emit(Event.PlaybackProgressUpdated, { mediaId: 'mix', position: 122, duration: 3600, timestamp: 1800000000000 });
  expect(mockRecord).toHaveBeenCalledWith(song, 122000, 3600000, 1800000000000);
  expect(TrackPlayer.getProgress).not.toHaveBeenCalled(); view.unmount();
});
test('missing or ambiguous media identity and missing native timestamp never mockRecord', async () => {
  const view = renderHook(() => useResumePositionTracking({ current: [song, song] }));
  await emit(Event.PlaybackProgressUpdated, { mediaId: 'mix', position: 120, duration: 3600, timestamp: 1 });
  await emit(Event.PlaybackProgressUpdated, { mediaId: 'other', position: 120, duration: 3600, timestamp: 1 });
  await emit(Event.PlaybackProgressUpdated, { position: 120, duration: 3600 });
  expect(mockRecord).not.toHaveBeenCalled(); view.unmount();
});
test('pause, background and confirmed paused seek mockFlush live positions', async () => {
  const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  await emit(Event.PlaybackState, { state: State.Playing });
  await emit(Event.PlaybackState, { state: State.Paused });
  await act(async () => background('background'));
  await act(async () => notifyProgressMutation());
  expect(mockRecord).toHaveBeenCalledTimes(3); expect(mockFlush).toHaveBeenCalledTimes(3);
  view.unmount(); expect(remove).toHaveBeenCalledTimes(4);
});
test('an old native read cannot overwrite a newer heartbeat', async () => {
  let finish!: (value: any) => void;
  (TrackPlayer.getProgress as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  await emit(Event.PlaybackState, { state: State.Playing });
  await emit(Event.PlaybackState, { state: State.Paused });
  await emit(Event.PlaybackProgressUpdated, { mediaId: 'mix', position: 122, duration: 3600, timestamp: 1800000000000 });
  await act(async () => finish({ position: 120, duration: 3600 }));
  expect(mockRecord).toHaveBeenCalledTimes(1); expect(mockRecord.mock.calls[0][1]).toBe(122000);
  view.unmount();
});
test('track changes and unmount invalidate delayed snapshots', async () => {
  let finish!: (value: any) => void;
  (TrackPlayer.getProgress as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = renderHook(() => useResumePositionTracking({ current: [song] }));
  await emit(Event.PlaybackState, { state: State.Playing });
  await emit(Event.PlaybackState, { state: State.Paused });
  await emit(Event.PlaybackActiveTrackChanged, { track: { id: 'other' } });
  view.unmount(); await act(async () => finish({ position: 120, duration: 3600 }));
  expect(mockRecord).not.toHaveBeenCalled();
});
