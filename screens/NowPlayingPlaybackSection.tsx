import React from 'react';
import Controls from '../components/Controls';
import ProgressBar from '../components/ProgressBar';

interface NowPlayingPlaybackSectionProps {
  position: number;
  duration: number;
  onSeek: (position: number) => Promise<void>;
  progressAccent: string;
  progressAccentDark: string;
  foregroundOnAccent: string;
}

const NowPlayingPlaybackSection: React.FC<NowPlayingPlaybackSectionProps> = ({
  position,
  duration,
  onSeek,
  progressAccent,
  progressAccentDark,
  foregroundOnAccent,
}) => (
  <>
    <ProgressBar
      currentPosition={position}
      duration={duration}
      onSeek={onSeek}
      onSeekPreview={onSeek}
      accent={progressAccent}
      accentDark={progressAccentDark}
    />
    <Controls
      accentColor={progressAccent}
      accentDarkColor={progressAccentDark}
      onAccentColor={foregroundOnAccent}
    />
  </>
);

export default NowPlayingPlaybackSection;
