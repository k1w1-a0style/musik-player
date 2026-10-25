import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useLibraryUpdatePreferences } from '../contexts/LibraryUpdateContext';
const LibraryUpdateSettings = () => {
  const { theme } = useAppTheme();
  const { preferences, isHydrated, setPreferences } = useLibraryUpdatePreferences();
  const row = (key: 'onOpen' | 'whileOpen', label: string, hint: string) => <View key={key} style={styles.row}>
    <View style={styles.copy}><Text style={{ color: theme.palette.text.primary, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: theme.palette.text.secondary, fontSize: 12 }}>{hint}</Text></View>
    <Switch testID={`settings-library-update-${key}`} accessibilityLabel={label} value={preferences[key]}
      disabled={!isHydrated} trackColor={{ false: theme.palette.borderStrong, true: theme.palette.primary }}
      onValueChange={value => setPreferences?.(previous => ({ ...previous, [key]: value }))} />
  </View>;
  return <View style={styles.section} testID="settings-library-update">
    {row('onOpen', 'Beim App-Start aktualisieren', 'Prüft neue und geänderte Titel.')}
    {row('whileOpen', 'Automatisch aktuell halten', 'Bei Rückkehr zur App und gemeldeten Medienänderungen.')}
    <Text style={{ color: theme.palette.text.secondary, fontSize: 12, lineHeight: 17 }}>
      Neue Ordner werden nach der Auswahl eingelesen. Automatische Updates laufen nur bei geöffneter App und vorhandenem Lesezugriff.
    </Text>
  </View>;
};
const styles = StyleSheet.create({ section: { gap: 10 }, row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 } });
export default LibraryUpdateSettings;
