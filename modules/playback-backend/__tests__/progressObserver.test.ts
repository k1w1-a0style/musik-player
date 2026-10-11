import { observeProgress } from '../progressObserver';
import { getProgress } from '../player';
import { notifyProgressMutation, subscribeProgressMutation } from '../progressMutations';
import { Event, type Progress } from '../types';

const mockListeners = new Map<string, (payload: never) => void>();
jest.mock('@rntp/player', () => ({ PlayerCommand: {}, RepeatMode: {} }));
jest.mock('../player', () => ({ getProgress: jest.fn() }));
jest.mock('../events', () => ({ addEventListener: jest.fn((event: string, listener: (payload: never) => void) => {
  mockListeners.set(event, listener); return { remove: () => mockListeners.delete(event) };
}) }));
const stops: Array<() => void> = [];
const read = jest.mocked(getProgress);
const snapshot = (position: number): Progress => ({ position, duration: 120, buffered: 90 });
const deferred = () => {
  let resolve!: (value: Progress) => void;
  const promise = new Promise<Progress>(yes => { resolve = yes; }); return { promise, resolve };
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const emit = (event: Event, payload = {}) => { mockListeners.get(event)!(payload as never); };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockListeners.clear(); read.mockResolvedValue(snapshot(12)); });
afterEach(() => { stops.splice(0).forEach(stop => stop()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('does not overlap slow native progress reads or build a timer backlog', async () => {
  const pending = deferred(); read.mockReturnValueOnce(pending.promise); const update = jest.fn();
  stops.push(observeProgress(update, 500, true));
  await jest.advanceTimersByTimeAsync(5000); expect(read).toHaveBeenCalledTimes(1);
  pending.resolve(snapshot(12)); await settle(); expect(update).toHaveBeenLastCalledWith(snapshot(12));
  expect(read).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(500); expect(read).toHaveBeenCalledTimes(2);
});

test('a native heartbeat supersedes an older pending snapshot without another read', async () => {
  const pending = deferred(); read.mockReturnValueOnce(pending.promise); const update = jest.fn();
  stops.push(observeProgress(update, 500, false));
  emit(Event.PlaybackProgressUpdated, { position: 30, duration: 120 });
  pending.resolve(snapshot(12)); await settle();
  expect(update.mock.calls).toEqual([[{ position: 30, duration: 120, buffered: 0 }]]);
  expect(read).toHaveBeenCalledTimes(1);
});

test('a confirmed seek or track change queues one fresh snapshot behind existing IO', async () => {
  const pending = deferred(); read.mockReturnValueOnce(pending.promise).mockResolvedValue(snapshot(42)); const update = jest.fn();
  stops.push(observeProgress(update, 500, false));
  notifyProgressMutation(); notifyProgressMutation(); emit(Event.PlaybackActiveTrackChanged);
  expect(read).toHaveBeenCalledTimes(1);
  pending.resolve(snapshot(12)); await settle();
  expect(read).toHaveBeenCalledTimes(2); expect(update.mock.calls).toEqual([[snapshot(42)]]);
});

test('disposes pending refreshes, all event subscriptions, and periodic reads', async () => {
  const pending = deferred(); read.mockReturnValueOnce(pending.promise); const update = jest.fn();
  const stop = observeProgress(update, 500, true); notifyProgressMutation(); stop();
  pending.resolve(snapshot(12)); await settle(); await jest.advanceTimersByTimeAsync(5000); notifyProgressMutation();
  expect(update).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(1);
  expect(mockListeners.size).toBe(0); expect(jest.getTimerCount()).toBe(0);
});

test('recovers after a failed snapshot when the native heartbeat arrives', async () => {
  read.mockRejectedValueOnce(new Error('startup incomplete')); const update = jest.fn();
  stops.push(observeProgress(update, 500, false)); await settle();
  expect(update).not.toHaveBeenCalled();
  emit(Event.PlaybackProgressUpdated, { position: 30, duration: 120 });
  expect(update).toHaveBeenCalledWith({ position: 30, duration: 120, buffered: 0 });
});

test('an observer failure cannot prevent other observers or fail an acknowledged seek', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined); const second = jest.fn();
  stops.push(subscribeProgressMutation(() => { throw new Error('UI failure'); }), subscribeProgressMutation(second));
  expect(() => notifyProgressMutation()).not.toThrow(); expect(second).toHaveBeenCalledTimes(1);
  expect(warning).toHaveBeenCalledWith('[PlaybackProgress] Observer refresh failed.');
});
