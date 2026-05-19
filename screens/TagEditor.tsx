import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
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
import TagEditorActions from './TagEditorActions';
import TagEditorCoverControls from './TagEditorCoverControls';
import TagEditorFields from './TagEditorFields';
import TagEditorNotices from './TagEditorNotices';
import {
  blockingReasonMessage,
  buildDraftFromDirtyFields,
  buildFormAfterSave,
  buildMetadataPatchFromDraft,
  capabilityReason,
  ERROR_MESSAGES,
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
  const capabilityMessage = capability.canWrite ? undefined : capabilityReason(capability.reason);
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

  const handleChangeField = (key: keyof EditableTrackTags, value: string): void => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(prev => ({ ...prev, [key]: true }));
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
            onToggleRemoveCover={() => {
              setReplacementCover(null);
              setRemoveCover(v => !v);
            }}
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
            onBack={() => navigation.goBack()}
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
