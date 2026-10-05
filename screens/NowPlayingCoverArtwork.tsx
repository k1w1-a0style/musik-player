import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Song } from '../types/Song';
import { KIWI_MUSIC_ARTWORK, getSongArtworkUri } from '../utils/songArtwork';
import NativeTrackPager from '../components/NativeTrackPager';
import CoverBassPulse from '../components/CoverBassPulse';

interface NowPlayingCoverArtworkProps {
  song?: Song | null;
  previousSong?: Song | null;
  nextSong?: Song | null;
  artworkUri?: string;
  previousArtworkUri?: string;
  nextArtworkUri?: string;
  isPlaying: boolean;
  accent: string;
  coverSize: number;
  swipeEnabled?: boolean;
  queue?: Song[];
  onSelectSong?: (song: Song) => void | Promise<void>;
  wrapToStart?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
}

type CoverRole = 'previous' | 'current' | 'next';

interface CoverCardProps {
  role: CoverRole;
  song?: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  coverSize: number;
  backgroundColor: string;
}

const getCardTestId = (role: CoverRole): string => role === 'current'
  ? 'now-playing-cover-card'
  : `now-playing-cover-${role}-card`;
const getImageTestId = (role: CoverRole): string => role === 'current'
  ? 'now-playing-cover-image'
  : `now-playing-cover-${role}-image`;
const getFallbackTestId = (role: CoverRole): string => role === 'current'
  ? 'now-playing-cover-fallback'
  : `now-playing-cover-${role}-fallback`;

const CoverCard = React.memo(({ role, song, artworkUri, isPlaying, coverSize,
  backgroundColor }: CoverCardProps) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const resolvedArtworkUri = artworkUri ?? getSongArtworkUri(song);
  const artworkSource = useMemo(() => resolvedArtworkUri ? { uri: resolvedArtworkUri } : null, [resolvedArtworkUri]);

  useEffect(() => setCoverFailed(false), [resolvedArtworkUri, song?.id]);

  return (
    <View style={[styles.coverCard, { width: coverSize, height: coverSize, backgroundColor }]}
      testID={getCardTestId(role)}>
      {artworkSource && !coverFailed ? (
        <Image source={artworkSource} style={styles.coverImage} onError={() => setCoverFailed(true)}
          resizeMode="cover" resizeMethod="resize" fadeDuration={0} accessible={false}
          testID={getImageTestId(role)} />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]}
          testID={getFallbackTestId(role)}>
          <Image source={KIWI_MUSIC_ARTWORK} style={styles.coverImage} resizeMode="cover"
            resizeMethod="resize" fadeDuration={0} accessible={false} />
        </View>
      )}
    </View>
  );
});

const StaticCoverArtwork = ({ song, artworkUri, isPlaying, accent, coverSize }:
  NowPlayingCoverArtworkProps) => {
  const { theme } = useAppTheme();
  const cardProps = {
    coverSize,
    backgroundColor: theme.palette.surface,
  };
  return (
    <View style={[styles.coverShadow, { width: coverSize, height: coverSize,
      shadowColor: accent, backgroundColor: theme.palette.surface }]}>
      <CoverCard role="current" song={song} artworkUri={artworkUri} isPlaying={isPlaying}
        {...cardProps} />
    </View>
  );
};

const CoverPage = ({ pageWidth, accent, ...props }: CoverCardProps & {
  pageWidth: number; accent: string;
}) => {
  const { bassPulseEnabled, isBassPulseHydrated } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const artwork = props.song || props.role === 'current' ? (
    <View style={[styles.coverShadow, { width: props.coverSize, height: props.coverSize,
      shadowColor: accent, backgroundColor: props.backgroundColor }]}>
      <CoverCard {...props} />
    </View>
  ) : null;
  return <View style={[styles.coverPage, { width: pageWidth }]}
    testID={`now-playing-cover-${props.role}-page`}>
    <CoverBassPulse song={props.song} isPlaying={props.isPlaying}
      enabled={Boolean(bassPulseEnabled && isBassPulseHydrated && !reduceMotion && props.role === 'current')}>
      {artwork}
    </CoverBassPulse>
  </View>;
};

const ClassicCoverPager = ({ song, previousSong, nextSong, artworkUri, previousArtworkUri,
  nextArtworkUri, isPlaying, accent, coverSize, onSwipeLeft, onSwipeRight, queue,
  onSelectSong, wrapToStart = false }: NowPlayingCoverArtworkProps) => {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(coverSize + 32, width);
  const reduceMotion = useReducedMotion();
  const songs = useMemo(() => queue?.length ? queue : [previousSong, song, nextSong]
    .filter((item): item is Song => Boolean(item)), [nextSong, previousSong, queue, song]);
  const selectSong = React.useCallback((selected: Song) => {
    if (onSelectSong) return onSelectSong(selected);
    if (selected.id === previousSong?.id) return onSwipeRight?.();
    return onSwipeLeft?.();
  }, [onSelectSong, onSwipeLeft, onSwipeRight, previousSong?.id]);
  const renderPage = React.useCallback((item: Song) => {
    const role: CoverRole = item.id === song?.id ? 'current'
      : item.id === previousSong?.id ? 'previous' : 'next';
    const uri = role === 'current' ? artworkUri : role === 'previous' ? previousArtworkUri
      : item.id === nextSong?.id ? nextArtworkUri : getSongArtworkUri(item);
    return <CoverPage role={role} song={item} artworkUri={uri} isPlaying={role === 'current' && isPlaying}
      coverSize={coverSize} pageWidth={pageWidth} accent={accent} backgroundColor={theme.palette.surface} />;
  }, [accent, artworkUri, coverSize, isPlaying, nextArtworkUri, nextSong?.id, pageWidth,
    previousArtworkUri, previousSong?.id, song?.id, theme.palette.surface]);
  return <View style={[styles.pagerViewport, { width: pageWidth, height: coverSize + 32 }]}
    testID="now-playing-cover-pager">
    <NativeTrackPager songs={songs} currentSongId={song?.id} width={pageWidth}
      onSelectSong={selectSong} renderPage={renderPage} wrapToStart={wrapToStart}
      reduceMotion={reduceMotion} testID="now-playing-cover-track" style={styles.gestureViewport} />
  </View>;
};

const NowPlayingCoverArtwork: React.FC<NowPlayingCoverArtworkProps> = props => props.swipeEnabled
  ? <ClassicCoverPager {...props} />
  : <StaticCoverArtwork {...props} />;

const styles = StyleSheet.create({
  coverShadow: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  pagerViewport: { overflow: 'hidden' },
  gestureViewport: { width: '100%', height: '100%' },
  coverPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverTrack: { height: '100%', flexDirection: 'row' },
  coverCard: { overflow: 'hidden', borderRadius: 22 },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
});

export default React.memo(NowPlayingCoverArtwork);
