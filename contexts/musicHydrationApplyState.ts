import type { HydrationPlan } from './musicHydrationPlan';
import type { HydrateStoredSongsArgs } from './musicHydrationTypes';

export const applyHydratedSongsState = (
  plan: HydrationPlan,
  { songsRef, setSongsState }: Pick<HydrateStoredSongsArgs, 'songsRef' | 'setSongsState'>,
): void => {
  songsRef.current = plan.hydratedSongs;
  setSongsState(plan.hydratedSongs);
};
