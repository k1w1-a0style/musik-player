import type { ImportFileProgress } from './libraryImportProgress';

export const IMPORT_UI_INTERVAL_MS = 650;
export const IMPORT_UI_BATCH_SIZE = 200;

/** Metadata progress stays live internally; React receives bounded publications. */
export const createImportUiPublisher = (options: {
  isActive: () => boolean;
  publishSongs: () => void;
  publishProgress: (progress: ImportFileProgress) => void;
}) => {
  let songs = 0;
  let progress: ImportFileProgress | undefined;
  let firstSong = true;
  let firstProgress = true;
  let lastPublishedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (): void => {
    clearTimeout(timer); timer = undefined;
    if (!options.isActive()) return;
    if (songs) { options.publishSongs(); songs = 0; firstSong = false; }
    if (progress) { options.publishProgress(progress); progress = undefined; firstProgress = false; }
    lastPublishedAt = Date.now();
  };
  const schedule = (): void => {
    if (Date.now() - lastPublishedAt >= IMPORT_UI_INTERVAL_MS) flush();
    else timer ??= setTimeout(flush, IMPORT_UI_INTERVAL_MS - (Date.now() - lastPublishedAt));
  };
  return {
    accepted: (count: number): void => {
      if (!options.isActive()) return;
      songs += count;
      if (firstSong || songs >= IMPORT_UI_BATCH_SIZE) flush();
      else schedule();
    },
    progress: (next: ImportFileProgress): void => {
      if (!options.isActive()) return;
      progress = next;
      if (firstProgress || next.processed === next.total) flush();
      else schedule();
    },
    flush,
    cancel: (): void => { clearTimeout(timer); timer = undefined; },
  };
};
