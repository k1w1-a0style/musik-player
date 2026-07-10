import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EqPresetName } from '../types/Song';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { PRESET_KEYS, PRESET_LABELS } from './equalizerHelpers';

interface EqualizerPresetListProps {
  eqPreset: EqPresetName | 'custom';
  onApplyPreset: (preset: EqPresetName) => void;
}

const EqualizerPresetList: React.FC<EqualizerPresetListProps> = ({
  eqPreset,
  onApplyPreset,
}) => {
  const { theme } = useAppTheme();

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.palette.text.muted }]}>Voreinstellungen</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {PRESET_KEYS.map(key => {
          const active = eqPreset === key;
          return (
            <Pressable
              key={key}
              onPress={() => onApplyPreset(key)}
              style={({ pressed }) => [
                styles.preset,
                {
                  backgroundColor: active ? theme.palette.primary : theme.palette.surface,
                  borderColor: active ? theme.palette.primaryDark : theme.palette.border,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Equalizer-Preset ${PRESET_LABELS[key]} anwenden`}
              accessibilityState={{ selected: active }}
              testID={`equalizer-preset-${key}`}
            >
              <Text style={[styles.presetText, { color: active ? theme.palette.text.onPrimary : theme.palette.text.secondary }]}>
                {PRESET_LABELS[key]}
              </Text>
            </Pressable>
          );
        })}
        {eqPreset === 'custom' && (
          <View
            style={[
              styles.preset,
              {
                backgroundColor: theme.palette.primary,
                borderColor: theme.palette.primaryDark,
              },
            ]}
            testID="equalizer-preset-custom"
          >
            <Text style={[styles.presetText, { color: theme.palette.text.onPrimary }]}>Benutzerdefiniert</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, letterSpacing: 1.6, fontFamily: APP_THEME_TOKENS.fonts.body, marginBottom: APP_THEME_TOKENS.spacing.sm },
  presetRow: { flexDirection: 'row', gap: APP_THEME_TOKENS.spacing.sm, paddingVertical: APP_THEME_TOKENS.spacing.xs, paddingRight: APP_THEME_TOKENS.spacing.md },
  preset: { paddingHorizontal: APP_THEME_TOKENS.spacing.md, paddingVertical: 10, borderRadius: APP_THEME_TOKENS.radii.control, borderWidth: 1 },
  presetText: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 12, letterSpacing: 0.4 },
  pressed: { opacity: 0.75 },
});

export default EqualizerPresetList;
