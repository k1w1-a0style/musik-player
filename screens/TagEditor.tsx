import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import type { Song, SongCoverInfo } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';
import type { EditableTrackTags, TagEditDraft, TagWriterErrorCode, WriteTagsResult } from '../types/TagEdit';
import { getTagEditCapability } from '../utils/tagEditCapability';
import { createTagWriteOperationPlan } from '../utils/tagWriteOrchestrator';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';
import { normalizeEditableTags } from '../utils/tagValidation';

type TagEditorRoute = RouteProp<AppStackParamList, 'TagEditor'>;

type FormState = Record<keyof EditableTrackTags, string>;

const FIELDS: Array<{ key: keyof EditableTrackTags; label: string }> = [
  { key: 'title', label: 'Titel' },
  { key: 'artist', label: 'Künstler' },
  { key: 'album', label: 'Album' },
  { key: 'year', label: 'Jahr' },
  { key: 'genre', label: 'Genre' },
  { key: 'trackNumber', label: 'Tracknummer' },
  { key: 'discNumber', label: 'Discnummer' },
  { key: 'comment', label: 'Kommentar' },
];

const ERROR_MESSAGES: Record<TagWriterErrorCode, string> = {
  MissingWritePermission: 'content:// Schreiben ist noch nicht unterstützt.',
  UnsupportedUri: 'URI ist nicht schreibbar (remote/unknown).',
  UnsupportedFormat: 'Format wird aktuell nicht unterstützt.',
  WriteNotImplemented: 'Sicheres Ersetzen auf dieser Plattform noch nicht unterstützt.',
  InvalidTagData: 'Ungültige Metadaten. Bitte Eingaben prüfen.',
  BackupFailed: 'Backup konnte nicht erstellt werden.',
  TempWriteFailed: 'Temporäre Datei konnte nicht geschrieben werden.',
  VerificationFailed: 'Verifikation der temporären Datei fehlgeschlagen.',
  ReplaceFailed: 'Datei konnte nicht ersetzt werden.',
  RollbackFailed: 'Rollback fehlgeschlagen.',
};

const toInitialForm = (song: Song): FormState => ({
  title: song.title ?? '',
  artist: song.artist ?? '',
  album: song.album ?? '',
  year: song.year ?? '',
  genre: song.genre ?? '',
  trackNumber: song.trackNumber ?? '',
  discNumber: song.discNumber ?? '',
  comment: song.comment ?? '',
});

export const buildDraftFromDirtyFields = (
  songId: string,
  form: FormState,
  dirty: Partial<Record<keyof EditableTrackTags, boolean>>,
  removeCover: boolean,
): TagEditDraft => {
  const tags: EditableTrackTags = {};
  for (const field of FIELDS) {
    if (!dirty[field.key]) continue;
    tags[field.key] = form[field.key];
  }
  return { songId, tags, ...(removeCover ? { removeCover: true } : {}) };
};

const capabilityReason = (reason?: string): string => reason ?? 'Schreiben ist für diesen Track nicht verfügbar.';

const blockingReasonMessage = (reasons: TagWriterErrorCode[]): string | undefined => {
  if (reasons.includes('MissingWritePermission')) return 'content://: SAF-Schreiben noch nicht unterstützt.';
  if (reasons.includes('WriteNotImplemented')) return 'iOS/Web file://: sicherer Replace nicht unterstützt.';
  if (reasons.includes('UnsupportedFormat')) return 'Format nicht unterstützt.';
  if (reasons.includes('UnsupportedUri')) return 'URI ist nicht schreibbar (remote/unknown).';
  return undefined;
};


const buildFormAfterSave = (
  song: Song,
  currentForm: FormState,
  draft: TagEditDraft,
): FormState => {
  const normalizedTags = normalizeEditableTags(draft.tags);
  const next = toInitialForm(song);
  for (const field of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(draft.tags, field.key)) {
      next[field.key] = normalizedTags[field.key] ?? '';
    } else {
      next[field.key] = currentForm[field.key];
    }
  }
  return next;
};

const statusMessage = (result: WriteTagsResult): string => {
  if (result.status === 'written') return 'Metadaten erfolgreich geschrieben.';
  if (result.status === 'noop') return 'Keine Änderung.';
  if (result.status === 'rolledBack') return 'Änderung wurde zurückgerollt.';
  return 'Schreiben blockiert.';
};

