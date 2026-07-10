import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

interface EqualizerHeaderProps {
  eqEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}

const EqualizerHeader: React.FC<EqualizerHeaderProps> = ({
  eqEnabled,
  onToggleEnabled,
}) => {
  const { theme } = useAppTheme();

  return (
    <>
      <Text style={[styles.eyebrow, { color: theme.palette.primary }]}>SOUND</Text>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.palette.text.primary }]}>Equalizer</Text>
        <Switch
          value={eqEnabled}
          onValueChange={onToggleEnabled}
          trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
          thumbColor={theme.palette.text.primary}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10, letterSpacing: 1.8, fontFamily: APP_THEME_TOKENS.fonts.body },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: APP_THEME_TOKENS.spacing.md },
  title: { fontSize: 32, fontFamily: APP_THEME_TOKENS.fonts.display, letterSpacing: -1 },
});

export default EqualizerHeader;
