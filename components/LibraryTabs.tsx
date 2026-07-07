import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme as staticTheme } from '../theme';
import { useAppTheme } from '../contexts/AppThemeContext';
import { LIBRARY_TABS, type LibraryTab } from '../utils/libraryTabs';

export interface LibraryTabsProps {
  activeTab: LibraryTab;
  onChangeTab: (tab: LibraryTab) => void;
}

const LibraryTabs: React.FC<LibraryTabsProps> = ({ activeTab, onChangeTab }) => {
  const { theme } = useAppTheme();

  return (
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
            <Text style={[styles.tabLabel, { color: active ? theme.palette.text.primary : theme.palette.text.secondary }]}>
              {tab.label}
            </Text>
            <View
              style={[styles.indicator, { backgroundColor: active ? theme.palette.primary : 'rgba(0,0,0,0)' }]}
              testID={`library-tab-indicator-${tab.key}`}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabsScroller: { flexGrow: 0, flexShrink: 0, maxHeight: 48, marginBottom: 8 },
  tabsRow: { alignItems: 'flex-end', gap: 15, paddingHorizontal: 20, paddingRight: 34 },
  tabButton: { paddingVertical: 4, alignItems: 'center' },
  tabLabel: { fontFamily: staticTheme.fonts.body, fontSize: 16, letterSpacing: -0.3 },
  indicator: { marginTop: 4, height: 2, width: 18, borderRadius: 1 },
  pressed: { opacity: 0.72 },
});

export default LibraryTabs;
