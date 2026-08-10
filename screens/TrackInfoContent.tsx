import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { Song } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { APP_THEME_TOKENS } from '../utils/appTheme';
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
  return (
    <AppBackground>
      <Screen edges={['bottom']} contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <TrackInfoCover
            coverUri={coverUri}
            coverFailed={coverFailed}
            onCoverError={onCoverError}
          />

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
  content: { padding: APP_THEME_TOKENS.spacing.md, paddingBottom: 120, gap: 6 },
});

export default TrackInfoContent;
