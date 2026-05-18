import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import TrackInfoActions from './TrackInfoActions';
import TrackInfoCover from './TrackInfoCover';
import TrackInfoSections from './TrackInfoSections';

interface TrackInfoContentProps {
  song: Song;
  coverUri?: string;
  coverStatus: string;
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
  importedAt,
  coverFailed,
  onCoverError,
  onOpenTagEditor,
  onRemoveFromLibrary,
}) => (
  <AppBackground>
    <Screen contentStyle={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TrackInfoCover
          coverUri={coverUri}
          coverFailed={coverFailed}
          onCoverError={onCoverError}
        />

        <Text style={styles.header}>TrackInfo</Text>
        <TrackInfoActions
          onOpenTagEditor={onOpenTagEditor}
          onRemoveFromLibrary={onRemoveFromLibrary}
        />
        <TrackInfoSections
          song={song}
          coverUri={coverUri}
          coverStatus={coverStatus}
          importedAt={importedAt}
        />
      </ScrollView>
    </Screen>
  </AppBackground>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: 120, gap: 6 },
  header: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 24, marginBottom: 4 },
});

export default TrackInfoContent;
