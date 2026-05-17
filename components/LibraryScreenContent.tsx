import React from 'react';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryMenuModal, { type LibraryMenuModalProps } from './LibraryMenuModal';
import LibrarySearchBar, { type LibrarySearchBarProps } from './LibrarySearchBar';
import LibraryTabContent, { type LibraryTabContentProps } from './LibraryTabContent';
import LibraryTabs, { type LibraryTabsProps } from './LibraryTabs';
import LibraryTopBar, { type LibraryTopBarProps } from './LibraryTopBar';

export interface LibraryScreenContentProps {
  importStatusProps: LibraryImportStatusProps;
  loading: boolean;
  menuModalProps: LibraryMenuModalProps;
  searchBarProps: LibrarySearchBarProps;
  searchOpen: boolean;
  tabContentProps: LibraryTabContentProps;
  tabsProps: LibraryTabsProps;
  topBarProps: LibraryTopBarProps;
}

const LibraryScreenContent: React.FC<LibraryScreenContentProps> = ({
  importStatusProps,
  loading,
  menuModalProps,
  searchBarProps,
  searchOpen,
  tabContentProps,
  tabsProps,
  topBarProps,
}) => (
  <>
    <LibraryTopBar {...topBarProps} />

    <LibraryTabs {...tabsProps} />

    {searchOpen && <LibrarySearchBar {...searchBarProps} />}
    {loading && <LibraryImportStatus {...importStatusProps} />}

    <LibraryTabContent {...tabContentProps} />

    <LibraryMenuModal {...menuModalProps} />
  </>
);

export default LibraryScreenContent;
