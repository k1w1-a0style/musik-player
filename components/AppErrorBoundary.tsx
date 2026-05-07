import React, { type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface AppErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

export default class AppErrorBoundary extends React.Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    resetKey: 0,
  };

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary caught an error', error, info);
  }

  private handleReset = (): void => {
    this.setState(prev => ({ hasError: false, resetKey: prev.resetKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="app-error-boundary-fallback">
          <Text style={styles.text}>Etwas ist schiefgelaufen.</Text>
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
