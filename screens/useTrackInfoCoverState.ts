import { useEffect, useState } from 'react';
import type { Song } from '../types/Song';
import {
  getTrackInfoCoverStatus,
  getTrackInfoCoverUri,
} from './trackInfoHelpers';

export const useTrackInfoCoverState = (song?: Song) => {
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [song?.id, song?.cover]);

  const coverUri = song ? getTrackInfoCoverUri(song) : undefined;
  const coverStatus = song ? getTrackInfoCoverStatus(song, coverUri) : 'none';

  return {
    coverUri,
    coverStatus,
    coverFailed,
    setCoverFailed,
  };
};
