import React from 'react';
import { StyleSheet } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import LibrarySearchBar from '../components/LibrarySearchBar';
import LibraryTopBar from '../components/LibraryTopBar';
import LibraryTabs from '../components/LibraryTabs';
import LibraryImportStatus from '../components/LibraryImportStatus';
import LibraryMenuModal from '../components/LibraryMenuModal';
import LibraryTabContent from '../components/LibraryTabContent';
import { useLibraryController } from '../hooks/libraryHooks';

const Library: React.FC = () => {
  const {
    activeTab,
    importStatus,
    loading,
    menuModalProps,
    query,
    searchOpen,
    setActiveTab,
    setQuery,
    tabContentProps,
    topBarProps,
  } = useLibraryController();

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <LibraryTopBar {...topBarProps} />

        <LibraryTabs activeTab={activeTab} onChangeTab={setActiveTab} />

        {searchOpen && <LibrarySearchBar value={query} onChangeText={setQuery} autoFocus />}
        {loading && <LibraryImportStatus status={importStatus} />}

        <LibraryTabContent {...tabContentProps} />

        <LibraryMenuModal {...menuModalProps} />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 8 },
});

export default Library;
