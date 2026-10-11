import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryAlertCopy } from '../hooks/useLibraryAlerts';
import { getLibraryScanOperation, setLibraryScanFolderWarning } from './libraryScanOperation';
import { isAbortError, throwIfAborted, withTimeout } from './withTimeout';

const MESSAGE = 'Die Titel bleiben in der Bibliothek. Der Ordnerstatus konnte nicht bestätigt gespeichert werden. Wiederhole nur das Speichern über „Ordnerdaten erneut speichern“ im Scan-Ergebnis.';

/** Observer timeouts never release ownership of the real folder write. */
export const persistLibraryScanFolders = async (
  persist: (updates: ScanFolder[] | undefined) => Promise<void>,
  updates: ScanFolder[] | undefined,
  options: { scanId?: number; signal: AbortSignal; timeoutMs: number; showAlert: (alert: LibraryAlertCopy) => void },
): Promise<void> => {
  let inFlight = false;
  let warned = false;
  const publishWarning = (): void => setLibraryScanFolderWarning(options.scanId,
    { message: MESSAGE, retrying: inFlight, retry });
  const run = async (signal?: AbortSignal): Promise<void> => {
    throwIfAborted(signal);
    inFlight = true;
    if (warned) publishWarning();
    const rawWrite = Promise.resolve().then(() => persist(updates));
    // Keep Retry disabled until the actual provider settles, including after timeout.
    void rawWrite.then(() => {
      inFlight = false;
      setLibraryScanFolderWarning(options.scanId);
    }, () => {
      inFlight = false;
      if (warned) publishWarning();
    });
    try {
      await withTimeout(rawWrite, options.timeoutMs,
        'Ordnerdaten werden noch gespeichert; der tatsächliche Schreibvorgang läuft weiter.', { signal });
    } catch (error) {
      if (isAbortError(error)) throw error;
      warned = true;
      publishWarning();
      console.warn('[Import] Folder state was not confirmed; saved songs are retained.', error);
      options.showAlert({ title: 'Bibliothek gespeichert – Ordnerdaten fehlen', message: MESSAGE });
    }
  };
  async function retry(): Promise<void> {
    const scan = getLibraryScanOperation();
    if (inFlight || scan.id !== options.scanId || scan.status === 'running' || scan.status === 'idle') return;
    await run();
  }
  await run(options.signal);
};
