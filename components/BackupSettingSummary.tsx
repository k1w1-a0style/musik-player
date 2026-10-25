import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BackupSettings } from '../utils/backupFormat';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_APPEARANCE_LABELS, APP_THEME_SKIN_LABELS } from '../utils/appTheme';
import { ACCENT_LABELS } from '../utils/accentPreferences';

const labels: Record<keyof BackupSettings, string> = {
  appAppearance: 'Darstellung', appThemeSkin: 'Oberfläche', coverBassPulse: 'Cover-Puls zum Bass',
  nowPlayingPlayerLayout: 'Player-Ansicht', librarySortMode: 'Titelsortierung', librarySongViewMode: 'Titelansicht',
  albumViewMode: 'Albumansicht', volume: 'Lautstärke', repeatMode: 'Wiederholung', shuffle: 'Zufallswiedergabe',
  eqEnabled: 'Equalizer', eqPreset: 'EQ-Profil', eqBands: 'EQ-Werte (dB)', playerPresentationV3: 'Bewegung und Bibliotheksdichte',
  playbackResumeEnabled: 'Wiedergabe fortsetzen',
  accentPreferencesV4: 'App- und Player-Farben',
  libraryUpdateV1: 'Automatische Bibliotheksaktualisierung',
};
type PreferenceRecord = NonNullable<BackupSettings['accentPreferencesV4'] | BackupSettings['playerPresentationV3'] | BackupSettings['libraryUpdateV1']>;
const describePreference = (value: PreferenceRecord): string => {
  if ('appAccent' in value) return `App: ${ACCENT_LABELS[value.appAccent]}, Player: ${ACCENT_LABELS[value.playerAccent]}, ${value.instantColors ? 'sofortige Farbwechsel' : 'weiche Farbwechsel'}`;
  if ('whileOpen' in value) return `App-Start: ${value.onOpen ? 'Ein' : 'Aus'}, bei geöffneter App: ${value.whileOpen ? 'Ein' : 'Aus'}`;
  return `${value.quiet ? 'Weniger Animationen' : 'Normale Bewegung'}, ${value.density === 'compact' ? 'Kompakt' : 'Standard'}, ${ACCENT_LABELS[value.waveformAccent]}`;
};
const describe = (key: keyof BackupSettings, value: NonNullable<BackupSettings[keyof BackupSettings]>): string => {
  if (typeof value === 'boolean') return value ? 'Ein' : 'Aus';
  if (typeof value === 'number') return `${Math.round(value * 100)} %`;
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'object') return describePreference(value);
  if (key === 'appAppearance') return APP_APPEARANCE_LABELS[value as keyof typeof APP_APPEARANCE_LABELS];
  if (key === 'appThemeSkin') return APP_THEME_SKIN_LABELS[value as keyof typeof APP_THEME_SKIN_LABELS];
  const names: Record<string, string> = { classic: 'Klassisch', soundcloud: 'SoundCloud', alphabet: 'A–Z', trackNumber: 'Disc/Track',
    year: 'Jahr', recentlyAdded: 'Neu hinzugefügt', list: 'Liste', grid: 'Raster', gridLarge: 'Großes Raster',
    gridSmall: 'Kleines Raster', banner: 'Banner', off: 'Aus', one: 'Ein Titel', all: 'Alle Titel', custom: 'Eigenes Profil',
    flat: 'Neutral', bassBoost: 'Bassverstärkung', rock: 'Rock', pop: 'Pop', jazz: 'Jazz', vocal: 'Stimme', electronic: 'Elektronisch' };
  return names[value] ?? value;
};
const BackupSettingSummary = ({ settings }: { settings: BackupSettings }) => {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const text = { color: theme.palette.text.primary };
  return <View style={styles.content}>
    <Pressable testID="backup-settings-details" accessibilityRole="button" accessibilityState={{ expanded }}
      onPress={() => setExpanded(previous => !previous)} style={styles.action}>
      <Text style={text}>{expanded ? 'Gesicherte Einstellungen ausblenden' : 'Gesicherte Einstellungen anzeigen'}</Text></Pressable>
    {expanded && (Object.entries(settings) as [keyof BackupSettings, NonNullable<BackupSettings[keyof BackupSettings]>][])
      .map(([key, value]) => <Text key={key} style={text}>{labels[key]}: {describe(key, value)}</Text>)}
  </View>;
};
const styles = StyleSheet.create({ content: { gap: 8 }, action: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 } });
export default BackupSettingSummary;
