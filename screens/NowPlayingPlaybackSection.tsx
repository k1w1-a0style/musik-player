import React from 'react';
import Controls from '../components/Controls';
import WaveformScrubber from '../components/WaveformScrubber';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useSongWaveform } from '../hooks/useSongWaveform';
import type { Song } from '../types/Song';
import { DEFAULT_APP_APPEARANCE } from '../utils/appTheme';
import { getNowPlayingWaveformRestColor } from '../utils/appThemeOverlays';
import CrossfadeLayers from '../components/CrossfadeLayers';

interface NowPlayingPlaybackSectionProps {
  currentSong: Song | null;
  onSeek: (position: number) => Promise<void>;
  progressAccent: string;
  progressAccentDark: string;
  foregroundOnAccent: string;
}

interface PlaybackWaveformProps extends Pick<NowPlayingPlaybackSectionProps,
  'currentSong' | 'onSeek' | 'progressAccent'> {
  restColor: string;
}

const PlaybackWaveform = React.memo(({ currentSong, onSeek, progressAccent,
  restColor }: PlaybackWaveformProps) => {
  const { position, duration } = usePlaybackProgress();
  const { waveform, waveformReady } = useSongWaveform({ song: currentSong, durationMs: duration });

  return <CrossfadeLayers value={{ accent: progressAccent, restColor }}
    valueKey={`${progressAccent}|${restColor}`} testID="waveform-color-transition"
    renderLayer={colors => (
      <WaveformScrubber waveform={waveform} ready={waveformReady}
        currentPosition={position} duration={duration}
        onSeek={onSeek} accent={colors.accent} restColor={colors.restColor} />
    )} />;
});

PlaybackWaveform.displayName = 'NowPlayingPlaybackWaveform';

const NowPlayingPlaybackSection: React.FC<NowPlayingPlaybackSectionProps> = ({
  currentSong,
  onSeek,
  progressAccent,
  progressAccentDark,
  foregroundOnAccent,
}) => {
  const appTheme = useOptionalAppTheme();
  const waveformRestColor = getNowPlayingWaveformRestColor(appTheme?.appearance ?? DEFAULT_APP_APPEARANCE);

  return (
    <>
      <PlaybackWaveform currentSong={currentSong} onSeek={onSeek}
        progressAccent={progressAccent} restColor={waveformRestColor} />
      <Controls
        accentColor={progressAccent}
        accentDarkColor={progressAccentDark}
        onAccentColor={foregroundOnAccent}
      />
    </>
  );
};

export default React.memo(NowPlayingPlaybackSection);
