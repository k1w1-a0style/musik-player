import React from 'react';
import { View } from 'react-native';
import { TagCleanerButton } from './TagCleanerButton';
import { LibrarySelectionProvider, type LibrarySelectionScope } from '../contexts/LibrarySelectionContext';
import LibrarySelectionActions from './LibrarySelectionActions';
import type { LibraryImportStatusProps } from './LibraryImportStatus';
import LibraryPreparationStatus from './LibraryPreparationStatus';
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
  selectionScope?: LibrarySelectionScope;
  importStatusProps: LibraryImportStatusProps;
  menuModalProps: LibraryMenuModalProps;
  searchBarProps: LibrarySearchBarProps;
  tabContentProps: LibraryTabContentProps;
  tabsProps: LibraryTabsProps;
  topBarProps: LibraryTopBarProps;
  songActionMenuProps: React.ComponentProps<typeof SongActionMenuModal>;
  songPlaylistPickerProps: React.ComponentProps<typeof SongPlaylistPickerModal>;
}

const LibraryScreenSections: React.FC<LibraryScreenContentProps> = ({
  selectionScope,
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
    {selectionScope&&<View style={{paddingHorizontal:20}}><TagCleanerButton testID="library-open-cleaner" label="Sammlung aufräumen" onPress={()=>selectionScope.onOpenCleaner([])} disabled={menuModalProps.loading||!menuModalProps.isReady}/></View>}

    <LibraryTabs {...tabsProps} />
    <LibrarySelectionActions />

    {showSearchBar && <LibrarySearchBar {...searchBarProps} />}
    <LibraryPreparationStatus visible={showImportStatus} {...importStatusProps} />

    <LibraryTabContent {...tabContentProps} />

    <LibraryMenuModal {...menuModalProps} onOpenCleaner={selectionScope?()=>{menuModalProps.onClose();selectionScope.onOpenCleaner([]);}:undefined} />
    <SongActionMenuModal {...songActionMenuProps} />
    <SongPlaylistPickerModal {...songPlaylistPickerProps} />
  </>
);

const LibraryScreenContent: React.FC<LibraryScreenContentProps> = props => props.selectionScope
  ? <LibrarySelectionProvider {...props.selectionScope}><LibraryScreenSections {...props} /></LibrarySelectionProvider>
  : <LibraryScreenSections {...props} />;
export default LibraryScreenContent;
