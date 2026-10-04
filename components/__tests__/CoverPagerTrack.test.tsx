import React from 'react';
import { Animated, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import CoverPagerTrack from '../CoverPagerTrack';

test('reorders visible artwork content without replacing the native animated child identity', () => {
  const translateX = Animated.add(new Animated.Value(-360), -360);
  const props = { translateX, pageOffset: 0, width: 1080, style: { flexDirection: 'row' as const }, testID: 'pager' };
  const view = render(<CoverPagerTrack {...props}><Text>Outgoing</Text></CoverPagerTrack>);
  const animatedChild = view.UNSAFE_getByType(Animated.View).props.children;
  view.rerender(<CoverPagerTrack {...props} pageOffset={360}><Text>Incoming</Text></CoverPagerTrack>);
  expect(view.getByText('Incoming')).toBeTruthy();
  expect(view.queryByText('Outgoing')).toBeNull();
  // Paper's AnimatedProps memo includes children by reference. A new element
  // here detaches the old native props node and restores its transform.
  expect(view.UNSAFE_getByType(Animated.View).props.children).toBe(animatedChild);
});
