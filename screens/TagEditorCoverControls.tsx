import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import type { PickedTagCover } from '../utils/tagCoverPicker';

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
  const { theme } = useAppTheme();
  const hasReplacementCover = Boolean(replacementCover);
  const removeDisabled = !canWrite || !hasCover || saving || hasReplacementCover;
  const pickDisabled = !canWrite || saving;
  const previewUri = replacementCover?.uri ?? (!removeCover ? currentCoverUri : undefined);
  const shouldShowPreview = Boolean(previewUri || hasReplacementCover || removeCover);
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
        <View
          testID="cover-preview"
          style={[
            styles.coverPreviewWrap,
            {
              backgroundColor: theme.palette.surface,
              borderColor: theme.palette.border,
            },
          ]}
        >
          <View
            style={[
              styles.coverPreviewFrame,
              {
                backgroundColor: theme.palette.surfaceElevated,
                borderColor: theme.palette.borderStrong,
              },
            ]}
          >
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.coverPreview} testID="cover-preview-image" />
            ) : (
              <View style={styles.coverPreviewPlaceholder} testID="cover-preview-placeholder">
                <Text style={[styles.coverPreviewPlaceholderText, { color: theme.palette.text.muted }]}>
                  Kein Cover
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.previewTitle, { color: theme.palette.text.primary }]}>{previewTitle}</Text>
          <Text style={[styles.helperText, { color: theme.palette.text.secondary }]}>{previewDescription}</Text>
        </View>
      )}

      <Pressable
        testID="remove-cover"
        accessibilityRole="switch"
        accessibilityLabel="Cover entfernen"
        accessibilityState={{ checked: removeCover, disabled: removeDisabled }}
        style={[
          styles.toggle,
          {
            backgroundColor: theme.palette.surfaceElevated,
            borderColor: theme.palette.border,
          },
          hasReplacementCover && styles.disabledButton,
        ]}
        disabled={removeDisabled}
        onPress={onToggleRemoveCover}
      >
        <Text style={[styles.toggleText, { color: theme.palette.text.primary }]}>
          Cover entfernen: {removeCover ? 'Ja' : 'Nein'}
        </Text>
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
          {
            backgroundColor: theme.palette.surfaceElevated,
            borderColor: theme.palette.border,
          },
          pressed && styles.pressed,
          pickDisabled && styles.disabledButton,
        ]}
        onPress={onPickCover}
      >
        <Text style={[styles.toggleText, { color: theme.palette.text.primary }]}>
          Cover auswählen: {hasReplacementCover ? 'Ausgewählt' : 'JPG/PNG'}
        </Text>
        <Text style={[styles.helperText, { color: theme.palette.text.secondary }]}>
          Maximal 5 MB. Ein neues Cover ersetzt ein bestehendes Cover beim Speichern.
        </Text>
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  toggle: {
    padding: 12,
    borderRadius: APP_THEME_TOKENS.radii.input,
    borderWidth: 1,
  },
  toggleText: {},
  helperText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, marginTop: 6, textAlign: 'center' },
  coverPreviewWrap: {
    padding: 14,
    borderRadius: APP_THEME_TOKENS.radii.card,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  coverPreviewFrame: {
    width: 156,
    height: 156,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  coverPreview: { width: '100%', height: '100%' },
  coverPreviewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  coverPreviewPlaceholderText: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 12, textAlign: 'center' },
  previewTitle: { fontFamily: APP_THEME_TOKENS.fonts.heading, fontSize: 14, textAlign: 'center' },
  disabledButton: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});

export default TagEditorCoverControls;
