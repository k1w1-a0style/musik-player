import React, { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import type { Song } from '../types/Song';
import { useCoverBassPulse } from '../hooks/useCoverBassPulse';

interface CoverBassPulseProps {
  children: React.ReactNode;
  song: Song | null | undefined;
  isPlaying: boolean;
  enabled: boolean;
}
type PulseScale = ReturnType<typeof useCoverBassPulse>;
const BassController = ({ song, isPlaying, onScale }: Omit<CoverBassPulseProps, 'children' | 'enabled'> & {
  onScale: (scale: PulseScale | number) => void;
}) => {
  const scale = useCoverBassPulse(song, isPlaying);
  useEffect(() => { onScale(scale); return () => onScale(1); }, [onScale, scale]);
  return null;
};

const CoverBassPulse = ({ children, song, isPlaying, enabled }: CoverBassPulseProps) => {
  const [scale, setScale] = useState<PulseScale | number>(1);
  // Keep the image's native ancestry unchanged when a neighbour becomes active.
  return <Animated.View style={{ transform: [{ scale }] }} testID="now-playing-cover-bass-pulse">
    {enabled ? <BassController song={song} isPlaying={isPlaying} onScale={setScale} /> : null}
    {children}
  </Animated.View>;
};
export default React.memo(CoverBassPulse);
