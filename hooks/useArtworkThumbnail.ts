import { useEffect, useState } from 'react';
import { requestArtworkThumbnail } from '../utils/artworkThumbnailRequests';

/** Optional, bounded display optimization. Originals remain the immediate fallback. */
export const useArtworkThumbnail = (uri?: string, pixelSize = 128, revision = ''): string | undefined => {
  const [thumbnail, setThumbnail] = useState<{ key: string; uri: string } | null>(null);
  const key = JSON.stringify([uri, pixelSize, revision]);
  useEffect(() => {
    let active = true;
    if (uri?.startsWith('file://')) {
      void requestArtworkThumbnail(uri, pixelSize, revision).then(value => {
        if (active && value) setThumbnail({ key, uri: value });
      }).catch(() => { /* The source cover remains available. */ });
    }
    return () => { active = false; };
  }, [key, pixelSize, revision, uri]);
  return thumbnail?.key === key ? thumbnail.uri : uri;
};
