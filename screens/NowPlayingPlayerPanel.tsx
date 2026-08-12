import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Song } from '../types/Song';
import NowPlayingBottomControlsRow from './NowPlayingBottomControlsRow';
import NowPlayingCoverArtwork from './NowPlayingCoverArtwork';
import NowPlayingPlaybackSection from './NowPlayingPlaybackSection';
import NowPlayingTitleRow from './NowPlayingTitleRow';

interface NowPlayingPlayerPanelProps {
  currentSong: Song | null;
  previousSong?: Song | null;
  nextSong?: Song | null;
  artworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
  isPlaying: boolean;
  accent: string;
  coverAreaHeight: number;
  coverSize: number;
  favorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
  onSeek: (position: number) => Promise<void>;
  progressAccent: string;
  progressAccentDark: string;
  foregroundOnAccent: string;
  volume: number;
  onVolumeChange: (value: number) => Promise<void>;
  bottomInset: number;
  onOpenTrackInfo: () => void;
  onSwipeToNext?: () => void;
  onSwipeToPrevious?: () => void;
  canSwipeToNext?: boolean;
  canSwipeToPrevious?: boolean;
}

const NowPlayingPlayerPanel: React.FC<NowPlayingPlayerPanelProps> = ({
  currentSong,
  previousSong,
  nextSong,
  artworkUri,
  previousArtworkUri,
  nextArtworkUri,
  isPlaying,
  accent,
  coverAreaHeight,
  coverSize,
  favorite,
  favoritePending,
  onToggleFavorite,
  onSeek,
  progressAccent,
  progressAccentDark,
  foregroundOnAccent,
  volume,
  onVolumeChange,
  bottomInset,
  onOpenTrackInfo,
  onSwipeToNext,
  onSwipeToPrevious,
  canSwipeToNext = false,
  canSwipeToPrevious = false,
}) => (
  <View style={styles.playerPage} testID="now-playing-player-panel">
    <View style={[styles.coverArea, { height: coverAreaHeight }]}> 
      <NowPlayingCoverArtwork
        song={currentSong}
        previousSong={previousSong}
        nextSong={nextSong}
        artworkUri={artworkUri}
        previousArtworkUri={previousArtworkUri}
        nextArtworkUri={nextArtworkUri}
        isPlaying={isPlaying}
        accent={accent}
        coverSize={coverSize}
        swipeEnabled={Boolean(currentSong && (onSwipeToNext || onSwipeToPrevious))}
        onSwipeLeft={onSwipeToNext}
        onSwipeRight={onSwipeToPrevious}
        canSwipeLeft={canSwipeToNext}
        canSwipeRight={canSwipeToPrevious}
      />
    </View>

    <View style={styles.fixedControlsArea}>
      <NowPlayingTitleRow
        currentSong={currentSong}
        favorite={favorite}
        favoritePending={favoritePending}
        onToggleFavorite={onToggleFavorite}
      />

      <NowPlayingPlaybackSection
        currentSong={currentSong}
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
        accentColor={progressAccent}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  playerPage: { flex: 1, justifyContent: 'space-between' },
  coverArea: { alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  fixedControlsArea: { width: '100%' },
});

export default React.memo(NowPlayingPlayerPanel);
