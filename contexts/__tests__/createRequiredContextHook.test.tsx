import React, { createContext } from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { createRequiredContextHook } from '../createRequiredContextHook';

const TestContext = createContext<{ label: string } | null>(null);
const useTestContext = createRequiredContextHook(TestContext, 'useTestContext', 'TestProvider');

const Consumer = () => {
  const value = useTestContext();
  return <Text>{value.label}</Text>;
};

describe('createRequiredContextHook', () => {
  test('returns context value when provider is present', () => {
    const { getByText } = render(
      <TestContext.Provider value={{ label: 'ok' }}>
        <Consumer />
      </TestContext.Provider>,
    );

    expect(getByText('ok')).toBeTruthy();
  });

  test('throws a descriptive error when provider is missing', () => {
    expect(() => render(<Consumer />)).toThrow('useTestContext must be used within a TestProvider');
  });
});
