import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import TrackInfoActions from './TrackInfoActions';
import TrackInfoCover from './TrackInfoCover';
import TrackInfoSections from './TrackInfoSections';
import { useTrackInfoScreenState } from './useTrackInfoScreenState';

const TrackInfo: React.FC = () => {
  const {
    song,
    coverUri,
    coverStatus,
    importedAt,
    coverFailed,
    setCoverFailed,
    openTagEditor,
    removeFromLibrary,
  } = useTrackInfoScreenState();

  if (!song) {
    return (
      <AppBackground>
        <Screen contentStyle={styles.container}>
          <Text style={styles.error}>Song nicht gefunden.</Text>
        </Screen>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Screen contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <TrackInfoCover
            coverUri={coverUri}
            coverFailed={coverFailed}
            onCoverError={() => setCoverFailed(true)}
          />

          <Text style={styles.header}>TrackInfo</Text>
          <TrackInfoActions
            onOpenTagEditor={openTagEditor}
            onRemoveFromLibrary={removeFromLibrary}
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
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing.md, paddingBottom: 120, gap: 6 },
  header: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 24, marginBottom: 4 },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 16 },
});

export default TrackInfo;
