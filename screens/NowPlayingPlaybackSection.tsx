import React from 'react';
import Controls from '../components/Controls';
import WaveformScrubber from '../components/WaveformScrubber';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { useSongWaveform } from '../hooks/useSongWaveform';
import type { Song } from '../types/Song';
import { DEFAULT_APP_APPEARANCE } from '../utils/appTheme';
import { getNowPlayingWaveformRestColor } from '../utils/appThemeOverlays';

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
  const appTheme = useOptionalAppTheme();
  const waveformRestColor = getNowPlayingWaveformRestColor(appTheme?.appearance ?? DEFAULT_APP_APPEARANCE);

  return (
    <>
      <WaveformScrubber
        waveform={waveform}
        currentPosition={position}
        duration={duration}
        onSeek={onSeek}
        accent={progressAccent}
        restColor={waveformRestColor}
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
