import type { Song } from '../types/Song';
import { isAbortError, throwIfAborted } from './withTimeout';

export type LibraryScanSource = 'media-library' | 'folders' | 'both';
export interface LibraryScanRequest { source?: LibraryScanSource; refreshExisting?: boolean; automatic?: boolean }

/** Only explicit "both" runs a second source; an unreadable source never causes a hidden fallback. */
export const runSelectedLibrarySources = async (options: {
  source: LibraryScanSource;
  signal: AbortSignal;
  media: () => Promise<Song[]>;
  folders: () => Promise<Song[]>;
  beginSource: () => void;
  onSourceFailure: (error: unknown) => void;
}): Promise<Song[]> => {
  const actions = options.source === 'both' ? [options.media, options.folders]
    : [options.source === 'folders' ? options.folders : options.media];
  const prepared: Song[] = [];
  for (const action of actions) {
    throwIfAborted(options.signal);
    options.beginSource();
    try { prepared.push(...await action()); }
    catch (error) {
      if (isAbortError(error) || options.signal.aborted || options.source !== 'both') throw error;
      options.onSourceFailure(error);
    }
  }
  return [...new Map(prepared.map(song => [song.id, song])).values()];
};
