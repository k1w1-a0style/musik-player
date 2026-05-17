import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import LibraryImportStatus from './LibraryImportStatus';
import LibraryMenuModal, { type LibraryMenuModalProps } from './LibraryMenuModal';
import LibrarySearchBar from './LibrarySearchBar';
import LibraryTabContent, { type LibraryTabContentProps } from './LibraryTabContent';
import LibraryTabs from './LibraryTabs';
import LibraryTopBar from './LibraryTopBar';
import type { LibraryTab } from '../utils/libraryTabs';

export interface LibraryScreenContentProps {
  activeTab: LibraryTab;
  importStatus: string | null;
  loading: boolean;
  menuModalProps: LibraryMenuModalProps;
  query: string;
  searchOpen: boolean;
  setActiveTab: Dispatch<SetStateAction<LibraryTab>>;
  setQuery: Dispatch<SetStateAction<string>>;
  tabContentProps: LibraryTabContentProps;
  topBarProps: React.ComponentProps<typeof LibraryTopBar>;
}

const LibraryScreenContent: React.FC<LibraryScreenContentProps> = ({
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
}) => (
  <>
    <LibraryTopBar {...topBarProps} />

    <LibraryTabs activeTab={activeTab} onChangeTab={setActiveTab} />

    {searchOpen && <LibrarySearchBar value={query} onChangeText={setQuery} autoFocus />}
    {loading && <LibraryImportStatus status={importStatus} />}

    <LibraryTabContent {...tabContentProps} />

    <LibraryMenuModal {...menuModalProps} />
  </>
);

export default LibraryScreenContent;
