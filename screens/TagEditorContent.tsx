import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { EditableTrackTags, TagEditCapability } from '../types/TagEdit';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import TagEditorActions from './TagEditorActions';
import TagEditorCoverControls from './TagEditorCoverControls';
import TagEditorFields from './TagEditorFields';
import TagEditorNotices from './TagEditorNotices';
import type { FormState } from './tagEditorHelpers';

interface TagEditorContentProps {
  form: FormState;
  saving: boolean;
  removeCover: boolean;
  replacementCover: PickedTagCover | null;
  currentCoverUri?: string;
  status: string | null;
  capability: TagEditCapability;
  hasCover: boolean;
  canSave: boolean;
  canWriteCover: boolean;
  coverCapabilityMessage?: string;
  capabilityMessage?: string;
  blockedReasonMessage?: string;
  safetyMessage?: string;
  onPickCover: () => void;
  onChangeField: (key: keyof EditableTrackTags, value: string) => void;
  onToggleRemoveCover: () => void;
  onConfirmSave: () => void;
  onBack: () => void;
}

const TagEditorContent: React.FC<TagEditorContentProps> = ({
  form,
  saving,
  removeCover,
  replacementCover,
  currentCoverUri,
  status,
  capability,
  hasCover,
  canSave,
  canWriteCover,
  coverCapabilityMessage,
  capabilityMessage,
  blockedReasonMessage,
  safetyMessage,
  onPickCover,
  onChangeField,
  onToggleRemoveCover,
  onConfirmSave,
  onBack,
}) => {
  const { theme } = useAppTheme();

  return (
    <AppBackground>
      <Screen contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.header, { color: theme.palette.text.primary }]}>Tag Editor</Text>
          <TagEditorNotices
            capabilityMessage={capabilityMessage}
            blockedReasonMessage={blockedReasonMessage}
            safetyMessage={safetyMessage}
          />

          <TagEditorFields
            form={form}
            editable={capability.canWrite && !saving}
            onChangeField={onChangeField}
          />

          <TagEditorCoverControls
            canWrite={canWriteCover}
            saving={saving}
            hasCover={hasCover}
            currentCoverUri={currentCoverUri}
            removeCover={removeCover}
            replacementCover={replacementCover}
            onToggleRemoveCover={onToggleRemoveCover}
            onPickCover={onPickCover}
            unsupportedMessage={coverCapabilityMessage}
          />

          <TagEditorActions
            canSave={canSave}
            saving={saving}
            status={status}
            onConfirmSave={onConfirmSave}
            onBack={onBack}
          />
        </ScrollView>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: APP_THEME_TOKENS.spacing.md, gap: 10 },
  header: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 22,
  },
});

export default TagEditorContent;
