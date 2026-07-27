import type { Song } from '../../types/Song';
import {
  createNativeHydrationExpectation,
  evaluateNativeHydrationFulfillment,
} from '../nativeHydrationPlanFulfillment';
import { createHydrationPlan } from '../musicHydrationPlan';
import type { NativeQueueReadback } from '../nativeQueueRecovery';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///1.mp3' },
  { id: 's2', title: 'Two', artist: 'A', uri: 'file:///2.mp3' },
];
const stored = { songs, playlists: null, eqEnabled: null, eqBands: null, eqPreset: null, volume: null,
  repeatMode: null, shuffle: false, currentSongId: 's1' };
const readback = (queue: Song[], activeTrackId: string | null, activeIndex: number): NativeQueueReadback => ({
  queue,
  activeSong: activeIndex >= 0 ? queue[activeIndex] ?? null : null,
  activeTrackId,
  activeIndex,
  progressSeconds: 0,
  playbackState: 'paused',
});

test('exact active expectation requires matching id and index', () => {
  const expectation = createNativeHydrationExpectation(createHydrationPlan(stored, songs));
  expect(evaluateNativeHydrationFulfillment(expectation, readback(songs, 's1', 0))).toMatchObject({
    fulfilled: true,
    reason: 'fulfilled',
  });
  expect(evaluateNativeHydrationFulfillment(expectation, readback(songs, null, -1)).reason).toBe('active-id');
  expect(evaluateNativeHydrationFulfillment(expectation, readback(songs, 's2', 1)).reason).toBe('active-id');
  expect(evaluateNativeHydrationFulfillment(expectation, { ...readback(songs, 's1', 0), activeIndex: 1 }).reason)
    .toBe('active-index');
});

test('queue fulfillment requires the same normalized length and order', () => {
  const expectation = createNativeHydrationExpectation(createHydrationPlan(stored, songs));
  expect(evaluateNativeHydrationFulfillment(expectation, readback([songs[0]], 's1', 0)).reason).toBe('queue-length');
  expect(evaluateNativeHydrationFulfillment(expectation, readback([songs[1], songs[0]], 's1', 1)).reason)
    .toBe('queue-order');
});

test('empty clear expectation requires no active track and an empty queue', () => {
  const expectation = createNativeHydrationExpectation(createHydrationPlan({ ...stored, currentSongId: 'missing' }, songs));
  expect(evaluateNativeHydrationFulfillment(expectation, readback([], null, -1)).fulfilled).toBe(true);
  expect(evaluateNativeHydrationFulfillment(expectation, readback(songs, 's1', 0)).fulfilled).toBe(false);
  expect(evaluateNativeHydrationFulfillment(expectation, { ...readback([], null, -1), activeIndex: 0 }).reason)
    .toBe('active-index');
});

test('current-song-less no-op expectation leaves the active track unspecified', () => {
  const plan = createHydrationPlan({ ...stored, currentSongId: null }, songs);
  const snapshot = {
    ...readback(songs, 's1', 0),
    nativeQueue: songs,
    baseQueue: songs,
    shuffleEnabled: false,
  };
  const expectation = createNativeHydrationExpectation(plan, snapshot);
  expect(expectation.active).toEqual({ kind: 'unspecified' });
  expect(evaluateNativeHydrationFulfillment(expectation, readback(songs, null, -1)).fulfilled).toBe(true);
  expect(evaluateNativeHydrationFulfillment(expectation, readback(songs, 's2', 1)).fulfilled).toBe(true);
});
