import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryTab } from './libraryTabs';
import {
  libraryImportMessages,
  mediaCandidatesFoundStatus,
  metadataRefreshSummary,
  scanFoldersReadingStatus,
  tracksFoundStatus,
  tracksSavingStatus,
} from './libraryImportMessages';
import { mergeSongs } from './libraryPresentation';

interface LibraryAlertMessage {
  title: string;
  message: string;
}

interface ImportedSongsUpdate {
  songs: Song[];
  activeTab: LibraryTab;
}

interface ScanImportProgressCopy {
  readingStatus: string;
  foundStatus: string;
  timeoutMessage: string;
}

interface MediaLibraryImportProgressCopy {
  candidatesFoundStatus: string;
  savingStatus: string;
}

interface LibraryImportFlowCopy {
  preparingStatus: string;
  scanFoldersTimeoutMessage: string;
  scanningMediaLibraryStatus: string;
  mediaLibraryScanTimeoutMessage: string;
  importingMetadataAndCoversStatus: string;
  metadataImportTimeoutMessage: string;
}

interface MetadataRefreshFlowCopy {
  readingStatus: string;
  timeoutMessage: string;
}

interface DeniedMediaLibraryPermissionResult {
  kind: 'denied';
  alert: LibraryAlertMessage;
}

interface GrantedMediaLibraryPermissionResult {
  kind: 'granted';
}

type MediaLibraryPermissionResult = DeniedMediaLibraryPermissionResult | GrantedMediaLibraryPermissionResult;

interface EmptyScanImportResult {
  kind: 'empty';
  alert: LibraryAlertMessage;
}

interface SuccessfulScanImportResult {
  kind: 'success';
  update: ImportedSongsUpdate;
  partialAlert?: LibraryAlertMessage;
}

type ScanImportResult = EmptyScanImportResult | SuccessfulScanImportResult;

interface EmptyMediaLibraryCandidatesResult {
  kind: 'empty';
  alert: LibraryAlertMessage;
}

interface AvailableMediaLibraryCandidatesResult {
  kind: 'available';
}

type MediaLibraryCandidatesResult = EmptyMediaLibraryCandidatesResult | AvailableMediaLibraryCandidatesResult;

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

export const buildMediaLibraryPermissionResult = (status: string): MediaLibraryPermissionResult => {
  if (!hasMediaLibraryPermission(status)) {
    return {
      kind: 'denied',
      alert: getMediaLibraryPermissionDeniedAlert(),
    };
  }

  return { kind: 'granted' };
};

export const hasMediaLibraryCandidates = (count: number): boolean =>
  count > 0;

export const getEmptyMediaLibraryImportAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.noMusicFoundTitle,
  message: libraryImportMessages.noMatchingMusicMessage,
});

export const buildMediaLibraryCandidatesResult = (candidateCount: number): MediaLibraryCandidatesResult => {
  if (!hasMediaLibraryCandidates(candidateCount)) {
    return {
      kind: 'empty',
      alert: getEmptyMediaLibraryImportAlert(),
    };
  }

  return { kind: 'available' };
};

export const getPartialScanImportAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.partiallyImportedTitle,
  message: libraryImportMessages.partiallyImportedMessage,
});

export const getScanImportProgressCopy = (activeFolderCount: number, foundSongCount: number): ScanImportProgressCopy => ({
  readingStatus: scanFoldersReadingStatus(activeFolderCount),
  foundStatus: tracksFoundStatus(foundSongCount),
  timeoutMessage: libraryImportMessages.scanFoldersTimeout,
});

export const getMediaLibraryImportProgressCopy = (candidateCount: number, savedSongCount: number): MediaLibraryImportProgressCopy => ({
  candidatesFoundStatus: mediaCandidatesFoundStatus(candidateCount),
  savingStatus: tracksSavingStatus(savedSongCount),
});

export const getLibraryImportFlowCopy = (): LibraryImportFlowCopy => ({
  preparingStatus: libraryImportMessages.preparingImport,
  scanFoldersTimeoutMessage: libraryImportMessages.scanFoldersTimeout,
  scanningMediaLibraryStatus: libraryImportMessages.scanningMediaLibrary,
  mediaLibraryScanTimeoutMessage: libraryImportMessages.mediaLibraryScanTimeout,
  importingMetadataAndCoversStatus: libraryImportMessages.importingMetadataAndCovers,
  metadataImportTimeoutMessage: libraryImportMessages.metadataImportTimeout,
});

export const getMetadataRefreshFlowCopy = (): MetadataRefreshFlowCopy => ({
  readingStatus: libraryImportMessages.readingId3Metadata,
  timeoutMessage: libraryImportMessages.metadataRefreshTimeout,
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

export const buildScanImportResult = (
  existingSongs: Song[],
  importedSongs: Song[],
  errors: readonly unknown[] | undefined,
): ScanImportResult => {
  if (importedSongs.length === 0) {
    return {
      kind: 'empty',
      alert: getEmptyScanImportAlert(errors),
    };
  }

  return {
    kind: 'success',
    update: buildImportedSongsUpdate(existingSongs, importedSongs),
    ...(hasImportErrors(errors) ? { partialAlert: getPartialScanImportAlert() } : {}),
  };
};

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
