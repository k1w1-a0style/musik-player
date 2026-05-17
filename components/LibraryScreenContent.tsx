import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import LibraryImportStatus from './LibraryImportStatus';
import LibraryMenuModal, { type LibraryMenuModalProps } from './LibraryMenuModal';
import LibrarySearchBar from './LibrarySearchBar';
import LibraryTabContent, { type LibraryTabContentProps } from './LibraryTabContent';
import LibraryTabs, { type LibraryTabsProps } from './LibraryTabs';
import LibraryTopBar, { type LibraryTopBarProps } from './LibraryTopBar';

export interface LibraryScreenContentProps {
  importStatus: string | null;
  loading: boolean;
  menuModalProps: LibraryMenuModalProps;
  query: string;
  searchOpen: boolean;
  setQuery: Dispatch<SetStateAction<string>>;
  tabContentProps: LibraryTabContentProps;
  tabsProps: LibraryTabsProps;
  topBarProps: LibraryTopBarProps;
}

const LibraryScreenContent: React.FC<LibraryScreenContentProps> = ({
  importStatus,
  loading,
  menuModalProps,
  query,
  searchOpen,
  setQuery,
  tabContentProps,
  tabsProps,
  topBarProps,
}) => (
  <>
    <LibraryTopBar {...topBarProps} />

    <LibraryTabs {...tabsProps} />

    {searchOpen && <LibrarySearchBar value={query} onChangeText={setQuery} autoFocus />}
    {loading && <LibraryImportStatus status={importStatus} />}

    <LibraryTabContent {...tabContentProps} />

    <LibraryMenuModal {...menuModalProps} />
  </>
);

export default LibraryScreenContent;
