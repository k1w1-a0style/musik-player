import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from './libraryTabs';
import { libraryImportMessages, metadataRefreshSummary } from './libraryImportMessages';
import { mergeSongs } from './libraryPresentation';

interface LibraryAlertMessage {
  title: string;
  message: string;
}

interface ImportedSongsUpdate {
  songs: Song[];
  activeTab: LibraryTab;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const shouldImportFromScanFolders = (activeFolders: ScanFolder[], platformOs: string): boolean =>
  activeFolders.length > 0 && platformOs === 'android';

export const hasImportErrors = (errors: readonly unknown[] | undefined): boolean =>
  (errors?.length ?? 0) > 0;

export const hasMediaLibraryPermission = (status: string): boolean =>
  status === 'granted';

export const getMediaLibraryPermissionDeniedAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.permissionRequiredTitle,
  message: libraryImportMessages.permissionRequiredMessage,
});

export const hasMediaLibraryCandidates = (count: number): boolean =>
  count > 0;

export const getEmptyMediaLibraryImportAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.noMusicFoundTitle,
  message: libraryImportMessages.noMatchingMusicMessage,
});

export const getPartialScanImportAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.partiallyImportedTitle,
  message: libraryImportMessages.partiallyImportedMessage,
});

export const hasSongsForMetadataRefresh = (count: number): boolean =>
  count > 0;

export const shouldApplyMetadataRefresh = (updated: number): boolean =>
  updated > 0;

export const getNoSongsMetadataAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.noSongsTitle,
  message: libraryImportMessages.noSongsMetadataMessage,
});

export const getMetadataRefreshCompleteAlert = (updated: number, skipped: number, failed: number): LibraryAlertMessage => ({
  title: libraryImportMessages.metadataUpdatedTitle,
  message: metadataRefreshSummary(updated, skipped, failed),
});

export const getImportStoppedAlert = (error: unknown): LibraryAlertMessage => ({
  title: libraryImportMessages.importStoppedTitle,
  message: getErrorMessage(error, libraryImportMessages.importFallbackError),
});

export const getMetadataUpdateStoppedAlert = (error: unknown): LibraryAlertMessage => ({
  title: libraryImportMessages.metadataUpdateStoppedTitle,
  message: getErrorMessage(error, libraryImportMessages.metadataUpdateFallbackError),
});

export const buildImportedSongsUpdate = (existingSongs: Song[], importedSongs: Song[]): ImportedSongsUpdate => ({
  songs: mergeSongs(existingSongs, importedSongs),
  activeTab: 'tracks',
});

export const getEmptyScanImportAlert = (errors: readonly unknown[] | undefined): LibraryAlertMessage => {
  if (hasImportErrors(errors)) {
    return {
      title: libraryImportMessages.scanFailedTitle,
      message: libraryImportMessages.scanFailedMessage,
    };
  }

  return {
    title: libraryImportMessages.noMusicFoundTitle,
    message: libraryImportMessages.noAudioInScanFoldersMessage,
  };
};
