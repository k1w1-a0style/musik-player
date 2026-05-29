import React from 'react';
import CoversContent from './CoversContent';
import { useCoversScreenState } from './useCoversScreenState';

const Covers: React.FC = () => {
  const { albums, playSong } = useCoversScreenState();

  return <CoversContent albums={albums} onPressAlbum={playSong} />;
};

export default Covers;
