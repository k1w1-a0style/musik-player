import { useContext, type Context } from 'react';

export const createRequiredContextHook = <T>(
  context: Context<T | null>,
  hookName: string,
  providerName: string,
): (() => T) => {
  return () => {
    const value = useContext(context);
    if (!value) {
      throw new Error(`${hookName} must be used within a ${providerName}`);
    }
    return value;
  };
};
