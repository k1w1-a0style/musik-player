import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

interface TagEditorActionsProps {
  canSave: boolean;
  saving: boolean;
  status: string | null;
  onConfirmSave: () => void;
  onBack: () => void;
}

const TagEditorActions: React.FC<TagEditorActionsProps> = ({
  canSave,
  saving,
  status,
  onConfirmSave,
  onBack,
}) => (
  <>
    <Pressable
      testID="save-button"
      accessibilityRole="button"
      accessibilityLabel={saving ? 'Speichern läuft' : 'Metadaten speichern'}
      accessibilityState={{ disabled: !canSave }}
      style={[styles.saveButton, !canSave && styles.disabledButton]}
      disabled={!canSave}
      onPress={() =>
        Alert.alert('Bestätigung', 'Metadaten wirklich in Datei schreiben?', [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Speichern',
            onPress: onConfirmSave,
          },
        ])
      }
    >
      <Text style={styles.saveText}>{saving ? 'Speichern…' : 'Speichern'}</Text>
    </Pressable>

    <Pressable
      style={styles.backButton}
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Zurück"
    >
      <Text style={styles.saveText}>Zurück</Text>
    </Pressable>
    {status && <Text style={styles.status}>{status}</Text>}
  </>
);

const styles = StyleSheet.create({
  saveButton: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.primary,
  },
  backButton: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.surfaceElevated,
  },
  disabledButton: { opacity: 0.5 },
  saveText: {
    color: theme.palette.text.primary,
    textAlign: 'center',
    fontFamily: theme.fonts.heading,
  },
  status: { color: theme.palette.text.secondary },
});

export default TagEditorActions;
