import { MediaLibraryReadAccessError, type AudioPermissionQuery } from './mediaLibraryReadAccess';
import type { LibraryScanSource } from './libraryScanSources';

/** A SAF grant never implies a MediaStore grant. Do not prompt to scan a source
 * which the user has not authorized when another source is already usable. */
export const resolveAutomaticLibrarySource = async (hasFolders: boolean, get: AudioPermissionQuery,
  automatic: boolean): Promise<LibraryScanSource> => {
  const permission = await get(false, ['audio']).catch(() => ({ status: 'unknown' }));
  if (permission.status === 'granted') return hasFolders ? 'both' : 'media-library';
  if (hasFolders) return 'folders';
  if (!automatic) return 'media-library';
  throw new MediaLibraryReadAccessError();
};
