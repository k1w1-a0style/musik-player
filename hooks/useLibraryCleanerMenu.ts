import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { useLibrarySelection } from '../contexts/LibrarySelectionContext';
import { getCleanerUnresolvedSongIds, resolveCleanerFolderSelection, uniqueCleanerSongs } from '../utils/tagCleanerSelection';

const confirmCleaner = (label: string, songs: readonly Song[], open: () => void, warning?: string) => {
  const count = uniqueCleanerSongs(songs).length;
  Alert.alert(label, `${count} enthaltene Titel, jede Datei einmal.${warning ? `\n${warning}` : ''}`, [
    { text: 'Abbrechen', style: 'cancel' },
    ...(count ? [{ text: 'Tags bereinigen', onPress: open }] : []),
  ]);
};
export const useLibraryCleanerMenu = () => {
  const selection = useLibrarySelection();
  const openSongsMenu = useCallback((label: string, songs: readonly Song[]) => {
    if (!selection) return;
    confirmCleaner(label, songs, () => selection.openSongs(songs));
  }, [selection]);
  const openFolderMenu = useCallback((folder: ScanFolder) => {
    if (!selection) return;
    const allSongs = selection.getSongs();
    const result = resolveCleanerFolderSelection(allSongs, [folder], true);
    const ids = new Set(result.songIds); const songs = allSongs.filter(song => ids.has(song.id));
    const warning = result.unresolvedFolderIds.length || getCleanerUnresolvedSongIds(allSongs).length
      ? 'Ordnerzugehörigkeit einiger Quellen ist nicht nachweisbar. Bitte diese Titel über die Bibliothek auswählen.' : undefined;
    confirmCleaner(`${folder.name || 'Musikordner'} einschließlich Unterordner`, songs, () => selection.openSongs(songs), warning);
  }, [selection]);
  return selection ? { openSongsMenu, openFolderMenu } : null;
};
