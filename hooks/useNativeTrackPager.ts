import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { Alert, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';
import type { Song } from '../types/Song';

interface PagerSnapshot {
  pages: Song[];
  currentSongId?: string;
  currentIndex: number;
  width: number;
  onSelectSong: (song: Song) => void | Promise<void>;
}
interface PagerRefs {
  latest: MutableRefObject<PagerSnapshot>;
  visibleIndex: MutableRefObject<number>;
  visibleId: MutableRefObject<string | undefined>;
  dragging: MutableRefObject<boolean>;
  pendingId: MutableRefObject<string | null>;
  generation: MutableRefObject<number>;
  timer: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}
type ShowIndex = (index: number, animated: boolean) => void;

const usePagerSelection = (refs: PagerRefs, showIndex: ShowIndex, reduceMotion: boolean,
  clearTimer: () => void) => {
  const { latest, visibleIndex, visibleId, dragging, pendingId, generation, timer } = refs;
  const restorePlaybackPage = useCallback((request: number) => {
    if (generation.current !== request) return;
    pendingId.current = null;
    clearTimer();
    showIndex(latest.current.currentIndex, !reduceMotion);
    Alert.alert('Trackwechsel nicht möglich', 'Der Titel konnte nicht gestartet werden. Bitte erneut versuchen.');
  }, [clearTimer, generation, latest, pendingId, reduceMotion, showIndex]);
  const selectOffset = useCallback((offset: number) => {
    const state = latest.current;
    const index = Math.max(0, Math.min(state.pages.length - 1, Math.round(offset / state.width)));
    const song = state.pages[index];
    if (!song) return;
    dragging.current = false;
    visibleIndex.current = index;
    visibleId.current = song.id;
    if (song.id === pendingId.current) {
      if (song.id === state.currentSongId) { pendingId.current = null; generation.current += 1; clearTimer(); }
      return;
    }
    if (song.id === state.currentSongId && pendingId.current === null) return;
    const request = ++generation.current;
    clearTimer();
    pendingId.current = song.id;
    // Keep the selected cover throughout queue/metadata work. Only a confirmed
    // failure or missing acknowledgement may return to the audible track.
    timer.current = setTimeout(() => restorePlaybackPage(request), 10_000);
    try { void Promise.resolve(state.onSelectSong(song)).catch(() => restorePlaybackPage(request)); }
    catch { restorePlaybackPage(request); }
  }, [clearTimer, dragging, generation, latest, pendingId, restorePlaybackPage, timer, visibleId, visibleIndex]);
  const finishScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (dragging.current) selectOffset(event.nativeEvent.contentOffset.x);
  }, [dragging, selectOffset]);
  const endDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    const width = latest.current.width;
    // A drag released exactly on a page may end without a momentum event.
    if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.01 && Math.abs(offset / width - Math.round(offset / width)) < 0.002) selectOffset(offset);
  }, [latest, selectOffset]);
  return { finishScroll, endDrag };
};

export const useNativeTrackPager = (state: PagerSnapshot, songCount: number, reduceMotion: boolean) => {
  const listRef = useRef<FlatList<Song>>(null);
  const latest = useRef(state);
  latest.current = state;
  const visibleIndex = useRef(state.currentIndex);
  const visibleId = useRef(state.currentSongId);
  const dragging = useRef(false);
  const lastWidth = useRef(state.width);
  const pendingId = useRef<string | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => () => { generation.current += 1; clearTimer(); }, [clearTimer]);
  const showIndex = useCallback<ShowIndex>((index, animated) => {
    visibleIndex.current = index;
    visibleId.current = latest.current.pages[index]?.id;
    listRef.current?.scrollToOffset({ offset: index * latest.current.width, animated });
  }, []);
  const { pages, currentSongId, currentIndex, width } = state;
  const pageOrder = pages.map(song => song.id).join('\u0000');
  useEffect(() => {
    if (dragging.current) return;
    if (pendingId.current) {
      if (pendingId.current !== currentSongId) return;
      pendingId.current = null;
      generation.current += 1;
      clearTimer();
    }
    if (lastWidth.current !== width) { lastWidth.current = width; showIndex(currentIndex, false); }
    else if (visibleId.current !== currentSongId) showIndex(currentIndex, !reduceMotion);
    else if (visibleIndex.current >= songCount || pages[visibleIndex.current]?.id !== currentSongId)
      showIndex(currentIndex, false);
  }, [clearTimer, currentIndex, currentSongId, pageOrder, pages, reduceMotion, showIndex, songCount, width]);
  const selection = usePagerSelection({ latest, visibleIndex, visibleId, dragging, pendingId, generation, timer },
    showIndex, reduceMotion, clearTimer);
  return { listRef, ...selection, beginDrag: () => { dragging.current = true; } };
};
