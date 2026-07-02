import React from 'react';
import Controls from '../components/Controls';
import WaveformScrubber from '../components/WaveformScrubber';
import { useSongWaveform } from '../hooks/useSongWaveform';
import type { Song } from '../types/Song';

interface NowPlayingPlaybackSectionProps {
  currentSong: Song | null;
  position: number;
  duration: number;
  onSeek: (position: number) => Promise<void>;
  progressAccent: string;
  progressAccentDark: string;
  foregroundOnAccent: string;
}

const NowPlayingPlaybackSection: React.FC<NowPlayingPlaybackSectionProps> = ({
  currentSong,
  position,
  duration,
  onSeek,
  progressAccent,
  progressAccentDark,
  foregroundOnAccent,
}) => {
  const { waveform } = useSongWaveform({ song: currentSong, durationMs: duration });

  return (
    <>
      <WaveformScrubber
        waveform={waveform}
        currentPosition={position}
        duration={duration}
        onSeek={onSeek}
        accent={progressAccent}
        restColor="rgba(255,255,255,0.22)"
      />
      <Controls
        accentColor={progressAccent}
        accentDarkColor={progressAccentDark}
        onAccentColor={foregroundOnAccent}
      />
    </>
  );
};

export default NowPlayingPlaybackSection;
