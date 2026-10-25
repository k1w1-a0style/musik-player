import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { useLibraryAudioInfoBackfill } from './useLibraryAudioInfoBackfill';
import { useLibraryCoverBackfill } from './useLibraryCoverBackfill';
import { useLibraryWaveformPreload } from './useLibraryWaveformPreload';
import { useAutomaticLibraryUpdate } from './useAutomaticLibraryUpdate';
import type { ScanFolder } from '../types/ScanFolder';
import type { LibraryScanRequest } from '../utils/libraryScanSources';

export const useLibraryBackgroundAnalysis = ({ songs, applySongMetadataPatches, isReady, isPlaying, loading,
  scanFolders = [], foldersHydrated = false, update }: {
  songs: Song[];
  applySongMetadataPatches: (patches: SongMetadataPatchesById) => void;
  isReady: boolean;
  isPlaying: boolean;
  loading: boolean;
  scanFolders?: ScanFolder[];
  foldersHydrated?: boolean;
  update?: (options?: LibraryScanRequest) => Promise<void>;
}): void => {
  const enabled = isReady && !isPlaying && !loading;
  useLibraryCoverBackfill({ songs, applySongMetadataPatches, enabled });
  useLibraryAudioInfoBackfill({ songs, applySongMetadataPatches, enabled });
  useLibraryWaveformPreload(songs, enabled);
  useAutomaticLibraryUpdate({ ready: isReady && foldersHydrated, busy: loading,
    hasFolders: scanFolders.some(folder => folder.enabled), update: update ?? noUpdate });
};
const noUpdate = async (): Promise<void> => undefined;
