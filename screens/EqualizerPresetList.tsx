import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EqPresetName } from '../types/Song';
import { theme } from '../theme';
import { PRESET_KEYS, PRESET_LABELS } from './equalizerHelpers';

interface EqualizerPresetListProps {
  eqPreset: EqPresetName | 'custom';
  onApplyPreset: (preset: EqPresetName) => void;
}

const EqualizerPresetList: React.FC<EqualizerPresetListProps> = ({
  eqPreset,
  onApplyPreset,
}) => (
  <>
    <Text style={styles.sectionTitle}>Voreinstellungen</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
      {PRESET_KEYS.map(key => {
        const active = eqPreset === key;
        return (
          <Pressable
            key={key}
            onPress={() => onApplyPreset(key)}
            style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Equalizer-Preset ${PRESET_LABELS[key]} anwenden`}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.presetText, active && styles.presetTextActive]}>{PRESET_LABELS[key]}</Text>
          </Pressable>
        );
      })}
      {eqPreset === 'custom' && (
        <View style={[styles.preset, styles.presetActive]}>
          <Text style={[styles.presetText, styles.presetTextActive]}>Benutzerdefiniert</Text>
        </View>
      )}
    </ScrollView>
  </>
);

const styles = StyleSheet.create({
  sectionTitle: { color: theme.palette.text.muted, fontSize: 11, letterSpacing: 1.6, fontFamily: theme.fonts.body, marginBottom: theme.spacing.sm },
  presetRow: { flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs, paddingRight: theme.spacing.md },
  preset: { paddingHorizontal: theme.spacing.md, paddingVertical: 10, borderRadius: theme.borderRadius.pill, backgroundColor: theme.palette.surface, borderWidth: 1, borderColor: theme.palette.border },
  presetActive: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primaryDark },
  presetText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.heading, fontSize: 12, letterSpacing: 0.4 },
  presetTextActive: { color: theme.palette.text.onPrimary },
  pressed: { opacity: 0.75 },
});

export default EqualizerPresetList;
