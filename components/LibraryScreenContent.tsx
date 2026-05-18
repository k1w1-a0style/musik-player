import React from 'react';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryMenuModal, { type LibraryMenuModalProps } from './LibraryMenuModal';
import LibrarySearchBar, { type LibrarySearchBarProps } from './LibrarySearchBar';
import LibraryTabContent, { type LibraryTabContentProps } from './LibraryTabContent';
import LibraryTabs, { type LibraryTabsProps } from './LibraryTabs';
import LibraryTopBar, { type LibraryTopBarProps } from './LibraryTopBar';

export interface LibraryScreenContentProps {
  importStatusProps: LibraryImportStatusProps;
  menuModalProps: LibraryMenuModalProps;
  searchBarProps: LibrarySearchBarProps;
  showImportStatus: boolean;
  showSearchBar: boolean;
  tabContentProps: LibraryTabContentProps;
  tabsProps: LibraryTabsProps;
  topBarProps: LibraryTopBarProps;
}

export type LibraryScreenVisibilityProps = Pick<LibraryScreenContentProps, 'showImportStatus' | 'showSearchBar'>;

const LibraryScreenContent: React.FC<LibraryScreenContentProps> = ({
  importStatusProps,
  menuModalProps,
  searchBarProps,
  showImportStatus,
  showSearchBar,
  tabContentProps,
  tabsProps,
  topBarProps,
}) => (
  <>
    <LibraryTopBar {...topBarProps} />

    <LibraryTabs {...tabsProps} />

    {showSearchBar && <LibrarySearchBar {...searchBarProps} />}
    {showImportStatus && <LibraryImportStatus {...importStatusProps} />}

    <LibraryTabContent {...tabContentProps} />

    <LibraryMenuModal {...menuModalProps} />
  </>
);

export default LibraryScreenContent;
