import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPlaybackSelectionSnapshot, subscribeToPlaybackSelection } from '../utils/playbackSelectionStatus';
import { useAppTheme } from '../contexts/AppThemeContext';

/** Desired title is a separate hint; confirmed track metadata keeps native truth. */
const PlaybackSelectionNotice = ({ topInset = 0 }: { topInset?: number }) => {
  const selection = useSyncExternalStore(subscribeToPlaybackSelection, getPlaybackSelectionSnapshot);
  const { theme } = useAppTheme();
  if (!selection.target) return null;
  return <View pointerEvents="none" accessibilityLiveRegion="polite" testID="playback-selection-notice"
    style={[styles.notice, { top: topInset + 54, backgroundColor: theme.palette.surfaceElevated }]}>
    <Text numberOfLines={2} style={[styles.text, { color: theme.palette.text.primary }]}>Wechsel zu „{selection.target.title}“ …</Text>
  </View>;
};
const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 16, right: 16, zIndex: 70, padding: 10, borderRadius: 10 },
  text: { fontSize: 13, textAlign: 'center' },
});
export default PlaybackSelectionNotice;
