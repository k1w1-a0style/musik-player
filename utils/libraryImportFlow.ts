import type { ScanFolder } from '../types/ScanFolder';
import { libraryImportMessages } from './libraryImportMessages';

interface LibraryAlertMessage {
  title: string;
  message: string;
}

export const shouldImportFromScanFolders = (activeFolders: ScanFolder[], platformOs: string): boolean =>
  activeFolders.length > 0 && platformOs === 'android';

export const hasImportErrors = (errors: readonly unknown[] | undefined): boolean =>
  (errors?.length ?? 0) > 0;

export const hasMediaLibraryCandidates = (count: number): boolean =>
  count > 0;

export const getEmptyMediaLibraryImportAlert = (): LibraryAlertMessage => ({
  title: libraryImportMessages.noMusicFoundTitle,
  message: libraryImportMessages.noMatchingMusicMessage,
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
