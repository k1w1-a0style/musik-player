import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import TrackInfoContent from './TrackInfoContent';
import TrackInfoNotFound from './TrackInfoNotFound';
import { useTrackInfoScreenState } from './useTrackInfoScreenState';

const TrackInfo: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    song,
    isReady,
    coverUri,
    coverStatus,
    coverDimensions,
    importedAt,
    coverFailed,
    setCoverFailed,
    openTagEditor,
    removeFromLibrary,
  } = useTrackInfoScreenState();

  if (!isReady) {
    return (
      <AppBackground>
        <Screen edges={['bottom']} contentStyle={styles.loadingContainer}>
          <ActivityIndicator color={theme.palette.primary} />
          <Text style={[styles.loadingText, { color: theme.palette.text.secondary }]}>Track-Informationen werden geladen…</Text>
        </Screen>
      </AppBackground>
    );
  }

  if (!song) return <TrackInfoNotFound />;

  return (
    <TrackInfoContent
      song={song}
      coverUri={coverUri}
      coverStatus={coverStatus}
      coverDimensions={coverDimensions}
      importedAt={importedAt}
      coverFailed={coverFailed}
      onCoverError={() => setCoverFailed(true)}
      onOpenTagEditor={openTagEditor}
      onRemoveFromLibrary={removeFromLibrary}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: APP_THEME_TOKENS.spacing.sm },
  loadingText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 14 },
});

export default TrackInfo;
