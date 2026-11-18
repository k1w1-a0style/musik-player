import React, { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { State, usePlaybackState } from 'react-native-track-player';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import { getAppTheme, DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN } from '../utils/appTheme';
import { describePlaybackError } from '../utils/playbackErrorMessage';
import { runPlaybackUiAction } from '../utils/playbackUiActions';

interface Props {
  currentSongId?: string;
  onRetry: (songId: string | undefined) => Promise<void>;
}

const fallbackTheme = getAppTheme(DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN);

const PlaybackTrackErrorNotice = ({ currentSongId, onRetry }: Props) => {
  const playback = usePlaybackState();
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const theme = useOptionalAppTheme()?.theme ?? fallbackTheme;
  const [pending, setPending] = useState(false);
  const error = playback.state === State.Error ? playback.error : undefined;
  const [dismissed, setDismissed] = useState<typeof error>();
  if (!error || error === dismissed || (error.mediaId && error.mediaId !== currentSongId)) return null;

  const { message, retry } = describePlaybackError(error);
  const retrySong = () => {
    setPending(true);
    void runPlaybackUiAction('retry-track-playback', () => onRetry(error.mediaId ?? currentSongId), { dropIfPending: true })
      .finally(() => setPending(false));
  };
  return <View testID="playback-track-error" accessibilityLiveRegion="polite"
    style={[styles.notice, { top: top + 8, backgroundColor: theme.palette.surfaceElevated }]}>
    <Text style={{ color: theme.palette.text.primary }}>{message}</Text>
    <View style={styles.actions}>
      {retry && <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending}
        onPress={retrySong} style={styles.button}>
        <Text style={{ color: theme.palette.primary }}>Wiederholen</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="Wiedergabehinweis schließen"
        onPress={() => setDismissed(error)} style={styles.button}>
        <Text style={{ color: theme.palette.text.secondary }}>Schließen</Text>
      </Pressable>
    </View>
  </View>;
};

const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 10, padding: 12, borderRadius: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  button: { justifyContent: 'center', paddingHorizontal: 8, minHeight: 44 },
});

export default PlaybackTrackErrorNotice;
