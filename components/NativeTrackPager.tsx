import React, { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import type { Song } from '../types/Song';
import { useNativeTrackPager } from '../hooks/useNativeTrackPager';

interface NativeTrackPagerProps {
  songs: Song[];
  currentSongId?: string;
  width: number;
  onSelectSong: (song: Song) => void | Promise<void>;
  renderPage: (song: Song, index: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
  testID: string;
  waitFor?: React.RefObject<unknown | null>;
  wrapToStart?: boolean;
  reduceMotion?: boolean;
}

/** Native scrolling owns the offset. Track acknowledgements never rebase cover views. */
const NativeTrackPager = ({ songs, currentSongId, width, onSelectSong, renderPage, style,
  testID, waitFor, wrapToStart = false, reduceMotion = false }: NativeTrackPagerProps) => {
  const pages = useMemo(() => wrapToStart && songs.length > 1 ? [...songs, songs[0]] : songs,
    [songs, wrapToStart]);
  const currentIndex = Math.max(0, songs.findIndex(song => song.id === currentSongId));
  const initialIndex = useRef(currentIndex).current;
  const motion = useNativeTrackPager({ pages, currentSongId, currentIndex, width, onSelectSong },
    songs.length, reduceMotion);
  const layout = useCallback((_: ArrayLike<Song> | null | undefined, index: number) =>
    ({ length: width, offset: width * index, index }), [width]);
  const renderItem = useCallback(({ item, index }: { item: Song; index: number }) => (
    <View style={[styles.page, { width }]} testID={`${testID}-page-${item.id}-${index}`}
      accessibilityElementsHidden={index !== currentIndex}
      importantForAccessibility={index === currentIndex ? 'auto' : 'no-hide-descendants'}>
      {renderPage(item, index)}
    </View>
  ), [currentIndex, renderPage, testID, width]);

  return <FlatList ref={motion.listRef} testID={testID} data={pages} renderItem={renderItem}
    keyExtractor={(song, index) => `${song.id}:${index}`} getItemLayout={layout}
    initialScrollIndex={initialIndex} horizontal pagingEnabled snapToInterval={width}
    decelerationRate="fast" disableIntervalMomentum bounces={false} overScrollMode="never"
    showsHorizontalScrollIndicator={false} removeClippedSubviews={false}
    initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5}
    waitFor={waitFor as React.RefObject<never> | undefined}
    onScrollBeginDrag={motion.beginDrag} onScrollEndDrag={motion.endDrag}
    onMomentumScrollEnd={motion.finishScroll} style={style} />;
};

const styles = StyleSheet.create({ page: { height: '100%' } });
export default React.memo(NativeTrackPager);
