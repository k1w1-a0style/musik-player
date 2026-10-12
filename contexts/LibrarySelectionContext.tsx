import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Song } from '../types/Song';
import { createLibrarySelectionStore, librarySelectionKey, librarySelectionRevision, type LibrarySelectionStore } from '../utils/librarySelectionStore';
import { uniqueCleanerSongs } from '../utils/tagCleanerSelection';

export interface LibrarySelectionScope {
  songs: readonly Song[];
  visibleSongs: readonly Song[];
  onOpenCleaner: (songIds: string[]) => void;
}
interface LibrarySelectionContextValue {
  store: LibrarySelectionStore;
  openSongs: (songs: readonly Song[]) => void;
  openSelected: () => void;
  getSongs: () => readonly Song[];
}
const LibrarySelectionContext = createContext<LibrarySelectionContextValue | null>(null);
const subscribeNone = () => () => undefined;
const unselected = () => 0 as const;

const currentSelectionIds = (requested: readonly Song[], current: readonly Song[]): string[] => {
  const byId = new Map(current.map(song => [song.id, song]));
  return uniqueCleanerSongs(requested).flatMap(song => {
    const latest = byId.get(song.id);
    return latest && librarySelectionKey(latest) === librarySelectionKey(song)
      && librarySelectionRevision(latest) === librarySelectionRevision(song) ? [latest.id] : [];
  });
};

export const LibrarySelectionProvider: React.FC<React.PropsWithChildren<LibrarySelectionScope>> = ({
  songs, visibleSongs, onOpenCleaner, children,
}) => {
  const [store] = useState(createLibrarySelectionStore);
  const current = useRef({ songs, onOpenCleaner });
  current.current = { songs, onOpenCleaner };
  const [value] = useState<LibrarySelectionContextValue>(() => ({
    store,
    getSongs: () => current.current.songs,
    openSongs: requested => {
      const ids = currentSelectionIds(requested, current.current.songs);
      if (ids.length) current.current.onOpenCleaner(ids);
    },
    openSelected: () => {
      const ids = store.getCurrentIds();
      if (ids.length) current.current.onOpenCleaner(ids);
    },
  }));
  useLayoutEffect(() => { store.reconcile(songs, visibleSongs); }, [songs, store, visibleSongs]);
  return <LibrarySelectionContext.Provider value={value}>{children}</LibrarySelectionContext.Provider>;
};
export const useLibrarySelection = () => useContext(LibrarySelectionContext);

export const useLibrarySongSelection = (song: Song, onPressSong: (song: Song) => void, isCurrent = false) => {
  const selection = useLibrarySelection();
  const getSnapshot = useCallback(() => selection?.store.getRowSnapshot(song) ?? 0, [selection, song]);
  const state = useSyncExternalStore(selection?.store.subscribe ?? subscribeNone, selection ? getSnapshot : unselected);
  const onPress = useCallback(() => {
    if (selection?.store.getSnapshot().active) selection.store.toggle(song);
    else onPressSong(song);
  }, [onPressSong, selection, song]);
  const onLongPress = useCallback(() => { selection?.store.start(song); }, [selection, song]);
  return { state, onPress, onLongPress: selection ? onLongPress : undefined,
    accessibilityRole: state ? 'checkbox' as const : 'button' as const,
    accessibilityState: state ? { checked: state === 2 } : { selected: isCurrent } };
};
