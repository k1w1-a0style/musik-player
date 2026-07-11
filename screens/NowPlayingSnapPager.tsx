import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getNowPlayingSnapPagerInactiveDotColor } from '../utils/appThemeOverlays';

export type NowPlayingPageId = 'player' | 'details';

const PAGE_ORDER: readonly NowPlayingPageId[] = ['player', 'details'] as const;
const SNAP_THRESHOLD = 0.28;

interface NowPlayingSnapPagerProps {
  pageHeight: number;
  renderPlayerPage: () => React.ReactNode;
  renderDetailsPage: () => React.ReactNode;
  initialPage?: NowPlayingPageId;
  onPageChange?: (page: NowPlayingPageId) => void;
  testID?: string;
}

interface SnapPage {
  id: NowPlayingPageId;
  render: () => React.ReactNode;
}

const clampPageIndex = (index: number): number => Math.max(0, Math.min(PAGE_ORDER.length - 1, index));

const resolveSnapIndex = ({
  offsetY,
  pageHeight,
  currentIndex,
}: {
  offsetY: number;
  pageHeight: number;
  currentIndex: number;
}): number => {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return clampPageIndex(currentIndex);
  const safeCurrentIndex = clampPageIndex(currentIndex);
  const currentOffset = safeCurrentIndex * pageHeight;
  const deltaRatio = (offsetY - currentOffset) / pageHeight;
  if (deltaRatio > SNAP_THRESHOLD) return clampPageIndex(safeCurrentIndex + 1);
  if (deltaRatio < -SNAP_THRESHOLD) return clampPageIndex(safeCurrentIndex - 1);
  return safeCurrentIndex;
};

const NowPlayingSnapPager: React.FC<NowPlayingSnapPagerProps> = ({
  pageHeight,
  renderPlayerPage,
  renderDetailsPage,
  initialPage = 'player',
  onPageChange,
  testID = 'now-playing-snap-pager',
}) => {
  const { theme } = useAppTheme();
  const inactiveDotColor = getNowPlayingSnapPagerInactiveDotColor(theme.appearance);
  const listRef = useRef<FlatList<SnapPage>>(null);
  const lastResnappedPosition = useRef<{ page: NowPlayingPageId; pageHeight: number } | null>(null);
  const [activePage, setActivePage] = useState<NowPlayingPageId>(initialPage);
  const effectivePageHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 0;

  const pages = useMemo<SnapPage[]>(() => ([
    { id: 'player', render: renderPlayerPage },
    { id: 'details', render: renderDetailsPage },
  ]), [renderPlayerPage, renderDetailsPage]);

  const snapOffsets = useMemo(() => PAGE_ORDER.map((_, index) => index * effectivePageHeight), [effectivePageHeight]);

  const getItemLayout = useCallback((_: ArrayLike<SnapPage> | null | undefined, index: number) => ({
    length: effectivePageHeight,
    offset: effectivePageHeight * index,
    index,
  }), [effectivePageHeight]);

  const commitPageIndex = useCallback((index: number, animated = true) => {
    const targetIndex = clampPageIndex(index);
    const nextPage = PAGE_ORDER[targetIndex] ?? 'player';
    if (effectivePageHeight > 0) {
      listRef.current?.scrollToOffset({ offset: targetIndex * effectivePageHeight, animated });
    }
    if (nextPage !== activePage) {
      setActivePage(nextPage);
      onPageChange?.(nextPage);
    }
  }, [activePage, effectivePageHeight, onPageChange]);

  const settleFromOffset = useCallback((offsetY: number, animated = true) => {
    const currentIndex = PAGE_ORDER.indexOf(activePage);
    commitPageIndex(resolveSnapIndex({
      offsetY,
      pageHeight: effectivePageHeight,
      currentIndex,
    }), animated);
  }, [activePage, commitPageIndex, effectivePageHeight]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    settleFromOffset(event.nativeEvent.contentOffset.y, true);
  }, [settleFromOffset]);

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (effectivePageHeight <= 0) return;
    settleFromOffset(event.nativeEvent.contentOffset.y, true);
  }, [effectivePageHeight, settleFromOffset]);

  const goToPage = useCallback((target: NowPlayingPageId) => {
    const index = PAGE_ORDER.indexOf(target);
    if (index < 0 || effectivePageHeight <= 0) return;
    commitPageIndex(index, true);
  }, [commitPageIndex, effectivePageHeight]);

  const renderItem = useCallback<ListRenderItem<SnapPage>>(({ item }) => (
    <View style={{ height: effectivePageHeight, width: '100%' }} testID={`now-playing-page-${item.id}`}>
      {item.render()}
    </View>
  ), [effectivePageHeight]);

  useEffect(() => {
    if (effectivePageHeight <= 0) return;
    if (
      lastResnappedPosition.current?.page === activePage
      && lastResnappedPosition.current.pageHeight === effectivePageHeight
    ) {
      return;
    }

    const activeIndex = PAGE_ORDER.indexOf(activePage);
    if (activeIndex < 0) return;
    lastResnappedPosition.current = { page: activePage, pageHeight: effectivePageHeight };
    listRef.current?.scrollToOffset({ offset: activeIndex * effectivePageHeight, animated: false });
  }, [activePage, effectivePageHeight]);

  return (
    <View style={styles.root} testID={testID}>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={page => page.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        overScrollMode="never"
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        initialScrollIndex={PAGE_ORDER.indexOf(initialPage)}
      />
      <View pointerEvents="box-none" style={styles.indicatorWrap} testID="now-playing-snap-indicator">
        {PAGE_ORDER.map(id => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={id === 'player' ? 'Wiedergabe anzeigen' : 'Warteschlange anzeigen'}
            onPress={() => goToPage(id)}
            style={({ pressed }) => [
              styles.dot,
              { backgroundColor: inactiveDotColor },
              id === activePage && [styles.dotActive, { backgroundColor: theme.palette.text.primary }],
              pressed && styles.dotPressed,
            ]}
            testID={`now-playing-snap-indicator-${id}`}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  indicatorWrap: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,

  },
  dotActive: {
    width: 6,
    height: 18,
    borderRadius: 3,

  },
  dotPressed: { opacity: 0.55 },
});

export default NowPlayingSnapPager;
