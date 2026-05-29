import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../theme';

interface EqualizerHeaderProps {
  eqEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}

const EqualizerHeader: React.FC<EqualizerHeaderProps> = ({
  eqEnabled,
  onToggleEnabled,
}) => (
  <>
    <Text style={styles.eyebrow}>SOUND</Text>
    <View style={styles.headerRow}>
      <Text style={styles.title}>Equalizer</Text>
      <Switch
        value={eqEnabled}
        onValueChange={onToggleEnabled}
        trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
        thumbColor={theme.palette.text.primary}
      />
    </View>
  </>
);

const styles = StyleSheet.create({
  eyebrow: { color: theme.palette.primary, fontSize: 10, letterSpacing: 1.8, fontFamily: theme.fonts.body },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  title: { fontSize: 32, fontFamily: theme.fonts.display, letterSpacing: -1, color: theme.palette.text.primary },
});

export default EqualizerHeader;
