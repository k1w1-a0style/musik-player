import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { displayAlbum, displayArtist } from '../utils/libraryPresentation';
import TrackInfoActions from './TrackInfoActions';
import TrackInfoCover from './TrackInfoCover';
import TrackInfoSections from './TrackInfoSections';
import type { TrackInfoCoverDimensions } from './useTrackInfoCoverState';
import { getTrackInfoTitle } from './trackInfoHelpers';

interface TrackInfoContentProps {
  song: Song;
  coverUri?: string;
  coverStatus: string;
  coverDimensions?: TrackInfoCoverDimensions;
  importedAt: string;
  coverFailed: boolean;
  onCoverError: () => void;
  onOpenTagEditor: () => void;
  onRemoveFromLibrary: () => void;
}

const TrackInfoContent: React.FC<TrackInfoContentProps> = ({
  song,
  coverUri,
  coverStatus,
  coverDimensions,
  importedAt,
  coverFailed,
  onCoverError,
  onOpenTagEditor,
  onRemoveFromLibrary,
}) => {
  const { theme } = useAppTheme();
  return (
    <AppBackground>
      <Screen edges={['bottom']} contentStyle={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.hero, { backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.borderStrong }]} testID="track-info-hero">
            <TrackInfoCover coverUri={coverUri} coverFailed={coverFailed} onCoverError={onCoverError} />
            <View style={styles.heroText}>
              <Text style={[styles.eyebrow, { color: theme.palette.primary }]}>TRACK-INFOS</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.palette.text.primary }]}
                numberOfLines={3}>{getTrackInfoTitle(song)}</Text>
              <Text style={[styles.artist, { color: theme.palette.text.secondary }]}
                numberOfLines={2}>{displayArtist(song)}</Text>
              <Text style={[styles.album, { color: theme.palette.text.muted }]}
                numberOfLines={2}>{displayAlbum(song)}</Text>
            </View>
          </View>

          <TrackInfoActions
            onOpenTagEditor={onOpenTagEditor}
            onRemoveFromLibrary={onRemoveFromLibrary}
          />
          <TrackInfoSections
            song={song}
            coverUri={coverUri}
            coverStatus={coverStatus}
            coverDimensions={coverDimensions}
            importedAt={importedAt}
          />
        </ScrollView>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: APP_THEME_TOKENS.spacing.md,
    paddingBottom: 120, gap: APP_THEME_TOKENS.spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: APP_THEME_TOKENS.spacing.md,
    padding: APP_THEME_TOKENS.spacing.md, borderRadius: APP_THEME_TOKENS.radii.elevatedCard,
    borderWidth: StyleSheet.hairlineWidth },
  heroText: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 10, lineHeight: 13,
    letterSpacing: 1.4, marginBottom: 5 },
  title: { fontFamily: APP_THEME_TOKENS.fonts.display, fontSize: 24, lineHeight: 28,
    letterSpacing: -0.5 },
  artist: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 15, lineHeight: 20, marginTop: 6 },
  album: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
});

export default TrackInfoContent;
