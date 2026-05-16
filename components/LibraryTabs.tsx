import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';
import { LIBRARY_TABS, type LibraryTab } from '../utils/libraryTabs';

interface LibraryTabsProps {
  activeTab: LibraryTab;
  onChangeTab: (tab: LibraryTab) => void;
}

const LibraryTabs: React.FC<LibraryTabsProps> = ({ activeTab, onChangeTab }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.tabsScroller}
    contentContainerStyle={styles.tabsRow}
    testID="library-tabs"
  >
    {LIBRARY_TABS.map(tab => {
      const active = activeTab === tab.key;
      return (
        <Pressable
          key={tab.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`${tab.label} anzeigen`}
          onPress={() => onChangeTab(tab.key)}
          style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
          testID={`library-tab-${tab.key}`}
        >
          <Text style={active ? styles.tabActive : styles.tabMuted}>{tab.label}</Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  tabsScroller: { flexGrow: 0, flexShrink: 0, maxHeight: 48, marginBottom: 8 },
  tabsRow: { alignItems: 'flex-end', gap: 15, paddingHorizontal: 20, paddingRight: 34 },
  tabButton: { paddingVertical: 4 },
  tabMuted: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 14 },
  tabActive: { color: theme.palette.text.primary, fontFamily: theme.fonts.body, fontSize: 23, letterSpacing: -0.8 },
  pressed: { opacity: 0.72 },
});

export default LibraryTabs;
