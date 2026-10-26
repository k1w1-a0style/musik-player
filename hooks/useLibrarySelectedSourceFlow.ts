import { describeAudioReadFailure } from '../utils/mediaLibraryReadAccess';
import { useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { AudioPermissionQuery } from '../utils/mediaLibraryReadAccess';
import { resolveAutomaticLibrarySource } from '../utils/automaticLibrarySources';
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

export const useLibrarySelectedSourceFlow = ({ songs, songImport, scanFolders, importFromMediaLibrary, importFromScanFolders, getPermissions = MediaLibrary.getPermissionsAsync }: {
  getPermissions?: AudioPermissionQuery;
  songs: Song[]; songImport?: SongImportController; scanFolders: ScanFolder[];
  importFromMediaLibrary: ReturnType<typeof useLibraryMediaLibraryImportFlow>['importFromMediaLibrary'];
  importFromScanFolders: ReturnType<typeof useLibraryScanFolderImportFlow>['importFromScanFolders'];
}) => useCallback(async (generation: ImportGeneration, source: LibraryScanSource, copy: LibraryImportFlowCopy,
  options?: LibraryScanRequest & { folders?: ScanFolder[] }): Promise<Song[]> => {
  const activeFolders = getEnabledScanFolders(options?.folders ?? scanFolders);
  const selected = source === 'auto' ? await resolveAutomaticLibrarySource(activeFolders.length > 0,
    getPermissions, Boolean(generation.automatic), { signal: generation.controller.signal,
      onFailure: message => recordLibraryScanSourceFailure(generation.scanOperationId, message) }) : source;
  return runSelectedLibrarySources({ source: selected, signal: generation.controller.signal,
    beginSource: () => beginLibraryScanSource(generation.scanOperationId),
    onSourceFailure: error => recordLibraryScanSourceFailure(generation.scanOperationId, describeAudioReadFailure(error, generation.audioReadVerified, getImportStoppedAlert(error).message)),
    media: () => importFromMediaLibrary(copy, generation, options?.refreshExisting ?? false, songImport?.getCurrent() ?? songs),
    folders: () => {
      if (!activeFolders.length) throw new Error('Keine aktiven Scan-Ordner. Bitte zuerst einen Musikordner hinzufügen.');
      return importFromScanFolders(activeFolders, generation, options?.refreshExisting ?? false, songImport?.getCurrent() ?? songs);
    },
  });
}, [getPermissions, importFromMediaLibrary, importFromScanFolders, scanFolders, songImport, songs]);
