import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ScanFolder } from '../types/ScanFolder';
import type { UseLibraryImportActionsResult } from './libraryImportActionTypes';
import { getLibraryScanOperation, subscribeLibraryScanOperation } from '../utils/libraryScanOperation';

const waitForScanIdle = (signal: AbortSignal): Promise<void> => new Promise(resolve => {
  const check = () => {
    if (!signal.aborted && getLibraryScanOperation().status === 'running') return;
    unsubscribe(); signal.removeEventListener('abort', check); resolve();
  };
  const unsubscribe = subscribeLibraryScanOperation(check);
  signal.addEventListener('abort', check, { once: true });
  check();
});

/** Explicit folder selections must survive an already active automatic scan,
 * independently of the user's optional lifecycle-update preferences. */
export const useLibraryAddedFolderScan = (
  action: RefObject<UseLibraryImportActionsResult['importFromDevice'] | null>, folders: ScanFolder[],
): ((folder: ScanFolder) => Promise<void>) => {
  const lifetime = useRef(new AbortController());
  const queue = useRef(Promise.resolve());
  const latestFolders = useRef(folders);
  latestFolders.current = folders;
  useEffect(() => {
    if (lifetime.current.signal.aborted) lifetime.current = new AbortController();
    const controller = lifetime.current;
    return () => controller.abort();
  }, []);
  return useCallback((folder: ScanFolder): Promise<void> => {
    const signal = lifetime.current.signal;
    const selectedDuringScan = getLibraryScanOperation().status === 'running';
    const task = queue.current.catch(() => undefined).then(async () => {
      while (!signal.aborted && getLibraryScanOperation().status === 'running') await waitForScanIdle(signal);
      if (signal.aborted || (selectedDuringScan && getLibraryScanOperation().status === 'cancelled')
        || latestFolders.current.some(current => current.uri === folder.uri
        && current.addedAt === folder.addedAt && current.removed)) return;
      await action.current?.({ folders: [folder], refreshExisting: false, automatic: true });
    });
    queue.current = task;
    return task;
  }, [action]);
};
