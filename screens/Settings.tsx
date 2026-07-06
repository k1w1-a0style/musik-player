import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import {
  APP_APPEARANCE_LABELS,
  APP_APPEARANCES,
  APP_THEME_SKIN_LABELS,
  APP_THEME_SKINS,
  type AppAppearance,
  type AppThemeSkin,
} from '../utils/appTheme';
import { theme as staticTheme } from '../theme';

const Settings: React.FC = () => {
  const { appearance, skin, theme, setAppearance, setSkin } = useAppTheme();

  const renderAppearanceOption = (option: AppAppearance) => {
    const selected = option === appearance;
    return (
      <Pressable
        key={option}
        testID={`settings-appearance-${option}`}
        accessibilityRole="button"
        accessibilityLabel={`Darstellung ${APP_APPEARANCE_LABELS[option]}`}
        accessibilityState={{ selected }}
        onPress={() => setAppearance(option)}
        style={[
          styles.option,
          {
            backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
            borderColor: selected ? theme.palette.primary : theme.palette.border,
          },
        ]}
      >
        <Text style={[styles.optionTitle, { color: theme.palette.text.primary }]}>
          {APP_APPEARANCE_LABELS[option]}
        </Text>
        <Text style={[styles.optionSubtitle, { color: theme.palette.text.secondary }]}>
          {option === 'dark' ? 'Dunkle Oberfläche für Musikbetrieb.' : 'Helle Oberfläche für Tageslicht.'}
        </Text>
      </Pressable>
    );
  };

  const renderSkinOption = (option: AppThemeSkin) => {
    const selected = option === skin;
    return (
      <Pressable
        key={option}
        testID={`settings-skin-${option}`}
        accessibilityRole="button"
        accessibilityLabel={`Oberfläche ${APP_THEME_SKIN_LABELS[option]}`}
        accessibilityState={{ selected }}
        onPress={() => setSkin(option)}
        style={[
          styles.option,
          {
            backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
            borderColor: selected ? theme.palette.primary : theme.palette.border,
          },
        ]}
      >
        <Text style={[styles.optionTitle, { color: theme.palette.text.primary }]}>
          {APP_THEME_SKIN_LABELS[option]}
        </Text>
        <Text style={[styles.optionSubtitle, { color: theme.palette.text.secondary }]}>
          {option === 'graphite'
            ? 'Neutraler Schwarz/Grau-Standard.'
            : option === 'minimal'
              ? 'Schlichter, ruhiger Look mit weniger Glow.'
              : 'Dunkler Look mit stärkeren Cover-Akzenten.'}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.palette.background }]} testID="settings-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: theme.palette.text.primary }]}>Einstellungen</Text>
        <Text style={[styles.description, { color: theme.palette.text.secondary }]}>
          Wähle Darstellung und Oberfläche. Cover-Farben dürfen weiterhin Player, Waveform und aktive Elemente akzentuieren.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.palette.text.primary }]}>Hell / Dunkel</Text>
          {APP_APPEARANCES.map(renderAppearanceOption)}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.palette.text.primary }]}>Oberfläche</Text>
          {APP_THEME_SKINS.map(renderSkinOption)}
        </View>

        <View
          testID="settings-theme-preview"
          style={[
            styles.preview,
            {
              backgroundColor: theme.palette.surfaceGlass,
              borderColor: theme.palette.borderStrong,
            },
          ]}
        >
          <Text style={[styles.previewTitle, { color: theme.palette.text.primary }]}>{theme.label}</Text>
          <View style={styles.previewRow}>
            <View style={[styles.previewDot, { backgroundColor: theme.palette.primary }]} />
            <View style={[styles.previewLine, { backgroundColor: theme.palette.borderStrong }]} />
            <View style={[styles.previewPill, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]} />
          </View>
          <Text style={[styles.optionSubtitle, { color: theme.palette.text.secondary }]}>
            Die vollständige Migration alter Screens erfolgt schrittweise, damit keine UI-Baustelle explodiert.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: staticTheme.spacing.md, gap: staticTheme.spacing.md },
  header: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 28,
    letterSpacing: -0.6,
  },
  description: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  section: { gap: staticTheme.spacing.sm },
  sectionTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 18,
  },
  option: {
    borderWidth: 1,
    borderRadius: staticTheme.radii.card,
    padding: staticTheme.spacing.md,
    gap: 4,
  },
  optionTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 16,
  },
  optionSubtitle: {
    fontFamily: staticTheme.fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  preview: {
    borderWidth: 1,
    borderRadius: staticTheme.radii.elevatedCard,
    padding: staticTheme.spacing.md,
    gap: staticTheme.spacing.md,
  },
  previewTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 16,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  previewDot: { width: 18, height: 18, borderRadius: 9 },
  previewLine: { flex: 1, height: 4, borderRadius: 999 },
  previewPill: { width: 72, height: 28, borderRadius: 999, borderWidth: 1 },
});

export default Settings;
