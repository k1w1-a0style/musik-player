import { publishImportFileProgress, type ImportFileProgress } from './libraryImportProgress';
import { updateLibraryScanProgress } from './libraryScanOperation';

export const createLibraryScanProgressCallbacks = (id: number | undefined) => ({
  onFileProgressSnapshot: (progress: ImportFileProgress): void => updateLibraryScanProgress(id, progress, false),
  onFileProgress: (progress: ImportFileProgress): void => {
    updateLibraryScanProgress(id, progress);
    publishImportFileProgress(progress);
  },
});
