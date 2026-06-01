import { useTrackInfoActions } from './useTrackInfoActions';
import { useTrackInfoCoverState } from './useTrackInfoCoverState';
import { useTrackInfoDerivedState } from './useTrackInfoDerivedState';
import { useTrackInfoSong } from './useTrackInfoSong';

export const useTrackInfoScreenState = () => {
  const { song, songsRef, setSongs } = useTrackInfoSong();
  const { coverUri, coverStatus, coverFailed, setCoverFailed } = useTrackInfoCoverState(song);
  const { importedAt } = useTrackInfoDerivedState(song);
  const { openTagEditor, removeFromLibrary } = useTrackInfoActions({
    song,
    songsRef,
    setSongs,
  });

  return {
    song,
    coverUri,
    coverStatus,
    importedAt,
    coverFailed,
    setCoverFailed,
    openTagEditor,
    removeFromLibrary,
  };
};
