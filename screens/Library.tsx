import React from 'react';
import LibraryScreenContent from '../components/LibraryScreenContent';
import LibraryScreenFrame from '../components/LibraryScreenFrame';
import { useLibraryController } from '../hooks/libraryHooks';

const Library: React.FC = () => {
  const controller = useLibraryController();

  return (
    <LibraryScreenFrame>
      <LibraryScreenContent {...controller} />
    </LibraryScreenFrame>
  );
};

export default Library;
