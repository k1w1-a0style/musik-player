import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import { theme } from '../theme';

interface TagEditorCoverControlsProps {
  canWrite: boolean;
  saving: boolean;
  hasCover: boolean;
  currentCoverUri?: string;
  removeCover: boolean;
  replacementCover: PickedTagCover | null;
  onToggleRemoveCover: () => void;
  onPickCover: () => void;
}

const TagEditorCoverControls: React.FC<TagEditorCoverControlsProps> = ({
  canWrite,
  saving,
  hasCover,
  currentCoverUri,
  removeCover,
  replacementCover,
  onToggleRemoveCover,
  onPickCover,
}) => {
  const hasReplacementCover = Boolean(replacementCover);
  const removeDisabled = !canWrite || !hasCover || saving || hasReplacementCover;
  const pickDisabled = !canWrite || saving;
  const previewUri = replacementCover?.uri ?? (!removeCover ? currentCoverUri : undefined);
  const shouldShowPreview = Boolean(hasCover || hasReplacementCover || removeCover);
  const previewTitle = hasReplacementCover
    ? 'Ausgewähltes neues Cover'
    : removeCover
      ? 'Cover wird beim Speichern entfernt'
      : 'Aktuelles Cover';
  const previewDescription = hasReplacementCover && replacementCover
    ? `${replacementCover.mimeType} · ${Math.round(replacementCover.sizeBytes / 1024)} KB`
    : removeCover
      ? 'Das vorhandene Cover bleibt sichtbar, bis du speicherst.'
      : 'Dieses Cover ist aktuell im Titel gespeichert.';

  return (
    <>
      {shouldShowPreview && (
        <View testID="cover-preview" style={styles.coverPreviewWrap}>
          <View style={styles.coverPreviewFrame}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.coverPreview} testID="cover-preview-image" />
            ) : (
              <View style={styles.coverPreviewPlaceholder} testID="cover-preview-placeholder">
                <Text style={styles.coverPreviewPlaceholderText}>Kein Cover</Text>
              </View>
            )}
          </View>
          <Text style={styles.previewTitle}>{previewTitle}</Text>
          <Text style={styles.helperText}>{previewDescription}</Text>
        </View>
      )}

      <Pressable
        testID="remove-cover"
        accessibilityRole="switch"
        accessibilityLabel="Cover entfernen"
        accessibilityState={{ checked: removeCover, disabled: removeDisabled }}
        style={[styles.toggle, hasReplacementCover && styles.disabledButton]}
        disabled={removeDisabled}
        onPress={onToggleRemoveCover}
      >
        <Text style={styles.toggleText}>Cover entfernen: {removeCover ? 'Ja' : 'Nein'}</Text>
      </Pressable>

      <Pressable
        testID="pick-cover"
        accessibilityRole="button"
        accessibilityLabel={
          hasReplacementCover
            ? 'Cover ausgewählt — tippen zum Ändern'
            : 'Cover auswählen (JPG/PNG, max. 5 MB)'
        }
        accessibilityState={{ disabled: pickDisabled }}
        disabled={pickDisabled}
        style={({ pressed }) => [
          styles.toggle,
          pressed && styles.pressed,
          pickDisabled && styles.disabledButton,
        ]}
        onPress={onPickCover}
      >
        <Text style={styles.toggleText}>
          Cover auswählen: {hasReplacementCover ? 'Ausgewählt' : 'JPG/PNG'}
        </Text>
        <Text style={styles.helperText}>
          Maximal 5 MB. Ein neues Cover ersetzt ein bestehendes Cover beim Speichern.
        </Text>
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  toggle: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  toggleText: { color: theme.palette.text.primary },
  helperText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 6, textAlign: 'center' },
  coverPreviewWrap: {
    padding: 14,
    borderRadius: theme.radii.card,
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
    gap: 8,
  },
  coverPreviewFrame: {
    width: 156,
    height: 156,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: theme.palette.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPreviewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  coverPreviewPlaceholderText: { color: theme.palette.text.muted, fontFamily: theme.fonts.body, fontSize: 12, textAlign: 'center' },
  previewTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 14, textAlign: 'center' },
  disabledButton: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});

export default TagEditorCoverControls;