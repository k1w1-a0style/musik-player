import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useNowPlayingControlsMode } from '../hooks/useNowPlayingControlsMode';
import {
  APP_APPEARANCE_LABELS,
  APP_APPEARANCES,
  APP_THEME_SKIN_LABELS,
  APP_THEME_SKINS,
  type AppAppearance,
  type AppThemeSkin,
} from '../utils/appTheme';
import {
  NOW_PLAYING_CONTROLS_MODE_DESCRIPTIONS,
  NOW_PLAYING_CONTROLS_MODE_LABELS,
  NOW_PLAYING_CONTROLS_MODES,
  type NowPlayingControlsMode,
} from '../utils/nowPlayingControlsMode';

const Settings: React.FC = () => {
  const { appearance, skin, theme, setAppearance, setSkin } = useAppTheme();
  const { mode: nowPlayingControlsMode, setMode: setNowPlayingControlsMode } = useNowPlayingControlsMode();
  const { fonts, radii, spacing } = theme.tokens;

  const optionTokenStyle = {
    borderRadius: radii.card,
    gap: spacing.xs,
    padding: spacing.md,
  };
  const optionTitleTokenStyle = { fontFamily: fonts.heading };
  const optionSubtitleTokenStyle = { fontFamily: fonts.body };
  const sectionTokenStyle = { gap: spacing.sm };
  const sectionTitleTokenStyle = { fontFamily: fonts.heading };

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
          optionTokenStyle,
          {
            backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
            borderColor: selected ? theme.palette.primary : theme.palette.border,
          },
        ]}
      >
        <Text style={[styles.optionTitle, optionTitleTokenStyle, { color: theme.palette.text.primary }]}>{APP_APPEARANCE_LABELS[option]}</Text>
        <Text style={[styles.optionSubtitle, optionSubtitleTokenStyle, { color: theme.palette.text.secondary }]}> 
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
          optionTokenStyle,
          {
            backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
            borderColor: selected ? theme.palette.primary : theme.palette.border,
          },
        ]}
      >
        <Text style={[styles.optionTitle, optionTitleTokenStyle, { color: theme.palette.text.primary }]}>{APP_THEME_SKIN_LABELS[option]}</Text>
        <Text style={[styles.optionSubtitle, optionSubtitleTokenStyle, { color: theme.palette.text.secondary }]}> 
          {option === 'graphite'
            ? 'Neutraler Schwarz/Grau-Standard.'
            : option === 'minimal'
              ? 'Schlichter, ruhiger Look mit weniger Glow.'
              : 'Dunkler Look mit stärkeren Cover-Akzenten.'}
        </Text>
      </Pressable>
    );
  };

  const renderNowPlayingControlsOption = (option: NowPlayingControlsMode) => {
    const selected = option === nowPlayingControlsMode;
    return (
      <Pressable
        key={option}
        testID={`settings-now-playing-controls-${option}`}
        accessibilityRole="button"
        accessibilityLabel={`Player-Bedienung ${NOW_PLAYING_CONTROLS_MODE_LABELS[option]}`}
        accessibilityState={{ selected }}
        onPress={() => setNowPlayingControlsMode(option)}
        style={[
          styles.option,
          optionTokenStyle,
          {
            backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
            borderColor: selected ? theme.palette.primary : theme.palette.border,
          },
        ]}
      >
        <Text style={[styles.optionTitle, optionTitleTokenStyle, { color: theme.palette.text.primary }]}>{NOW_PLAYING_CONTROLS_MODE_LABELS[option]}</Text>
        <Text style={[styles.optionSubtitle, optionSubtitleTokenStyle, { color: theme.palette.text.secondary }]}>{NOW_PLAYING_CONTROLS_MODE_DESCRIPTIONS[option]}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.palette.background }]} testID="settings-screen">
      <ScrollView
        testID="settings-scroll"
        contentContainerStyle={[styles.content, { gap: spacing.md, padding: spacing.md }]}
      >
        <Text style={[styles.header, { color: theme.palette.text.primary, fontFamily: fonts.heading }]}>Einstellungen</Text>
        <Text style={[styles.description, { color: theme.palette.text.secondary, fontFamily: fonts.body }]}> 
          Wähle Darstellung und Oberfläche. Cover-Farben dürfen weiterhin Player, Waveform und aktive Elemente akzentuieren.
        </Text>

        <View style={[styles.section, sectionTokenStyle]}>
          <Text style={[styles.sectionTitle, sectionTitleTokenStyle, { color: theme.palette.text.primary }]}>Hell / Dunkel</Text>
          {APP_APPEARANCES.map(renderAppearanceOption)}
        </View>

        <View style={[styles.section, sectionTokenStyle]}>
          <Text style={[styles.sectionTitle, sectionTitleTokenStyle, { color: theme.palette.text.primary }]}>Oberfläche</Text>
          {APP_THEME_SKINS.map(renderSkinOption)}
        </View>

        <View style={[styles.section, sectionTokenStyle]}>
          <Text style={[styles.sectionTitle, sectionTitleTokenStyle, { color: theme.palette.text.primary }]}>Player-Bedienung</Text>
          {NOW_PLAYING_CONTROLS_MODES.map(renderNowPlayingControlsOption)}
        </View>

        <View
          testID="settings-theme-preview"
          style={[
            styles.preview,
            {
              backgroundColor: theme.palette.surfaceGlass,
              borderColor: theme.palette.borderStrong,
              borderRadius: radii.elevatedCard,
              gap: spacing.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[styles.previewTitle, { color: theme.palette.text.primary, fontFamily: fonts.heading }]}>{theme.label}</Text>
          <View style={[styles.previewRow, { gap: spacing.sm }]}>
            <View style={[styles.previewDot, { backgroundColor: theme.palette.primary }]} />
            <View style={[styles.previewLine, { backgroundColor: theme.palette.borderStrong }]} />
            <View style={[styles.previewPill, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]} />
          </View>
          <Text style={[styles.optionSubtitle, optionSubtitleTokenStyle, { color: theme.palette.text.secondary }]}>Die vollständige Migration alter Screens erfolgt schrittweise, damit keine UI-Baustelle explodiert.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {},
  header: {
    fontSize: 28,
    letterSpacing: -0.6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {},
  sectionTitle: {
    fontSize: 18,
  },
  option: {
    borderWidth: 1,
  },
  optionTitle: {
    fontSize: 16,
  },
  optionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  preview: {
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 16,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewDot: { width: 18, height: 18, borderRadius: 9 },
  previewLine: { flex: 1, height: 4, borderRadius: 999 },
  previewPill: { width: 72, height: 28, borderRadius: 999, borderWidth: 1 },
});

export default Settings;
