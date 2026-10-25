import React, { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SettingsGroup } from '../components/SettingsGroup';
import { Palette, Play, Sparkles, Music2, Database } from 'lucide-react-native';
import LibraryUpdateSettings from '../components/LibraryUpdateSettings';
import AppBackground from '../components/AppBackground';
import PresentationSettings from '../components/PresentationSettings';
import AccentSettings from '../components/AccentSettings';
import BackupSettings from '../components/BackupSettings';
import ResumeSettings from '../components/ResumeSettings';
import TagCleanerSettings from '../components/TagCleanerSettings';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
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
  NOW_PLAYING_PLAYER_LAYOUT_DESCRIPTIONS,
  NOW_PLAYING_PLAYER_LAYOUT_LABELS,
  NOW_PLAYING_PLAYER_LAYOUTS,
  type NowPlayingPlayerLayout,
} from '../utils/nowPlayingControlsMode';

type SettingsNavigation = NativeStackNavigationProp<AppStackParamList, 'Settings'>;
const getOpenCleanerAction = (navigation?: SettingsNavigation): (() => void) | undefined =>
  navigation ? () => navigation.navigate(APP_STACK_ROUTES.TAG_CLEANER) : undefined;
const useSettingsContentInsets = () => useContext(SafeAreaInsetsContext)
  ?? { bottom: 0, left: 0, right: 0 };

const Settings: React.FC<{ navigation?: SettingsNavigation }> = ({ navigation }) => {
  const { appearance, skin, theme, setAppearance, setSkin } = useAppTheme();
  const { mode: nowPlayingPlayerLayout, setMode: setNowPlayingPlayerLayout } = useNowPlayingControlsMode();
  const { fonts, radii, spacing } = theme.tokens;
  const insets = useSettingsContentInsets();
  const optionTokenStyle = {
    borderRadius: radii.card,
    gap: spacing.xs,
    padding: spacing.sm,
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
            ? 'Neutrale Farben'
            : option === 'minimal'
              ? 'Reduzierte Oberfläche'
              : 'Leuchtende Cover-Akzente'}
        </Text>
      </Pressable>
    );
  };

  const renderNowPlayingPlayerLayoutOption = (option: NowPlayingPlayerLayout) => {
    const selected = option === nowPlayingPlayerLayout;
    return (
      <Pressable
        key={option}
        testID={`settings-player-layout-${option}`}
        accessibilityRole="button"
        accessibilityLabel={`Player-Ansicht ${NOW_PLAYING_PLAYER_LAYOUT_LABELS[option]}`}
        accessibilityState={{ selected }}
        onPress={() => setNowPlayingPlayerLayout(option)}
        style={[
          styles.option,
          optionTokenStyle,
          {
            backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
            borderColor: selected ? theme.palette.primary : theme.palette.border,
          },
        ]}
      >
        <Text style={[styles.optionTitle, optionTitleTokenStyle, { color: theme.palette.text.primary }]}>{NOW_PLAYING_PLAYER_LAYOUT_LABELS[option]}</Text>
        <Text style={[styles.optionSubtitle, optionSubtitleTokenStyle, { color: theme.palette.text.secondary }]}>{NOW_PLAYING_PLAYER_LAYOUT_DESCRIPTIONS[option]}</Text>
      </Pressable>
    );
  };

  return (
    <AppBackground><View style={[styles.root, { paddingBottom: insets.bottom,
      paddingLeft: insets.left, paddingRight: insets.right }]} testID="settings-screen">
      <ScrollView
        testID="settings-scroll"
        contentContainerStyle={[styles.content, { gap: spacing.md, padding: spacing.md }]}
      >

        <SettingsGroup id="appearance" icon={Palette} title="Darstellung" summary={`${APP_APPEARANCE_LABELS[appearance]} · ${APP_THEME_SKIN_LABELS[skin]} · App, Player, Waveform`}>
        <AccentSettings />
        <View style={[styles.section, sectionTokenStyle]}>
          <Text style={[styles.sectionTitle, sectionTitleTokenStyle, { color: theme.palette.text.primary }]}>Hell / Dunkel</Text>
          {APP_APPEARANCES.map(renderAppearanceOption)}
        </View>

        <View style={[styles.section, sectionTokenStyle]}>
          <Text style={[styles.sectionTitle, sectionTitleTokenStyle, { color: theme.palette.text.primary }]}>Oberfläche</Text>
          {APP_THEME_SKINS.map(renderSkinOption)}
        </View>

        <ThemePreview />
        </SettingsGroup>
        <SettingsGroup id="player" icon={Play} title="Player" summary={`${NOW_PLAYING_PLAYER_LAYOUT_LABELS[nowPlayingPlayerLayout]} · Wiedergabe fortsetzen`}>
        <ResumeSettings />
        <View style={[styles.section, sectionTokenStyle]}>
          <Text style={[styles.sectionTitle, sectionTitleTokenStyle, { color: theme.palette.text.primary }]}>Player-Ansicht</Text>
          {NOW_PLAYING_PLAYER_LAYOUTS.map(renderNowPlayingPlayerLayoutOption)}
        </View>
        </SettingsGroup>
        <SettingsGroup id="motion" icon={Sparkles} title="Animationen" summary="Bewegung reduzieren · Cover-Puls">
          <CoverBassPulseSetting /><PresentationSettings section="motion" />
        </SettingsGroup>
        <SettingsGroup id="library" icon={Music2} title="Musikbibliothek" summary="Aktualisierung · Listendichte · Aufräumen">
          <LibraryUpdateSettings /><PresentationSettings section="library" />
          <TagCleanerSettings onOpen={getOpenCleanerAction(navigation)} />
        </SettingsGroup>
        <SettingsGroup id="data" icon={Database} title="Daten" summary="Backup · Wiederherstellung">
          <BackupSettings />
        </SettingsGroup>
      </ScrollView>
    </View>
    </AppBackground>
  );
};

