import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useAccentPreferences } from '../contexts/AccentPreferencesContext';
import { ACCENT_IDS, ACCENT_LABELS, resolveAccentColor, readableAppAccent, type AccentPreferences } from '../utils/accentPreferences';

const AccentChoices = ({ field, label }: { field: 'appAccent' | 'playerAccent'; label: string }) => {
  const { theme } = useAppTheme();
  const { preferences, setPreferences, isHydrated, coverAccent } = useAccentPreferences();
  return <View style={styles.section}>
    <Text style={[styles.label, { color: theme.palette.text.primary }]}>{label}</Text>
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {ACCENT_IDS.map(id => {
        const color = readableAppAccent(resolveAccentColor(id, coverAccent ?? theme.palette.primary), theme);
        return <Pressable key={id} testID={`settings-${field}-${id}`} accessibilityRole="radio"
          accessibilityLabel={`${label}: ${ACCENT_LABELS[id]}`} disabled={!isHydrated}
          accessibilityState={{ checked: preferences[field] === id, disabled: !isHydrated }}
          onPress={() => setPreferences?.((previous: AccentPreferences) => ({ ...previous, [field]: id }))}
          style={[styles.choice, { borderColor: preferences[field] === id ? theme.palette.primary : theme.palette.border,
            backgroundColor: theme.palette.surface }]}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={[styles.choiceText, { color: theme.palette.text.primary }]}>{ACCENT_LABELS[id]}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
};
const AccentSettings = () => {
  const { theme } = useAppTheme();
  const { preferences, setPreferences, isHydrated } = useAccentPreferences();
  return <View style={styles.section} testID="settings-accents">
    <Text style={[styles.heading, { color: theme.palette.text.primary }]}>Farben</Text>
    <Text style={[styles.description, { color: theme.palette.text.secondary }]}>App, Player und Waveform haben eigene Farben. Die Auswahl ist sofort sichtbar und bleibt gespeichert.</Text>
    <AccentChoices field="appAccent" label="App-Akzent" />
    <AccentChoices field="playerAccent" label="Player-Akzent" />
    <View style={styles.instant}><Text style={[styles.label, styles.copy, { color: theme.palette.text.primary }]}>Farben sofort wechseln</Text>
      <Switch testID="settings-instant-colors" accessibilityLabel="Farben sofort wechseln" disabled={!isHydrated}
        value={preferences.instantColors} onValueChange={instantColors => setPreferences?.(previous => ({ ...previous, instantColors }))} />
    </View>
  </View>;
};
const styles = StyleSheet.create({
  section: { gap: 10 }, heading: { fontSize: 18 }, label: { fontSize: 16 },
  description: { fontSize: 12, lineHeight: 17 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderRadius: 12 },
  swatch: { width: 16, height: 16, borderRadius: 8 }, choiceText: { fontSize: 14 },
  instant: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1 },
});
export default AccentSettings;
