import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { Song } from '../types/Song';
import { SOUNDCLOUD_PLAYER_COLORS } from '../utils/appThemeOverlays';
import { getArtworkSource, getSongArtworkUri } from '../utils/songArtwork';
import type { SoundCloudCarouselPageRole } from './soundCloudCarouselTypes';

interface SoundCloudCarouselPanelProps {
  song: Song | null;
  role: SoundCloudCarouselPageRole;
  artworkUri?: string;
  paused?: boolean;
  topInset?: number;
  bottomInset?: number;
}

/** A deliberately static full-panel artwork layer; motion belongs to the outer pager only. */
const SoundCloudCarouselPanel = ({ song, role, artworkUri, paused = false,
  topInset = 0, bottomInset = 0 }: SoundCloudCarouselPanelProps) => {
  const resolvedArtworkUri = artworkUri ?? getSongArtworkUri(song);
  const hasSong = song !== null;
  const artworkSource = useMemo(
    () => hasSong || resolvedArtworkUri ? getArtworkSource(resolvedArtworkUri) : null,
    [hasSong, resolvedArtworkUri],
  );

  return (
    <View style={styles.panel} testID={`soundcloud-carousel-${role}-panel`}
      accessibilityElementsHidden={role !== 'current'}
      importantForAccessibility={role === 'current' ? 'auto' : 'no-hide-descendants'}>
      <View style={[styles.artworkFrame, {
        top: Math.max(topInset + 50, 62),
        bottom: Math.max(bottomInset + 78, 90),
      }]} testID={`soundcloud-carousel-${role}-artwork-frame`}>
        {artworkSource ? (
          <Image source={artworkSource} resizeMode={resolvedArtworkUri ? 'cover' : 'contain'} resizeMethod="resize"
            fadeDuration={0} accessible={false} style={styles.panelArtwork} blurRadius={0}
            testID={`soundcloud-carousel-${role}-artwork`} />
        ) : <View style={[StyleSheet.absoluteFill, styles.emptyArtwork]} />}
        <View pointerEvents="none" style={[styles.artworkShade, paused && styles.pausedShade]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: 'transparent' },
  artworkFrame: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderRadius: 30,
    backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artworkBackground },
  panelArtwork: { ...StyleSheet.absoluteFill },
  emptyArtwork: { backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artworkFallback },
  artworkShade: { ...StyleSheet.absoluteFill, backgroundColor: SOUNDCLOUD_PLAYER_COLORS.artworkShade },
  pausedShade: { backgroundColor: SOUNDCLOUD_PLAYER_COLORS.pauseScrim },
});

export default React.memo(SoundCloudCarouselPanel);
