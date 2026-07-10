import React from 'react';
import LibraryImportStatus, { type LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryMenuModal, { type LibraryMenuModalProps } from './LibraryMenuModal';
import SongActionMenuModal from './SongActionMenuModal';
import SongPlaylistPickerModal from './SongPlaylistPickerModal';
import LibrarySearchBar, { type LibrarySearchBarProps } from './LibrarySearchBar';
import LibraryTabContent, { type LibraryTabContentProps } from './LibraryTabContent';
import LibraryTabs, { type LibraryTabsProps } from './LibraryTabs';
import LibraryTopBar, { type LibraryTopBarProps } from './LibraryTopBar';

export interface LibraryScreenVisibilityProps {
  showImportStatus: boolean;
  showSearchBar: boolean;
}

export interface LibraryScreenContentProps extends LibraryScreenVisibilityProps {
  importStatusProps: LibraryImportStatusProps;
  menuModalProps: LibraryMenuModalProps;
  searchBarProps: LibrarySearchBarProps;
  tabContentProps: LibraryTabContentProps;
  tabsProps: LibraryTabsProps;
  topBarProps: LibraryTopBarProps;
  songActionMenuProps: React.ComponentProps<typeof SongActionMenuModal>;
  songPlaylistPickerProps: React.ComponentProps<typeof SongPlaylistPickerModal>;
}

const LibraryScreenContent: React.FC<LibraryScreenContentProps> = ({
  importStatusProps,
  menuModalProps,
  searchBarProps,
  showImportStatus,
  showSearchBar,
  tabContentProps,
  tabsProps,
  topBarProps,
  songActionMenuProps,
  songPlaylistPickerProps,
}) => (
  <>
    <LibraryTopBar {...topBarProps} />

    <LibraryTabs {...tabsProps} />

    {showSearchBar && <LibrarySearchBar {...searchBarProps} />}
    {showImportStatus && <LibraryImportStatus {...importStatusProps} />}

    <LibraryTabContent {...tabContentProps} />

    <LibraryMenuModal {...menuModalProps} />
    <SongActionMenuModal {...songActionMenuProps} />
    <SongPlaylistPickerModal {...songPlaylistPickerProps} />
  </>
);

export default LibraryScreenContent;
