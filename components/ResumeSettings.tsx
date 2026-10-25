import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { usePlaybackResume } from '../contexts/PlaybackResumeContext';

const ResumeSettings = () => {
  const { theme } = useAppTheme();
  const { enabled, isHydrated, setEnabled, clear } = usePlaybackResume();
  const text = { color: theme.palette.text.primary, fontFamily: theme.tokens.fonts.body };
  const erase = () => Alert.alert('Gespeicherte Positionen löschen?', 'Deine Musik und Playlists bleiben erhalten.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Löschen', style: 'destructive', onPress: () => {
      void clear?.().then(() => Alert.alert('Positionen gelöscht', 'Neue Positionen werden nur bei eingeschaltetem Fortsetzen gespeichert.'))
        .catch(error => Alert.alert('Positionen nicht gelöscht', error instanceof Error ? error.message : String(error)));
    } },
  ]);
  return <View testID="settings-resume" style={styles.section}>
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, text]}>Wiedergabe fortsetzen</Text>
        <Text style={text}>Merkt sich die Position ab 20 Minuten Titellänge.</Text>
      </View>
      <Switch testID="settings-resume-enabled" accessibilityLabel="Wiedergabe fortsetzen" disabled={!isHydrated}
        value={enabled} onValueChange={setEnabled} />
    </View>
    <Text style={[styles.hint, { color: theme.palette.text.secondary }]}>Beim nächsten Auswählen: fortsetzen oder von vorn starten. Geänderte Dateien starten regulär.</Text>
    <Pressable testID="settings-resume-clear" accessibilityRole="button" accessibilityState={{ disabled: !isHydrated }}
      disabled={!isHydrated} onPress={erase} style={[styles.action, { borderColor: theme.palette.border }]}>
      <Text style={text}>Gespeicherte Positionen löschen</Text></Pressable>
  </View>;
};
const styles = StyleSheet.create({
  section: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1, gap: 6 },
  title: { fontSize: 16 }, hint: { fontSize: 12, lineHeight: 17 },
  action: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
});
export default ResumeSettings;
