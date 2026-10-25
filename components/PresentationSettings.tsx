import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { usePlayerPresentation } from '../contexts/PlayerPresentationContext';
import { type LibraryDensity } from '../utils/playerPresentation';

const PresentationSettings = ({ section = 'all' }: { section?: 'all' | 'motion' | 'library' }) => {
  const { theme } = useAppTheme();
  const { presentation, setPresentation, isHydrated } = usePlayerPresentation();
  const titleStyle = { color: theme.palette.text.primary, fontFamily: theme.tokens.fonts.heading };
  const copyStyle = { color: theme.palette.text.secondary, fontFamily: theme.tokens.fonts.body };
  const option = (id: string, title: string, selected: boolean, onPress: () => void) => (
    <Pressable key={id} testID={`settings-${id}`} accessibilityRole="radio"
      accessibilityLabel={title} accessibilityState={{ checked: selected, disabled: !isHydrated }}
      disabled={!isHydrated} onPress={onPress} style={[styles.choice, {
        borderColor: selected ? theme.palette.primary : theme.palette.border,
        backgroundColor: selected ? theme.palette.surfaceElevated : theme.palette.surface,
      }]}><Text style={[styles.label, titleStyle]}>{title}</Text></Pressable>
  );
  return <View style={styles.section} testID="settings-presentation">
    {section === 'all' ? <Text style={[styles.heading, titleStyle]}>Bewegung & Bibliothek</Text> : null}
    {section !== 'library' ? <>
    <View style={[styles.quiet, { borderColor: theme.palette.border, backgroundColor: theme.palette.surface }]}>
      <View style={styles.copy}>
        <Text style={[styles.label, titleStyle]}>Animationen reduzieren</Text>
        <Text style={[styles.description, copyStyle]}>Weniger Bewegung und Leuchteffekte.</Text>
      </View>
      <Switch testID="settings-quiet-profile" accessibilityLabel="Animationen reduzieren"
        disabled={!isHydrated} value={presentation.quiet}
        onValueChange={quiet => setPresentation?.(previous => ({ ...previous, quiet }))} />
    </View>
    </> : null}
    {section !== 'motion' ? <>
    <Text style={[styles.label, titleStyle]}>Bibliotheksdichte</Text>
    <View style={styles.choices} accessibilityRole="radiogroup">
      {(['standard', 'compact'] as LibraryDensity[]).map(density => option(`density-${density}`,
        density === 'standard' ? 'Standard' : 'Kompakt', presentation.density === density,
        () => setPresentation?.(previous => ({ ...previous, density }))))}
    </View>
    </> : null}
  </View>;
};
const styles = StyleSheet.create({
  section: { gap: 10 }, heading: { fontSize: 18 }, label: { fontSize: 16 },
  description: { fontSize: 12, lineHeight: 17 }, copy: { flex: 1, gap: 6 },
  quiet: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderRadius: 12 },
});
export default PresentationSettings;
