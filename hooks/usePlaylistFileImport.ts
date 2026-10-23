import { useEffect, useRef, useState } from 'react';
import type { Playlist, Song } from '../types/Song';
import { pickPlaylistFile, verifyPlaylistSources, type PlaylistImportPreview } from '../utils/playlistFiles';
import { songPlaylistUri } from '../utils/m3uPlaylist';
import { isAbortError, throwIfAborted, withTimeout } from '../utils/withTimeout';

const sameSource = (song: Song, current: Song | undefined): boolean =>
  Boolean(current && songPlaylistUri(current) === songPlaylistUri(song));

export const usePlaylistFileImport = (songs: Song[], save: ((name: string, queue: Song[]) => Playlist | null) | undefined) => {
  const [preview, setPreview] = useState<PlaylistImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const currentSongs = useRef(songs);
  currentSongs.current = songs;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current?.abort(); };
  }, []);

  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError('');
    try { await work(controller.signal); }
    catch (failure) {
      if (!isAbortError(failure) && !controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Die Playlist konnte nicht importiert werden.');
      }
    } finally {
      operation.current = null;
      if (mounted.current) { setBusy(false); setProgress(''); }
    }
  };

  const pick = () => run(async signal => {
    setProgress('Playlist auswählen …');
    const selected = await pickPlaylistFile(currentSongs.current, signal);
    throwIfAborted(signal);
    if (selected) setPreview(selected);
  });

  const confirm = () => run(async signal => {
    if (!preview || !save) return;
    setProgress('Lokale Titel prüfen …');
    const ids = new Map(currentSongs.current.map(song => [song.id, song]));
    const candidates = preview.songs.filter(song => sameSource(song, ids.get(song.id)));
    if (candidates.length !== preview.songs.length) {
      throw new Error('Die Bibliothek hat sich geändert. Bitte wähle die Playlist erneut aus.');
    }
    const checked = await withTimeout(checkSignal => verifyPlaylistSources(candidates, checkSignal, (done, total) => {
      if (!checkSignal.aborted && (done % 25 === 0 || done === total)) setProgress(`${done} / ${total} Titel geprüft`);
    }), 120_000, 'Die Prüfung dauert zu lange. Bitte versuche es mit weniger Titeln.', { signal });
    throwIfAborted(signal);
    const current = new Map(currentSongs.current.map(song => [song.id, song]));
    if (candidates.some(song => !sameSource(song, current.get(song.id)))) throw new Error('Die Bibliothek hat sich geändert. Bitte erneut auswählen.');
    if (checked.unreadable.length) {
      setPreview({ ...preview, songs: checked.readable, unresolved: [...preview.unresolved,
        ...checked.unreadable.map(song => ({ location: song.uri ?? song.id, label: song.title, line: 0, reason: 'unreadable' as const }))] });
      setError('Einige Titel sind nicht mehr lesbar. Prüfe die aktualisierte Vorschau und bestätige erneut.');
      return;
    }
    if (!save(preview.name, checked.readable)) throw new Error('Keine lesbaren Titel zum Importieren vorhanden.');
    setPreview(null);
  });

  const cancel = () => {
    operation.current?.abort();
    setBusy(false);
    setProgress('');
    setPreview(null);
    setError('');
  };
  return { preview, busy, progress, error, pick, confirm, cancel };
};
