import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Music2 } from 'lucide-react-native';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import {
  APP_THEME_TOKENS,
  DEFAULT_APP_APPEARANCE,
  DEFAULT_APP_THEME_SKIN,
  getAppTheme,
} from '../utils/appTheme';

const AppLoading: React.FC = () => {
  const appTheme = useOptionalAppTheme();
  const fallbackTheme = useMemo(
    () => getAppTheme(DEFAULT_APP_APPEARANCE, DEFAULT_APP_THEME_SKIN),
    [],
  );
  const theme = appTheme?.theme ?? fallbackTheme;

  return (
    <View style={[styles.loading, { backgroundColor: theme.palette.background }]} testID="app-loading">
      <View
        style={[
          styles.logoMark,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.borderStrong,
          },
        ]}
        testID="app-loading-logo"
      >
        <Music2 color={theme.palette.primary} size={30} />
      </View>
      <Text style={[styles.title, { color: theme.palette.text.primary }]} testID="app-loading-title">
        k1w1-Musik
      </Text>
      <Text style={[styles.subtitle, { color: theme.palette.text.secondary }]} testID="app-loading-subtitle">
        Deine Bibliothek wird vorbereitet
      </Text>
      <ActivityIndicator size="large" color={theme.palette.primary} testID="app-loading-spinner" />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
    padding: APP_THEME_TOKENS.spacing.xl,
  },
  logoMark: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: APP_THEME_TOKENS.radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: APP_THEME_TOKENS.spacing.xs,
  },
  title: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 13,
    marginBottom: APP_THEME_TOKENS.spacing.md,
    textAlign: 'center',
  },
});

export default AppLoading;
