import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

const Covers = () => {
  const [covers, setCovers] = useState([]);

  useEffect(() => {
    // Load covers from storage
    setCovers([
      { id: 1, image: require('../assets/cover1.jpg') },
      { id: 2, image: require('../assets/cover2.jpg') },
      { id: 3, image: require('../assets/cover3.jpg') },
    ]);
  }, []);

  const handleSelectCover = (cover) => {
    // Select cover
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Covers</Text>
      <FlatList
        data={covers}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleSelectCover(item)}>
            <Image source={item.image} style={styles.cover} />
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    padding: 16,
  },
  cover: {
    width: 100,
    height: 100,
    borderRadius: 10,
    margin: 10,
  },
});

export default Covers;