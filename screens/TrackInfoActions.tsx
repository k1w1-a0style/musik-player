import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

const dangerColor = theme.palette.error;

interface TrackInfoActionsProps {
  onOpenTagEditor: () => void;
  onRemoveFromLibrary: () => void;
}

const TrackInfoActions: React.FC<TrackInfoActionsProps> = ({
  onOpenTagEditor,
  onRemoveFromLibrary,
}) => (
  <>
    <View style={styles.actionRow}>
      <Pressable accessibilityRole="button" style={styles.editButton} onPress={onOpenTagEditor}>
        <Text style={styles.editButtonText}>ID3/M4A Tags bearbeiten</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Track aus Bibliothek entfernen"
        style={styles.removeButton}
        onPress={onRemoveFromLibrary}
      >
        <Text style={styles.removeButtonText}>Aus Bibliothek entfernen</Text>
      </Pressable>
    </View>
    <Text style={styles.hint}>Hinweis: Entfernen löscht nicht die Datei vom Gerät.</Text>
  </>
);

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  editButton: { backgroundColor: theme.palette.primary, borderRadius: theme.radii.input, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  editButtonText: { color: theme.palette.text.onPrimary, fontFamily: theme.fonts.heading, fontSize: 13 },
  removeButton: { borderRadius: theme.radii.input, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: dangerColor },
  removeButtonText: { color: dangerColor, fontFamily: theme.fonts.heading, fontSize: 13 },
  hint: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12, marginBottom: 4 },
});

export default TrackInfoActions;
