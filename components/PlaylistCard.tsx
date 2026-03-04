import React from 'react';
import { View, Text } from 'react-native';

const PlaylistCard: React.FC<{ playlist: any }> = ({ playlist }) => {
  return (
    <View>
      <Text>{playlist.name}</Text>
    </View>
  );
};

export default PlaylistCard;
