import React from 'react';
import { View, Text, Button } from 'react-native';
export function PlayerScreen() {
  return (
    <View>
      <Text>Player Screen</Text>
      <Button title='Play' onPress={() => console.log('Play')} />
    </View>
  );
}