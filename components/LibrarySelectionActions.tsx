import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLibrarySelection } from '../contexts/LibrarySelectionContext';
import { useAppTheme } from '../contexts/AppThemeContext';

const SelectionButton: React.FC<{ label: string; onPress: () => void; disabled?: boolean }> = ({ label, onPress, disabled }) => {
  const { theme } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled}
    onPress={onPress} style={[styles.button, { borderColor: theme.palette.border, opacity: disabled ? .5 : 1 }]}>
    <Text style={[styles.text, { color: theme.palette.text.primary }]}>{label}</Text>
  </Pressable>;
};
const LibrarySelectionActions: React.FC = () => {
  const selection = useLibrarySelection();
  return selection ? <ActiveSelectionActions selection={selection} /> : null;
};
const ActiveSelectionActions: React.FC<{ selection: NonNullable<ReturnType<typeof useLibrarySelection>> }> = ({ selection }) => {
  const snapshot = useSyncExternalStore(selection.store.subscribe, selection.store.getSnapshot);
  const { theme } = useAppTheme();
  if (!snapshot.active) return null;
  return <View style={[styles.bar, { borderColor: theme.palette.border }]} testID="library-selection-actions">
    <Text style={[styles.text, { color: theme.palette.text.primary }]} accessibilityLiveRegion="polite">
      {snapshot.count} ausgewählt · {snapshot.visibleCount} auf dieser Liste
    </Text>
    <View style={styles.buttons}>
      {snapshot.visibleCount > 0 ? <SelectionButton label="Alle auf dieser Liste auswählen" onPress={selection.store.selectVisible} /> : null}
      {snapshot.count > 0 ? <SelectionButton label="Auswahl aufheben" onPress={selection.store.clear} /> : null}
      {snapshot.count > 0 ? <SelectionButton label="Tags bereinigen" onPress={selection.openSelected} /> : null}
      <SelectionButton label="Auswahl beenden" onPress={selection.store.close} />
    </View>
  </View>;
};
const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingVertical: 6, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  button: { minHeight: 48, maxWidth: '100%', flexShrink: 1, justifyContent: 'center', paddingHorizontal: 10,
    paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  text: { fontSize: 12 },
});
export default LibrarySelectionActions;
