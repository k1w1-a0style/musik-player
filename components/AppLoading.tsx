import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Music2 } from 'lucide-react-native';
import { useOptionalAppTheme } from '../contexts/AppThemeContext';
import {
  APP_THEME_TOKENS,
  DEFAULT_APP_APPEARANCE,
  DEFAULT_APP_THEME_SKIN,
  getAppTheme,
} from '../utils/appTheme';

interface AppLoadingProps { degraded?: boolean; onRetry?: () => void }

const AppLoading: React.FC<AppLoadingProps> = ({ degraded = false, onRetry }) => {
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
        {degraded ? 'Die Wiedergabewarteschlange konnte nicht bestätigt werden.' : 'Deine Bibliothek wird vorbereitet'}
      </Text>
      {degraded ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Erneut versuchen"
          onPress={onRetry} testID="hydration-retry-button"
          style={[styles.retryButton, { backgroundColor: theme.palette.primary }]}>
          <Text style={[styles.retryText, { color: theme.palette.background }]}>Erneut versuchen</Text>
        </Pressable>
      ) : <ActivityIndicator size="large" color={theme.palette.primary} testID="app-loading-spinner" />}
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
  retryButton: { borderRadius: APP_THEME_TOKENS.radii.input, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 13 },
});

export default AppLoading;
