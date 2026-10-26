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
  const cancellation = useRef(0);
  const selectionSequence = useRef(0);
  const latestSelection = useRef(new Map<string, number>());
  latestFolders.current = folders;
  useEffect(() => {
    if (lifetime.current.signal.aborted) lifetime.current = new AbortController();
    const controller = lifetime.current;
    const initial = getLibraryScanOperation();
    let cancelledId = initial.status === 'cancelled' ? initial.id : -1;
    const unsubscribe = subscribeLibraryScanOperation(() => {
      const operation = getLibraryScanOperation();
      if (operation.status === 'cancelled' && operation.id !== cancelledId) {
        cancelledId = operation.id; cancellation.current++;
      }
    });
    return () => { controller.abort(); unsubscribe(); };
  }, []);
  return useCallback((folder: ScanFolder): Promise<void> => {
    const signal = lifetime.current.signal;
    const epoch = cancellation.current;
    const ticket = ++selectionSequence.current;
    latestSelection.current.set(folder.uri, ticket);
    const isCurrent = () => !signal.aborted && cancellation.current === epoch
      && latestSelection.current.get(folder.uri) === ticket;
    const task = queue.current.catch(() => undefined).then(async () => {
      while (isCurrent() && getLibraryScanOperation().status === 'running') await waitForScanIdle(signal);
      if (!isCurrent() || latestFolders.current.some(current => current.uri === folder.uri
        && current.addedAt === folder.addedAt && current.removed)) return;
      await action.current?.({ folders: [folder], refreshExisting: false, automatic: true });
    });
    queue.current = task;
    return task.finally(() => {
      if (latestSelection.current.get(folder.uri) === ticket) latestSelection.current.delete(folder.uri);
    });
  }, [action]);
};
