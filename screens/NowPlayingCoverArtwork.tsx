import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';

interface NowPlayingCoverArtworkProps {
  song?: Song | null;
  artworkUri?: string;
  isPlaying: boolean;
  accent: string;
  coverSize: number;
}

const NowPlayingCoverArtwork: React.FC<NowPlayingCoverArtworkProps> = ({
  song,
  artworkUri,
  isPlaying,
  accent,
  coverSize,
}) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = React.useState(false);

  React.useEffect(() => setCoverFailed(false), [song?.id, artworkUri]);

  return (
    <View style={[styles.coverCard, { width: coverSize, height: coverSize, shadowColor: accent, backgroundColor: theme.palette.surface }]}>
      {artworkUri && !coverFailed ? (
        <Image
          source={{ uri: artworkUri }}
          style={styles.coverImage}
          onError={() => setCoverFailed(true)}
          resizeMode="cover"
          testID="now-playing-cover-image"
        />
      ) : (
        <View style={[styles.discFallback, isPlaying && styles.discFallbackPlaying]} testID="now-playing-cover-fallback">
          <Disc3 color={theme.palette.primary} size={Math.floor(coverSize * 0.55)} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  coverCard: { borderRadius: 22, overflow: 'hidden', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 10 },
  coverImage: { width: '100%', height: '100%' },
  discFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discFallbackPlaying: { opacity: 0.95, transform: [{ scale: 1.02 }] },
});

export default NowPlayingCoverArtwork;
