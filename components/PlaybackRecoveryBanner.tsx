import React, { useContext, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { getAppTheme, DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN } from '../utils/appTheme';
import { getNativePlaybackWatchdogSnapshot, subscribeToNativePlaybackWatchdog } from '../utils/nativePlaybackWatchdog';

interface Props { recovering: boolean; onRetry?: () => void }
const fallbackTheme = getAppTheme(DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN);

/** Playback health must not unmount the user's hydrated library or navigation. */
const PlaybackRecoveryBanner = ({ recovering, onRetry }: Props) => {
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const theme = useOptionalAppTheme()?.theme ?? fallbackTheme;
  const watchdog = useSyncExternalStore(subscribeToNativePlaybackWatchdog, getNativePlaybackWatchdogSnapshot);
  const blocked = watchdog.status === 'quarantined';
  return <View testID="playback-recovery-banner" accessibilityLiveRegion="polite"
    style={[styles.banner, { top: top + 8, backgroundColor: theme.palette.surfaceElevated }]}>
    <Text style={{ color: theme.palette.text.primary }}>
      {blocked ? 'Der Player reagiert nicht.' : recovering ? 'Wiedergabe wird wiederhergestellt …' : 'Wiedergabe vorübergehend nicht verfügbar.'}
    </Text>
    <Text style={{ color: theme.palette.text.secondary }}>
      {blocked ? 'Du kannst deine Bibliothek weiter nutzen. Falls der Player nicht zurückkehrt, starte die App neu.'
        : 'Deine Bibliothek bleibt verfügbar.'}
    </Text>
    <Pressable testID="playback-retry-button" accessibilityRole="button" accessibilityLabel="Wiedergabe erneut versuchen"
      accessibilityState={{ disabled: blocked || recovering }} disabled={blocked || recovering}
      onPress={onRetry} style={styles.retry}>
      <Text style={{ color: theme.palette.primary, opacity: blocked || recovering ? 0.4 : 1 }}>Wiederholen</Text>
    </Pressable>
  </View>;
};
const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 10, padding: 12, gap: 6, borderRadius: 12 },
  retry: { alignSelf: 'flex-end', padding: 8, minHeight: 44, justifyContent: 'center' },
});
export default PlaybackRecoveryBanner;
