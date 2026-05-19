import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { EditableTrackTags } from '../types/TagEdit';
import { theme } from '../theme';
import { FIELDS, type FormState } from './tagEditorHelpers';

interface TagEditorFieldsProps {
  form: FormState;
  editable: boolean;
  onChangeField: (key: keyof EditableTrackTags, value: string) => void;
}

const TagEditorFields: React.FC<TagEditorFieldsProps> = ({
  form,
  editable,
  onChangeField,
}) => (
  <>
    {FIELDS.map(field => (
      <View key={field.key} style={styles.fieldWrap}>
        <Text style={styles.label}>{field.label}</Text>
        <TextInput
          testID={`input-${field.key}`}
          placeholder="Nicht verfügbar"
          placeholderTextColor={theme.palette.text.muted}
          value={form[field.key]}
          editable={editable}
          onChangeText={value => onChangeField(field.key, value)}
          style={[styles.input, !editable && styles.inputReadOnly]}
        />
      </View>
    ))}
  </>
);

const styles = StyleSheet.create({
  fieldWrap: { gap: 4 },
  label: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body },
  input: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.radii.input,
    padding: 10,
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.body,
    backgroundColor: theme.palette.surface,
  },
  inputReadOnly: { opacity: 0.8 },
});

export default TagEditorFields;
