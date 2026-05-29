import React, { type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface AppErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
  logPrefix?: string;
  testID?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

const DEFAULT_FALLBACK_MESSAGE = 'Etwas ist schiefgelaufen.';
const DEFAULT_LOG_PREFIX = 'AppErrorBoundary caught an error';

export default class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    resetKey: 0,
  };

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(this.props.logPrefix ?? DEFAULT_LOG_PREFIX, error, info);
  }

  private handleReset = (): void => {
    this.setState(prev => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID={this.props.testID ?? 'app-error-boundary-fallback'}>
          <Text style={styles.text}>{this.props.fallbackMessage ?? DEFAULT_FALLBACK_MESSAGE}</Text>
          <Pressable onPress={this.handleReset} style={styles.button} testID="app-error-boundary-reset">
            <Text style={styles.buttonText}>Neu versuchen</Text>
          </Pressable>
        </View>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  text: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.body,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: theme.palette.background,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
});
