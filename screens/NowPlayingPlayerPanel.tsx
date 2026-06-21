import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Song } from '../types/Song';
import NowPlayingBottomControlsRow from './NowPlayingBottomControlsRow';
import NowPlayingCoverArtwork from './NowPlayingCoverArtwork';
import NowPlayingPlaybackSection from './NowPlayingPlaybackSection';
import NowPlayingTitleRow from './NowPlayingTitleRow';

interface NowPlayingPlayerPanelProps {
  currentSong: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  accent: string;
  coverAreaHeight: number;
  coverSize: number;
  favorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
  position: number;
  duration: number;
  onSeek: (position: number) => Promise<void>;
  progressAccent: string;
  progressAccentDark: string;
  foregroundOnAccent: string;
  volume: number;
  onVolumeChange: (value: number) => Promise<void>;
  bottomInset: number;
  onOpenTrackInfo: () => void;
}

const NowPlayingPlayerPanel: React.FC<NowPlayingPlayerPanelProps> = ({
  currentSong,
  artworkUri,
  isPlaying,
  accent,
  coverAreaHeight,
  coverSize,
  favorite,
  favoritePending,
  onToggleFavorite,
  position,
  duration,
  onSeek,
  progressAccent,
  progressAccentDark,
  foregroundOnAccent,
  volume,
  onVolumeChange,
  bottomInset,
  onOpenTrackInfo,
}) => (
  <View style={styles.playerPage} testID="now-playing-player-panel">
    <View style={[styles.coverArea, { height: coverAreaHeight }]}> 
      <NowPlayingCoverArtwork
        song={currentSong}
        artworkUri={artworkUri}
        isPlaying={isPlaying}
        accent={accent}
        coverSize={coverSize}
      />
    </View>

    <NowPlayingTitleRow
      currentSong={currentSong}
      favorite={favorite}
      favoritePending={favoritePending}
      onToggleFavorite={onToggleFavorite}
    />

    <NowPlayingPlaybackSection
      currentSong={currentSong}
      position={position}
      duration={duration}
      onSeek={onSeek}
      progressAccent={progressAccent}
      progressAccentDark={progressAccentDark}
      foregroundOnAccent={foregroundOnAccent}
    />

    <NowPlayingBottomControlsRow
      volume={volume}
      onVolumeChange={onVolumeChange}
      bottomInset={bottomInset}
      onOpenTrackInfo={onOpenTrackInfo}
    />
  </View>
);

const styles = StyleSheet.create({
  playerPage: { flex: 1 },
  coverArea: { alignItems: 'center', justifyContent: 'center', marginTop: 0 },
});

export default NowPlayingPlayerPanel;
