import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import type { Song } from '../types/Song';
import {
  getTrackInfoCoverStatus,
  getTrackInfoCoverUri,
} from './trackInfoHelpers';

export interface TrackInfoCoverDimensions {
  width?: number;
  height?: number;
}

const hasDimensions = (value: TrackInfoCoverDimensions): boolean =>
  Boolean(value.width && value.width > 0 && value.height && value.height > 0);

export const useTrackInfoCoverState = (song?: Song) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUri = song ? getTrackInfoCoverUri(song) : undefined;
  const coverStatus = song ? getTrackInfoCoverStatus(song, coverUri) : 'none';

  const storedDimensions = useMemo<TrackInfoCoverDimensions>(() => ({
    width: song?.coverInfo?.width,
    height: song?.coverInfo?.height,
  }), [song?.coverInfo?.height, song?.coverInfo?.width]);

  const [coverDimensions, setCoverDimensions] = useState<TrackInfoCoverDimensions>(storedDimensions);

  useEffect(() => {
    setCoverFailed(false);
  }, [song?.id, song?.cover, coverUri]);

  useEffect(() => {
    let mounted = true;
    setCoverDimensions(storedDimensions);

    if (!coverUri || hasDimensions(storedDimensions)) {
      return () => {
        mounted = false;
      };
    }

    Image.getSize(
      coverUri,
      (width, height) => {
        if (mounted) setCoverDimensions({ width, height });
      },
      () => {
        if (mounted) setCoverDimensions({});
      },
    );

    return () => {
      mounted = false;
    };
  }, [coverUri, storedDimensions]);

  return {
    coverUri,
    coverStatus,
    coverDimensions,
    coverFailed,
    setCoverFailed,
  };
};
