import { withTimeout, throwIfAborted, isAbortError } from './withTimeout';
import { DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS } from './libraryOperationTimeouts';
import { MediaLibraryReadAccessError, type AudioPermissionQuery } from './mediaLibraryReadAccess';
import type { LibraryScanSource } from './libraryScanSources';

/** A SAF grant never implies a MediaStore grant. Do not prompt to scan a source
 * which the user has not authorized when another source is already usable. */
export const resolveAutomaticLibrarySource = async (hasFolders: boolean, get: AudioPermissionQuery,
  automatic: boolean, options: { signal?: AbortSignal; onFailure?: (message: string) => void } = {}): Promise<LibraryScanSource> => {
  throwIfAborted(options.signal);
  const permission = await withTimeout(() => get(false, ['audio']), DEFAULT_LIBRARY_NATIVE_READ_TIMEOUT_MS,
    'Medienzugriff konnte nicht bestätigt werden.', { signal: options.signal }).catch(error => {
      if (isAbortError(error)) throw error;
      options.onFailure?.('Android-Medienzugriff konnte nicht geprüft werden. Freigegebene Ordner werden unabhängig verarbeitet.');
      return { status: 'unknown' };
    });
  throwIfAborted(options.signal);
  if (permission.status === 'granted') return hasFolders ? 'both' : 'media-library';
  if (hasFolders) return 'folders';
  if (!automatic) return 'media-library';
  throw new MediaLibraryReadAccessError();
};
