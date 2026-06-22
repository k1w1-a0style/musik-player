import React from 'react';
import TrackInfoContent from './TrackInfoContent';
import TrackInfoNotFound from './TrackInfoNotFound';
import { useTrackInfoScreenState } from './useTrackInfoScreenState';

const TrackInfo: React.FC = () => {
  const {
    song,
    coverUri,
    coverStatus,
    coverDimensions,
    importedAt,
    coverFailed,
    setCoverFailed,
    openTagEditor,
    removeFromLibrary,
  } = useTrackInfoScreenState();

  if (!song) return <TrackInfoNotFound />;

  return (
    <TrackInfoContent
      song={song}
      coverUri={coverUri}
      coverStatus={coverStatus}
      coverDimensions={coverDimensions}
      importedAt={importedAt}
      coverFailed={coverFailed}
      onCoverError={() => setCoverFailed(true)}
      onOpenTagEditor={openTagEditor}
      onRemoveFromLibrary={removeFromLibrary}
    />
  );
};

export default TrackInfo;
