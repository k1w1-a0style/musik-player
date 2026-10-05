import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { Song } from '../types/Song';
import { useCoverBassPulse } from '../hooks/useCoverBassPulse';

interface CoverBassPulseProps {
  children: React.ReactNode;
  song: Song | null | undefined;
  isPlaying: boolean;
  enabled: boolean;
}
const BassController = ({ song, isPlaying, scale }: Omit<CoverBassPulseProps, 'children' | 'enabled'> & {
  scale: Animated.Value;
}) => { useCoverBassPulse(song, isPlaying, scale); return null; };

const CoverBassPulse = ({ children, song, isPlaying, enabled }: CoverBassPulseProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!enabled) { scale.stopAnimation(); scale.setValue(1); } }, [enabled, scale]);
  // Keep the image's native ancestry unchanged when a neighbour becomes active.
  return <Animated.View style={{ transform: [{ scale }] }} testID="now-playing-cover-bass-pulse">
    {enabled ? <BassController song={song} isPlaying={isPlaying} scale={scale} /> : null}
    {children}
  </Animated.View>;
};
export default React.memo(CoverBassPulse);
