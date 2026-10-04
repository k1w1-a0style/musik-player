import React, { createContext, useContext, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

const PagesContext = createContext<ReactNode>(null);
const Pages = () => <>{useContext(PagesContext)}</>;
const stablePages = <Pages />;

interface CoverPagerTrackProps {
  children: ReactNode;
  style: StyleProp<ViewStyle>;
  width: number;
  pageOffset: number;
  translateX: Animated.AnimatedAddition<number>;
  testID: string;
}

/** Update the loaded pages without detaching Paper's native transform node. */
const CoverPagerTrack = ({ children, style, width, pageOffset, translateX, testID }: CoverPagerTrackProps) => (
  <PagesContext.Provider value={children}>
    <Animated.View style={[style, { width, left: pageOffset, transform: [{ translateX }] }]} testID={testID}>
      {stablePages}
    </Animated.View>
  </PagesContext.Provider>
);

export default CoverPagerTrack;
