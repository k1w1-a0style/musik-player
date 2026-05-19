import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';
import type { EditableTrackTags, TagWriterErrorCode } from '../types/TagEdit';
import { getTagEditCapability } from '../utils/tagEditCapability';
import { createTagWriteOperationPlan } from '../utils/tagWriteOrchestrator';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import { pickTagEditorCover } from './tagEditorCoverPicker';
import {
  blockingReasonMessage,
  buildDraftFromDirtyFields,
  buildFormAfterSave,
  buildMetadataPatchFromDraft,
  capabilityReason,
  ERROR_MESSAGES,
  FIELDS,
  type FormState,
  hasRemovableCover,
  safetyNotice,
  statusMessage,
  toInitialForm,
} from './tagEditorHelpers';

export { buildDraftFromDirtyFields, hasRemovableCover } from './tagEditorHelpers';

type TagEditorRoute = RouteProp<AppStackParamList, 'TagEditor'>;

const TagEditor: React.FC = () => {
  const route = useRoute<TagEditorRoute>();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { songs, updateSongMetadata } = useLibraryMusicContext();
  const song = useMemo(
    () => songs.find(s => s.id === route.params.songId),
    [songs, route.params.songId],
  );
  const [saving, setSaving] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [replacementCover, setReplacementCover] = useState<PickedTagCover | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    song ? toInitialForm(song) : toInitialForm({ id: '', title: '', artist: '' } as Song),
  );
  const [dirty, setDirty] = useState<Partial<Record<keyof EditableTrackTags, boolean>>>(
    {},
  );

  useEffect(() => {
    if (!song) return;
    setForm(toInitialForm(song));
    setDirty({});
    setRemoveCover(false);
    setReplacementCover(null);
    setStatus(null);
  }, [song?.id]);

  if (!song) {
    return (
      <AppBackground>
        <Screen contentStyle={styles.container}>
          <Text style={styles.error}>Song nicht gefunden.</Text>
        </Screen>
      </AppBackground>
    );
  }

  const draft = buildDraftFromDirtyFields(song.id, form, dirty, removeCover, replacementCover);
  const capability = getTagEditCapability(song);
  const plan = createTagWriteOperationPlan(song, draft);
  const hasCover = hasRemovableCover(song);
  const hasReplacementCover = Boolean(replacementCover);
  const hasChanges = Object.keys(draft.tags).length > 0 || draft.removeCover === true || hasReplacementCover;
  const canSave =
    capability.canWrite && hasChanges && plan.blockingReasons.length === 0 && !saving;
  const blockedReasonMessage = blockingReasonMessage(
    plan.blockingReasons as TagWriterErrorCode[],
  );
  const safetyMessage = safetyNotice(song);

  const handlePickCover = async (): Promise<void> => {
    if (!capability.canWrite || saving) return;

    const result = await pickTagEditorCover();
    setStatus(result.message);

    if (result.status !== 'selected') return;

    setReplacementCover(result.cover);
    setRemoveCover(false);
  };

  const onSaveConfirmed = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await writeTagsToFile(song, draft);
      if (result.status === 'written') {
        const metadataPatch = buildMetadataPatchFromDraft(draft, replacementCover);
        updateSongMetadata(song.id, metadataPatch);
        const updatedSong: Song = { ...song, ...metadataPatch };
        setForm(buildFormAfterSave(updatedSong, form, draft));
        setDirty({});
        setRemoveCover(false);
        setReplacementCover(null);
      } else if (result.status === 'noop') {
        setForm(current => buildFormAfterSave(song, current, draft));
        setDirty({});
        setRemoveCover(false);
        setReplacementCover(null);
      }
      setStatus(statusMessage(result));
    } catch (error) {
      if (error instanceof TagWriterError) {
        setStatus(ERROR_MESSAGES[error.code] ?? 'Speichern fehlgeschlagen.');
      } else {
        setStatus('Speichern fehlgeschlagen.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBackground>
      <Screen contentStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.header}>Tag Editor</Text>
          {!capability.canWrite && (
            <View style={styles.warningBox}>
              <Text style={styles.warning}>{capabilityReason(capability.reason)}</Text>
            </View>
          )}
          {!!blockedReasonMessage && (
            <View style={styles.warningBox}>
              <Text style={styles.warning}>{blockedReasonMessage}</Text>
            </View>
          )}
          {!!safetyMessage && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{safetyMessage}</Text>
            </View>
          )}

          {FIELDS.map(field => (
            <View key={field.key} style={styles.fieldWrap}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                testID={`input-${field.key}`}
                placeholder="Nicht verfügbar"
                placeholderTextColor={theme.palette.text.muted}
                value={form[field.key]}
                editable={capability.canWrite && !saving}
                onChangeText={value => {
                  setForm(prev => ({ ...prev, [field.key]: value }));
                  setDirty(prev => ({ ...prev, [field.key]: true }));
                }}
                style={[styles.input, !capability.canWrite && styles.inputReadOnly]}
              />
            </View>
          ))}

          <Pressable
            testID="remove-cover"
            accessibilityRole="switch"
            accessibilityState={{
              checked: removeCover,
              disabled: !capability.canWrite || !hasCover || saving || hasReplacementCover,
            }}
            style={[styles.toggle, hasReplacementCover && styles.disabledButton]}
            disabled={!capability.canWrite || !hasCover || saving || hasReplacementCover}
            onPress={() => {
              setReplacementCover(null);
              setRemoveCover(v => !v);
            }}
          >
            <Text style={styles.toggleText}>
              Cover entfernen: {removeCover ? 'Ja' : 'Nein'}
            </Text>
          </Pressable>

          <Pressable
            testID="pick-cover"
            accessibilityRole="button"
            accessibilityState={{ disabled: !capability.canWrite || saving }}
            disabled={!capability.canWrite || saving}
            style={({ pressed }) => [
              styles.toggle,
              pressed && styles.pressed,
              (!capability.canWrite || saving) && styles.disabledButton,
            ]}
            onPress={() => {
              void handlePickCover();
            }}
          >
            <Text style={styles.toggleText}>
              Cover auswählen: {hasReplacementCover ? 'Ausgewählt' : 'JPG/PNG'}
            </Text>
            <Text style={styles.helperText}>
              Maximal 5 MB. Ein neues Cover ersetzt ein bestehendes Cover beim Speichern.
            </Text>
          </Pressable>

          {replacementCover?.uri && (
            <View testID="cover-preview" style={styles.coverPreviewWrap}>
              <Image source={{ uri: replacementCover.uri }} style={styles.coverPreview} />
              <Text style={styles.helperText}>
                {replacementCover.mimeType} · {Math.round(replacementCover.sizeBytes / 1024)} KB
              </Text>
            </View>
          )}

          <Pressable
            testID="save-button"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.saveButton, !canSave && styles.disabledButton]}
            disabled={!canSave}
            onPress={() =>
              Alert.alert('Bestätigung', 'Metadaten wirklich in Datei schreiben?', [
                { text: 'Abbrechen', style: 'cancel' },
                {
                  text: 'Speichern',
                  onPress: () => {
                    void onSaveConfirmed();
                  },
                },
              ])
            }
          >
            <Text style={styles.saveText}>{saving ? 'Speichern…' : 'Speichern'}</Text>
          </Pressable>

          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.saveText}>Zurück</Text>
          </Pressable>
          {status && <Text style={styles.status}>{status}</Text>}
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
  toggle: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  toggleText: { color: theme.palette.text.primary },
  helperText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 6 },
  coverPreviewWrap: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
    gap: 8,
  },
  coverPreview: { width: 130, height: 130, borderRadius: 18 },
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
  pressed: { opacity: 0.72 },
  saveText: {
    color: theme.palette.text.primary,
    textAlign: 'center',
    fontFamily: theme.fonts.heading,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 111, 138, 0.12)',
    borderColor: 'rgba(255, 111, 138, 0.4)',
    borderWidth: 1,
    borderRadius: theme.radii.input,
    padding: 10,
  },
  warning: { color: theme.palette.error, fontFamily: theme.fonts.body },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: theme.palette.border,
    borderWidth: 1,
    borderRadius: theme.radii.input,
    padding: 10,
  },
  infoText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body },
  status: { color: theme.palette.text.secondary },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading },
});

export default TagEditor;
