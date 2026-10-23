import { useCallback } from 'react';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { SongImportController } from '../contexts/songLibraryState';
import type { ImportGeneration, LibraryImportFlowCopy } from './libraryImportActionTypes';
import type { useLibraryMediaLibraryImportFlow } from './useLibraryMediaLibraryImportFlow';
import type { useLibraryScanFolderImportFlow } from './useLibraryScanFolderImportFlow';
import { getEnabledScanFolders } from '../utils/libraryScanFolders';
import { getImportStoppedAlert } from '../utils/libraryImportFlow';
import { runSelectedLibrarySources, type LibraryScanRequest, type LibraryScanSource } from '../utils/libraryScanSources';
import { beginLibraryScanSource, recordLibraryScanSourceFailure } from '../utils/libraryScanOperation';

export const useLibrarySelectedSourceFlow = ({ songs, songImport, scanFolders, importFromMediaLibrary, importFromScanFolders }: {
  songs: Song[]; songImport?: SongImportController; scanFolders: ScanFolder[];
  importFromMediaLibrary: ReturnType<typeof useLibraryMediaLibraryImportFlow>['importFromMediaLibrary'];
  importFromScanFolders: ReturnType<typeof useLibraryScanFolderImportFlow>['importFromScanFolders'];
}) => useCallback((generation: ImportGeneration, source: LibraryScanSource, copy: LibraryImportFlowCopy,
  options?: LibraryScanRequest & { folders?: ScanFolder[] }): Promise<Song[]> => {
  const activeFolders = getEnabledScanFolders(options?.folders ?? scanFolders);
  return runSelectedLibrarySources({ source, signal: generation.controller.signal,
    beginSource: () => beginLibraryScanSource(generation.scanOperationId),
    onSourceFailure: error => recordLibraryScanSourceFailure(generation.scanOperationId, getImportStoppedAlert(error).message),
    media: () => importFromMediaLibrary(copy, generation, options?.refreshExisting ?? false, songImport?.getCurrent() ?? songs),
    folders: () => {
      if (!activeFolders.length) throw new Error('Keine aktiven Scan-Ordner. Bitte zuerst einen Musikordner hinzufügen.');
      return importFromScanFolders(activeFolders, generation, options?.refreshExisting ?? false, songImport?.getCurrent() ?? songs);
    },
  });
}, [importFromMediaLibrary, importFromScanFolders, scanFolders, songImport, songs]);