const ThemePreview = () => {
  const { theme } = useAppTheme();
  const { fonts, radii, spacing } = theme.tokens;
  return (
        <View
          testID="settings-theme-preview"
          style={[
            styles.preview,
            {
              backgroundColor: theme.palette.surfaceGlass,
              borderColor: theme.palette.borderStrong,
              borderRadius: radii.elevatedCard,
              gap: spacing.md,
              padding: spacing.sm,
            },
          ]}
        >
          <Text style={[styles.previewTitle, { color: theme.palette.text.primary, fontFamily: fonts.heading }]}>{theme.label}</Text>
          <View style={[styles.previewRow, { gap: spacing.sm }]}>
            <View style={[styles.previewDot, { backgroundColor: theme.palette.primary }]} />
            <View style={[styles.previewLine, { backgroundColor: theme.palette.borderStrong }]} />
            <View style={[styles.previewPill, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]} />
          </View>
          <Text style={[styles.optionSubtitle, { fontFamily: fonts.body }, { color: theme.palette.text.secondary }]}>So wirkt deine aktuelle Auswahl im Player und in der Bibliothek.</Text>
        </View>
  );
};

const CoverBassPulseSetting = () => {
  const { theme, bassPulseEnabled, setBassPulseEnabled } = useAppTheme();
  const { fonts, radii, spacing } = theme.tokens;
  return <View testID="settings-cover-bass-pulse-option" style={[styles.option, styles.bassOption, {
    backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border,
    borderRadius: radii.card, gap: spacing.xs, padding: spacing.md,
  }]}>
    <View style={styles.bassCopy}>
      <Text style={[styles.optionTitle, { color: theme.palette.text.primary, fontFamily: fonts.heading }]}>Cover-Puls zum Bass</Text>
      <Text style={[styles.optionSubtitle, { color: theme.palette.text.secondary, fontFamily: fonts.body }]}>Bewegt das Cover zu Bass und Kickdrum in der klassischen Ansicht.</Text>
    </View>
    <Switch testID="settings-cover-bass-pulse" accessibilityLabel="Cover-Puls zum Bass"
      value={bassPulseEnabled ?? false} onValueChange={setBassPulseEnabled}
      trackColor={{ false: theme.palette.borderStrong, true: theme.palette.primary }} />
  </View>;
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {},
  section: {},
  sectionTitle: {
    fontSize: 15, fontWeight: '600',
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth, minHeight: 48,
  },
  optionTitle: {
    fontSize: 16,
  },
  optionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  bassOption: { flexDirection: 'row', alignItems: 'center' },
  bassCopy: { flex: 1, gap: 5 },
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
