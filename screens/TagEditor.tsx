import React, { useMemo, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { AppStackParamList } from '../types/navigation';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';
import type { EditableTrackTags, TagEditDraft, TagWriterErrorCode } from '../types/TagEdit';
import { getTagEditCapability } from '../utils/tagEditCapability';
import { createTagWriteOperationPlan } from '../utils/tagWriteOrchestrator';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';

type TagEditorRoute = RouteProp<AppStackParamList, 'TagEditor'>;

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

const errorMessages: Record<TagWriterErrorCode, string> = {
  MissingWritePermission: 'Fehlende Schreibberechtigung für diese Datei.',
  UnsupportedUri: 'Diese URI kann nicht geschrieben werden.',
  UnsupportedFormat: 'Dieses Audioformat wird nicht unterstützt.',
  WriteNotImplemented: 'Sicheres Schreiben ist auf diesem Ziel noch nicht verfügbar.',
  InvalidTagData: 'Ungültige Metadaten. Bitte Eingaben prüfen.',
  BackupFailed: 'Backup konnte nicht erstellt werden.',
  TempWriteFailed: 'Temporäre Datei konnte nicht geschrieben werden.',
  VerificationFailed: 'Geschriebene Datei konnte nicht verifiziert werden.',
  ReplaceFailed: 'Datei konnte nicht ersetzt werden.',
  RollbackFailed: 'Rollback ist fehlgeschlagen.',
};

const TagEditor: React.FC = () => {
  const route = useRoute<TagEditorRoute>();
  const navigation = useNavigation();
  const { songs } = useLibraryMusicContext();
  const song = useMemo(() => songs.find((s) => s.id === route.params.songId), [songs, route.params.songId]);
  const initial = useMemo(() => ({
    title: song?.title ?? '', artist: song?.artist ?? '', album: song?.album ?? '', year: song?.year ?? '', genre: song?.genre ?? '',
    trackNumber: '', discNumber: '', comment: '',
  }), [song]);
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState<Partial<Record<keyof EditableTrackTags, boolean>>>({});
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!song) return <Text>Song nicht gefunden.</Text>;

  const capability = getTagEditCapability(song);
  const draft: TagEditDraft = { songId: song.id, tags: {} };
  for (const field of FIELDS) {
    if (!dirty[field.key]) continue;
    draft.tags[field.key] = form[field.key];
  }
  if (removeCover) draft.removeCover = true;
  const hasChanges = Object.keys(draft.tags).length > 0 || draft.removeCover;
  const plan = createTagWriteOperationPlan(song, draft);
  const canSave = capability.canWrite && hasChanges && !saving && plan.blockingReasons.length === 0;

  const onSave = () => {
    Alert.alert('Bestätigen', 'Metadaten wirklich in Datei schreiben?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Speichern',
        onPress: async () => {
          setSaving(true);
          try {
            const result = await writeTagsToFile(song, draft);
            setStatus(result.status === 'written' ? 'Änderungen gespeichert.' : result.status === 'noop' ? 'Keine Änderung.' : 'Änderung wurde zurückgerollt.');
          } catch (error) {
            if (error instanceof TagWriterError) {
              setStatus(errorMessages[error.code] ?? 'Speichern fehlgeschlagen.');
            } else setStatus('Speichern fehlgeschlagen.');
          } finally {
            setSaving(false);
          }
        }
      }
    ]);
  };

  return (
    <AppBackground><Screen contentStyle={styles.container}><ScrollView>
      <Text style={styles.header}>Tag Editor</Text>
      {!capability.canWrite && <Text style={styles.warn}>{capability.reason}</Text>}
      {FIELDS.map((field) => (
        <View key={field.key}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput value={form[field.key] ?? ''} editable={capability.canWrite && !saving} onChangeText={(value) => { setForm((p) => ({ ...p, [field.key]: value })); setDirty((p) => ({ ...p, [field.key]: true })); }} style={styles.input} />
        </View>
      ))}
      <Button title={removeCover ? 'Cover entfernen: Ja' : 'Cover entfernen: Nein'} disabled={!capability.canWrite || saving} onPress={() => setRemoveCover((v) => !v)} />
      <Button title={saving ? 'Speichern…' : 'Speichern'} disabled={!canSave} onPress={onSave} />
      <Button title="Zurück" onPress={() => navigation.goBack()} />
      {!!status && <Text>{status}</Text>}
    </ScrollView></Screen></AppBackground>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, padding: theme.spacing.md }, header: { color: theme.palette.text.primary }, label: { color: theme.palette.text.secondary, marginTop: 8 }, input: { borderWidth: 1, borderColor: theme.palette.surfaceElevated, color: theme.palette.text.primary, padding: 8, borderRadius: 8 }, warn: { color: theme.palette.error } });

export default TagEditor;
