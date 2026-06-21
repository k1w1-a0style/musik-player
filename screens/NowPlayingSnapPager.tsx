import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { theme } from '../theme';

export type NowPlayingPageId = 'player' | 'details';

const PAGE_ORDER: readonly NowPlayingPageId[] = ['player', 'details'] as const;

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

const NowPlayingSnapPager: React.FC<NowPlayingSnapPagerProps> = ({
  pageHeight,
  renderPlayerPage,
  renderDetailsPage,
  initialPage = 'player',
  onPageChange,
  testID = 'now-playing-snap-pager',
}) => {
  const listRef = useRef<FlatList<SnapPage>>(null);
  const [activePage, setActivePage] = useState<NowPlayingPageId>(initialPage);

  const pages = useMemo<SnapPage[]>(() => ([
    { id: 'player', render: renderPlayerPage },
    { id: 'details', render: renderDetailsPage },
  ]), [renderPlayerPage, renderDetailsPage]);

  const getItemLayout = useCallback((_: ArrayLike<SnapPage> | null | undefined, index: number) => ({
    length: pageHeight,
    offset: pageHeight * index,
    index,
  }), [pageHeight]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / Math.max(1, pageHeight));
    const nextPage = PAGE_ORDER[index] ?? 'player';
    if (nextPage !== activePage) {
      setActivePage(nextPage);
      onPageChange?.(nextPage);
    }
  }, [activePage, onPageChange, pageHeight]);

  const goToPage = useCallback((target: NowPlayingPageId) => {
    const index = PAGE_ORDER.indexOf(target);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const renderItem = useCallback<ListRenderItem<SnapPage>>(({ item }) => (
    <View style={{ height: pageHeight, width: '100%' }} testID={`now-playing-page-${item.id}`}>
      {item.render()}
    </View>
  ), [pageHeight]);

  return (
    <View style={styles.root} testID={testID}>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={page => page.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        snapToInterval={pageHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleMomentumScrollEnd}
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
              id === activePage && styles.dotActive,
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
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 6,
    height: 18,
    borderRadius: 3,
    backgroundColor: theme.palette.text.primary,
  },
  dotPressed: { opacity: 0.55 },
});

export default NowPlayingSnapPager;