const TagEditor: React.FC = () => {
  const route = useRoute<TagEditorRoute>();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { songs, updateSongMetadata } = useLibraryMusicContext();
  const song = useMemo(() => songs.find((s) => s.id === route.params.songId), [songs, route.params.songId]);
  const [saving, setSaving] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => (song ? toInitialForm(song) : toInitialForm({ id: '', title: '', artist: '' } as Song)));
  const [dirty, setDirty] = useState<Partial<Record<keyof EditableTrackTags, boolean>>>({});

  useEffect(() => {
    if (!song) return;
    setForm(toInitialForm(song));
    setDirty({});
    setRemoveCover(false);
    setStatus(null);
  }, [song?.id]);

  if (!song) {
    return (
      <AppBackground>
        <Screen contentStyle={styles.container}><Text style={styles.error}>Song nicht gefunden.</Text></Screen>
      </AppBackground>
    );
  }

  const draft = buildDraftFromDirtyFields(song.id, form, dirty, removeCover);
  const capability = getTagEditCapability(song);
  const plan = createTagWriteOperationPlan(song, draft);
  const hasChanges = Object.keys(draft.tags).length > 0 || draft.removeCover === true;
  const canSave = capability.canWrite && hasChanges && plan.blockingReasons.length === 0 && !saving;
  const blockedReasonMessage = blockingReasonMessage(plan.blockingReasons as TagWriterErrorCode[]);

  const onSaveConfirmed = async (): Promise<void> => {
    setSaving(true);
    try {
      const result = await writeTagsToFile(song, draft);
      if (result.status === 'written') {
        const normalizedTags = normalizeEditableTags(draft.tags);
        const metadataPatch: Partial<Song> = {};
        for (const field of FIELDS) {
          if (!Object.prototype.hasOwnProperty.call(draft.tags, field.key)) continue;
          const value = normalizedTags[field.key];
          if (field.key === 'title' || field.key === 'artist' || field.key === 'album' || field.key === 'year' || field.key === 'genre' || field.key === 'trackNumber' || field.key === 'discNumber' || field.key === 'comment') {
            metadataPatch[field.key] = value;
          }
        }
        if (draft.removeCover) {
          metadataPatch.cover = undefined;
          metadataPatch.coverInfo = undefined as SongCoverInfo | undefined;
        }
        updateSongMetadata(song.id, metadataPatch);
        const updatedSong: Song = { ...song, ...metadataPatch };
        setForm(buildFormAfterSave(updatedSong, form, draft));
        setDirty({});
        setRemoveCover(false);
      } else if (result.status === 'noop') {
        setForm((current) => buildFormAfterSave(song, current, draft));
        setDirty({});
        setRemoveCover(false);
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
          {!capability.canWrite && <Text style={styles.warning}>{capabilityReason(capability.reason)}</Text>}
          {!!blockedReasonMessage && <Text style={styles.warning}>{blockedReasonMessage}</Text>}

          {FIELDS.map((field) => (
            <View key={field.key} style={styles.fieldWrap}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                testID={`input-${field.key}`}
                value={form[field.key]}
                editable={capability.canWrite && !saving}
                onChangeText={(value) => {
                  setForm((prev) => ({ ...prev, [field.key]: value }));
                  setDirty((prev) => ({ ...prev, [field.key]: true }));
                }}
                style={[styles.input, !capability.canWrite && styles.inputReadOnly]}
              />
            </View>
          ))}

          <Pressable testID="remove-cover" style={styles.toggle} disabled={!capability.canWrite || saving} onPress={() => setRemoveCover((v) => !v)}>
            <Text style={styles.toggleText}>Cover entfernen: {removeCover ? 'Ja' : 'Nein'}</Text>
          </Pressable>

          <Pressable
            testID="save-button"
            style={[styles.saveButton, !canSave && styles.disabledButton]}
            disabled={!canSave}
            onPress={() => Alert.alert('Bestätigung', 'Metadaten wirklich in Datei schreiben?', [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Speichern', onPress: () => { void onSaveConfirmed(); } },
            ])}
          >
            <Text style={styles.saveText}>{saving ? 'Speichern…' : 'Speichern'}</Text>
          </Pressable>

          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.saveText}>Zurück</Text></Pressable>
          {status && <Text style={styles.status}>{status}</Text>}
        </ScrollView>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing.md, gap: 10 },
  header: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 22 },
  fieldWrap: { gap: 4 },
  label: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body },
  input: { borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10, color: theme.palette.text.primary, fontFamily: theme.fonts.body },
  inputReadOnly: { opacity: 0.8 },
  toggle: { padding: 10, borderRadius: 10, backgroundColor: theme.palette.surfaceElevated },
  toggleText: { color: theme.palette.text.primary },
  saveButton: { padding: 12, borderRadius: 10, backgroundColor: theme.palette.primary },
  backButton: { padding: 12, borderRadius: 10, backgroundColor: theme.palette.surfaceElevated },
  disabledButton: { opacity: 0.5 },
  saveText: { color: theme.palette.text.primary, textAlign: 'center', fontFamily: theme.fonts.heading },
  warning: { color: theme.palette.error },
  status: { color: theme.palette.text.secondary },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading },
});

export default TagEditor;
