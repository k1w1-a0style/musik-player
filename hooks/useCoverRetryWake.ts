import { useEffect, useState } from 'react';
import type { Song } from '../types/Song';
import { nextCoverRetryAt } from '../utils/songCoverRetry';

/** One timer for the nearest eligible retry, active only while analysis is enabled. */
export const useCoverRetryWake = (songs: Song[]): number => {
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const deadline = nextCoverRetryAt(songs);
    if (deadline === undefined) return undefined;
    const delay = Math.max(1, Math.min(2_147_483_647, deadline - Date.now()));
    const timer = setTimeout(() => setWake(value => value + 1), delay);
    return () => clearTimeout(timer);
  }, [songs, wake]);
  return wake;
};
