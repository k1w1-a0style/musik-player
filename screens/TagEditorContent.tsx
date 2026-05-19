import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { EditableTrackTags, TagEditCapability } from '../types/TagEdit';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
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
  status: string | null;
  capability: TagEditCapability;
  hasCover: boolean;
  canSave: boolean;
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
  status,
  capability,
  hasCover,
  canSave,
  capabilityMessage,
  blockedReasonMessage,
  safetyMessage,
  onPickCover,
  onChangeField,
  onToggleRemoveCover,
  onConfirmSave,
  onBack,
}) => (
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
          onChangeField={onChangeField}
        />

        <TagEditorCoverControls
          canWrite={capability.canWrite}
          saving={saving}
          hasCover={hasCover}
          removeCover={removeCover}
          replacementCover={replacementCover}
          onToggleRemoveCover={onToggleRemoveCover}
          onPickCover={onPickCover}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing.md, gap: 10 },
  header: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
  },
});

export default TagEditorContent;
