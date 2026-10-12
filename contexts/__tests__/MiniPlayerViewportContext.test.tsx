import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { MiniPlayerViewportProvider, useMiniPlayerViewport } from '../MiniPlayerViewportContext';

const Probe = () => {
  const { bottomInset, reportHeight } = useMiniPlayerViewport();
  return <><Text testID="inset">{bottomInset}</Text>
    <Pressable testID="measure" onPress={() => reportHeight(78)} />
    <Pressable testID="hide" onPress={() => reportHeight(0)} /></>;
};

test('reserves the measured overlay plus safe area and a 20 dp scroll gap', () => {
  const view = render(<MiniPlayerViewportProvider safeAreaBottom={24}><Probe /></MiniPlayerViewportProvider>);
  expect(view.getByTestId('inset').props.children).toBe(20);
  fireEvent.press(view.getByTestId('measure'));
  expect(view.getByTestId('inset').props.children).toBe(78 + 24 + 12 + 20);
  view.rerender(<MiniPlayerViewportProvider safeAreaBottom={0}><Probe /></MiniPlayerViewportProvider>);
  expect(view.getByTestId('inset').props.children).toBe(78 + 12 + 20);
  fireEvent.press(view.getByTestId('hide'));
  expect(view.getByTestId('inset').props.children).toBe(20);
});
