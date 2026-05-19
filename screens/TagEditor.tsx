import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import { buildDraftFromDirtyFields, hasRemovableCover } from './tagEditorHelpers';
import TagEditorActions from './TagEditorActions';
import TagEditorCoverControls from './TagEditorCoverControls';
import TagEditorFields from './TagEditorFields';
import TagEditorNotices from './TagEditorNotices';
import { useTagEditorScreenState } from './useTagEditorScreenState';

export { buildDraftFromDirtyFields, hasRemovableCover } from './tagEditorHelpers';

const TagEditor: React.FC = () => {
  const {
    song,
    form,
    saving,
    removeCover,
    replacementCover,
    status,
    capability,
    hasCover,
    canSave,
    capabilityMessage,
    blockedReasonMessage,
    safetyMessage,
    handlePickCover,
    handleChangeField,
    toggleRemoveCover,
    onSaveConfirmed,
    goBack,
  } = useTagEditorScreenState();

  if (!song) {
    return (
      <AppBackground>
        <Screen contentStyle={styles.container}>
          <Text style={styles.error}>Song nicht gefunden.</Text>
        </Screen>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Screen contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.header}>Tag Editor</Text>
          <TagEditorNotices
            capabilityMessage={capabilityMessage}
            blockedReasonMessage={blockedReasonMessage}
            safetyMessage={safetyMessage}
          />

          <TagEditorFields
            form={form}
            editable={capability.canWrite && !saving}
            onChangeField={handleChangeField}
          />

          <TagEditorCoverControls
            canWrite={capability.canWrite}
            saving={saving}
            hasCover={hasCover}
            removeCover={removeCover}
            replacementCover={replacementCover}
            onToggleRemoveCover={toggleRemoveCover}
            onPickCover={() => {
              void handlePickCover();
            }}
          />

          <TagEditorActions
            canSave={canSave}
            saving={saving}
            status={status}
            onConfirmSave={() => {
              void onSaveConfirmed();
            }}
            onBack={goBack}
          />
        </ScrollView>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing.md, gap: 10 },
  header: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
  },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading },
});

export default TagEditor;
