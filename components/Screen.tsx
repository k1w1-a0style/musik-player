import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Edge = 'top' | 'bottom';

interface ScreenProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  testID?: string;
}

const getNumericPadding = (...values: unknown[]): number => {
  for (const value of values) {
    if (typeof value === 'number') return value;
  }
  return 0;
};

const Screen: React.FC<ScreenProps> = ({ children, style, contentStyle, edges = ['top', 'bottom'], testID }) => {
  const insets = useSafeAreaInsets();
  const flattenedContentStyle = StyleSheet.flatten(contentStyle) ?? {};

  const insetPaddingTop = edges.includes('top') ? insets.top : 0;
  const insetPaddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const customPaddingTop = getNumericPadding(
    flattenedContentStyle.paddingTop,
    flattenedContentStyle.paddingVertical,
    flattenedContentStyle.padding,
  );
  const customPaddingBottom = getNumericPadding(
    flattenedContentStyle.paddingBottom,
    flattenedContentStyle.paddingVertical,
    flattenedContentStyle.padding,
  );

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View
        style={[
          styles.content,
          contentStyle,
          {
            paddingTop: insetPaddingTop + customPaddingTop,
            paddingBottom: insetPaddingBottom + customPaddingBottom,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1 },
});

export default Screen;
