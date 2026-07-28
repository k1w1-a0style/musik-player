import type { Song } from '../types/Song';
import type { HydrationPlan } from './musicHydrationPlan';
import type { NativeQueueMutationSnapshot, NativeQueueReadback } from './nativeQueueRecovery';

export type ActiveTrackExpectation =
  | { kind: 'exact'; songId: string; index: number }
  | { kind: 'none' }
  | { kind: 'unspecified' };

export interface NativeHydrationExpectation { queueIds: string[]; active: ActiveTrackExpectation }
export interface NativeHydrationFulfillment {
  fulfilled: boolean; reason: 'fulfilled' | 'queue-length' | 'queue-order' | 'active-id' | 'active-index';
  expectedQueueIds: string[]; actualQueueIds: string[]; expectedActiveId: string | null | undefined;
  actualActiveId: string | null; expectedActiveIndex: number | undefined; actualActiveIndex: number;
}

const id = (value: unknown): string => String(value ?? '').trim();
const queueIds = (songs: Song[]): string[] => songs.map(song => id(song.id));

export const createNativeHydrationExpectation = (
  plan: HydrationPlan,
  snapshot?: NativeQueueMutationSnapshot,
): NativeHydrationExpectation => {
  if (plan.nativeQueueAction === 'clear' || plan.nativeQueueAction === 'clearMalformedCurrent') {
    return { queueIds: [], active: { kind: 'none' } };
  }
  if (plan.nativeQueueAction === 'none') {
    const snapshotIds = snapshot ? queueIds(snapshot.queue) : queueIds(plan.playableQueue);
    return { queueIds: snapshotIds, active: plan.resolvedCurrentSongId
      ? { kind: 'exact', songId: id(plan.resolvedCurrentSongId), index: snapshotIds.indexOf(id(plan.resolvedCurrentSongId)) }
      : { kind: 'unspecified' } };
  }
  const expectedIds = queueIds(plan.playableQueue);
  const currentId = id(plan.resolvedCurrentSongId);
  return { queueIds: expectedIds, active: currentId
    ? { kind: 'exact', songId: currentId, index: expectedIds.indexOf(currentId) }
    : { kind: 'none' } };
};

export const evaluateNativeHydrationFulfillment = (
  expectation: NativeHydrationExpectation,
  readback: NativeQueueReadback,
): NativeHydrationFulfillment => {
  const actualQueueIds = queueIds(readback.queue);
  const actualActiveId = readback.activeTrackId ? id(readback.activeTrackId) : null;
  const expectedActiveId = expectation.active.kind === 'exact' ? expectation.active.songId
    : expectation.active.kind === 'none' ? null : undefined;
  const expectedActiveIndex = expectation.active.kind === 'exact' ? expectation.active.index
    : expectation.active.kind === 'none' ? -1 : undefined;
  let reason: NativeHydrationFulfillment['reason'] = 'fulfilled';
  if (actualQueueIds.length !== expectation.queueIds.length) reason = 'queue-length';
  else if (actualQueueIds.some((value, index) => value !== expectation.queueIds[index])) reason = 'queue-order';
  else if (expectedActiveId !== undefined && actualActiveId !== expectedActiveId) reason = 'active-id';
  else if (expectedActiveIndex !== undefined && readback.activeIndex !== expectedActiveIndex) reason = 'active-index';
  return { fulfilled: reason === 'fulfilled', reason, expectedQueueIds: expectation.queueIds,
    actualQueueIds, expectedActiveId, actualActiveId, expectedActiveIndex, actualActiveIndex: readback.activeIndex };
};
