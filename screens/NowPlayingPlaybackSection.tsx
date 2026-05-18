import React from 'react';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';

interface NowPlayingPlaybackSectionProps {
  position: number;
  duration: number;
  onSeek: (position: number) => Promise<void>;
  progressAccent: string;
  progressAccentDark: string;
}

const NowPlayingPlaybackSection: React.FC<NowPlayingPlaybackSectionProps> = ({
  position,
  duration,
  onSeek,
  progressAccent,
  progressAccentDark,
}) => (
  <>
    <ProgressBar
      currentPosition={position}
      duration={duration}
      onSeek={onSeek}
      accent={progressAccent}
      accentDark={progressAccentDark}
    />
    <Controls />
  </>
);

export default NowPlayingPlaybackSection;
