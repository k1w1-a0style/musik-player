import { useTrackInfoActions } from './useTrackInfoActions';
import { useTrackInfoCoverState } from './useTrackInfoCoverState';
import { useTrackInfoDerivedState } from './useTrackInfoDerivedState';
import { useTrackInfoSong } from './useTrackInfoSong';

export const useTrackInfoScreenState = () => {
  const { song, songsRef, setSongs, isReady } = useTrackInfoSong();
  const coverState = useTrackInfoCoverState(song);
  const { importedAt } = useTrackInfoDerivedState(song);
  const actions = useTrackInfoActions({ song, songsRef, setSongs });

  return {
    song,
    isReady,
    coverUri: coverState.coverUri,
    coverStatus: coverState.coverStatus,
    coverDimensions: coverState.coverDimensions,
    importedAt,
    coverFailed: coverState.coverFailed,
    setCoverFailed: coverState.setCoverFailed,
    openTagEditor: actions.openTagEditor,
    removeFromLibrary: actions.removeFromLibrary,
  };
};
