import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';
import TrackInfoActions from './TrackInfoActions';
import TrackInfoCover from './TrackInfoCover';
import TrackInfoSections from './TrackInfoSections';
import type { TrackInfoCoverDimensions } from './useTrackInfoCoverState';

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
      <Screen contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <TrackInfoCover
            coverUri={coverUri}
            coverFailed={coverFailed}
            onCoverError={onCoverError}
          />

          <Text style={[styles.header, { color: theme.palette.text.primary }]}>Titelinfo</Text>
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
  content: { padding: staticTheme.spacing.md, paddingBottom: 120, gap: 6 },
  header: { fontFamily: staticTheme.fonts.heading, fontSize: 24, marginBottom: 4 },
});

export default TrackInfoContent;
