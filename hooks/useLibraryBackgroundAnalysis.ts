import type { Song } from '../types/Song';
import type { SongMetadataPatchesById } from '../contexts/useLibraryActions';
import { useLibraryAudioInfoBackfill } from './useLibraryAudioInfoBackfill';
import { useLibraryCoverBackfill } from './useLibraryCoverBackfill';
import { useLibraryWaveformPreload } from './useLibraryWaveformPreload';

export const useLibraryBackgroundAnalysis = ({ songs, applySongMetadataPatches, isReady, isPlaying, loading }: {
  songs: Song[];
  applySongMetadataPatches: (patches: SongMetadataPatchesById) => void;
  isReady: boolean;
  isPlaying: boolean;
  loading: boolean;
}): void => {
  const enabled = isReady && !isPlaying && !loading;
  useLibraryCoverBackfill({ songs, applySongMetadataPatches, enabled });
  useLibraryAudioInfoBackfill({ songs, applySongMetadataPatches, enabled });
  useLibraryWaveformPreload(songs, enabled);
};
