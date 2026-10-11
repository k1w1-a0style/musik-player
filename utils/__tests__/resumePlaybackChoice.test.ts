import { Alert } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { resolveResumePlaybackChoice } from '../resumePlaybackChoice';
import type { ResumePositionStore } from '../resumePositionStore';
import type { Song } from '../../types/Song';
const song: Song = { id: 'mix', title: 'Langer Mix', artist: 'DJ' };
const lookup = jest.fn();
const store = { lookup } as unknown as ResumePositionStore;
const choose = (text: string) => {
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  buttons.find((button: any) => button.text === text).onPress();
};
beforeEach(() => {
  jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  lookup.mockResolvedValue({ positionMs: 122000 });
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'other' });
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0 });
  (TrackPlayer.getPlayWhenReady as jest.Mock).mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());
test.each([['Fortsetzen', 122000], ['Von vorn', 0]])('offers %s without changing native playback while the dialog is open', async (text, position) => {
  const pending = resolveResumePlaybackChoice(song, store, () => true);
  await new Promise(resolve => setImmediate(resolve));
  expect(Alert.alert).toHaveBeenCalledWith('Wiedergabe fortsetzen?', expect.stringContaining('2:02'), expect.any(Array), expect.any(Object));
  expect(TrackPlayer.seekTo).not.toHaveBeenCalled(); expect(TrackPlayer.pause).not.toHaveBeenCalled();
  choose(text); expect(await pending).toEqual({ status: 'continue', startPositionMs: position });
});
test('cancel or Android dismissal makes no playback request', async () => {
  const pending = resolveResumePlaybackChoice(song, store, () => true);
  await new Promise(resolve => setImmediate(resolve));
  (Alert.alert as jest.Mock).mock.calls[0][3].onDismiss();
  expect(await pending).toEqual({ status: 'cancel' }); expect(TrackPlayer.play).not.toHaveBeenCalled();
});
test('a newer selection, pause, seek, source revision or provider cancels the old choice', async () => {
  let current = true; const pending = resolveResumePlaybackChoice(song, store, () => current);
  await new Promise(resolve => setImmediate(resolve)); current = false; choose('Fortsetzen');
  expect(await pending).toEqual({ status: 'cancel' });
});
test.each([[120, false], [0, true]])('a live session at %s seconds keeps its current position', async (position, playing) => {
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'mix' });
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position });
  (TrackPlayer.getPlayWhenReady as jest.Mock).mockResolvedValue(playing);
  expect(await resolveResumePlaybackChoice(song, store, () => true)).toEqual({ status: 'continue' });
  expect(Alert.alert).not.toHaveBeenCalled();
});
test('cold-start zero offers the saved position; short or unknown entries do not read native progress', async () => {
  (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'mix' });
  const pending = resolveResumePlaybackChoice(song, store, () => true);
  await new Promise(resolve => setImmediate(resolve)); choose('Von vorn'); await pending;
  jest.clearAllMocks(); lookup.mockResolvedValue(undefined);
  expect(await resolveResumePlaybackChoice(song, store, () => true)).toEqual({ status: 'continue' });
  expect(TrackPlayer.getActiveTrack).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
});
