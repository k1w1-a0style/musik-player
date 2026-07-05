import type { HydrationPlan } from './musicHydrationPlan';

export interface EmptyPlayableQueueHydrationContext {
  restoredQueueCount: number;
  librarySongCount: number;
  playableQueueCount: number;
  nativeQueueAction: HydrationPlan['nativeQueueAction'];
  reason: 'empty-library' | 'no-playable-uris';
}

/**
 * A hydration that produces no playable songs is only considered legitimate
 * when the library itself is empty. In that case first-launch / cleared-library
 * flows should log at info level rather than triggering the warning path.
 */
export const isEmptyPlayableQueueLegitimate = (plan: HydrationPlan): boolean =>
  plan.hydratedSongs.length === 0 && plan.hydratedQueue.length === 0;

export const buildEmptyPlayableQueueHydrationContext = (
  plan: HydrationPlan,
): EmptyPlayableQueueHydrationContext => ({
  restoredQueueCount: plan.hydratedQueue.length,
  librarySongCount: plan.hydratedSongs.length,
  playableQueueCount: plan.playableQueue.length,
  nativeQueueAction: plan.nativeQueueAction,
  reason: plan.hydratedSongs.length === 0 ? 'empty-library' : 'no-playable-uris',
});
