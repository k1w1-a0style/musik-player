import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useImportFileProgress } from '../utils/libraryImportProgress';

const LibraryMetadataScanProgress = () => {
  const progress = useImportFileProgress();
  const { theme } = useAppTheme();
  if (!progress.total) return null;
  return <View style={styles.box}>
    <Text style={{ color: theme.palette.text.secondary }} numberOfLines={1}>
      {`${progress.processed}/${progress.total} · ${progress.currentTitle || 'Metadaten gelesen'}`}
    </Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Metadaten und Cover scannen"
      accessibilityValue={{ min: 0, max: progress.total, now: progress.processed }}
      style={[styles.track, { backgroundColor: theme.palette.border }]} testID="library-metadata-scan-progress">
      <View style={{ height: '100%', backgroundColor: theme.palette.primary,
        width: `${progress.processed / progress.total * 100}%` }} />
    </View>
    {progress.currentTitle ? <View accessibilityRole="progressbar"
      accessibilityLabel={`Metadaten von ${progress.currentTitle}`} accessibilityValue={{ text: 'Wird gelesen' }}
      style={[styles.track, { backgroundColor: theme.palette.border }]} testID="library-metadata-current-track">
      <View style={{ height: '100%', width: '35%', backgroundColor: theme.palette.primary }} />
    </View> : null}
  </View>;
};
const styles = StyleSheet.create({ box: { gap: 6 }, track: { height: 6, borderRadius: 3, overflow: 'hidden' } });
export default LibraryMetadataScanProgress;
