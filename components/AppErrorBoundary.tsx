import React, { type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as AppThemeContext from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import { getAppTheme, type AppTheme } from '../utils/appTheme';

type AppErrorBoundaryVariant = 'full' | 'compact';

interface AppErrorBoundaryProps {
  children: ReactNode;
  fallbackContainerStyle?: StyleProp<ViewStyle>;
  fallbackMessage?: string;
  logPrefix?: string;
  testID?: string;
  variant?: AppErrorBoundaryVariant;
}

interface AppErrorBoundaryInnerProps extends AppErrorBoundaryProps {
  appTheme: AppTheme;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

const DEFAULT_FALLBACK_MESSAGE = 'Etwas ist schiefgelaufen.';
const DEFAULT_LOG_PREFIX = 'AppErrorBoundary caught an error';
const DEFAULT_APP_THEME = getAppTheme();
const maybeUseOptionalAppTheme = AppThemeContext.useOptionalAppTheme;

class AppErrorBoundaryInner extends React.Component<AppErrorBoundaryInnerProps, AppErrorBoundaryState> {
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
    const appTheme = this.props.appTheme;

    if (this.state.hasError) {
      return (
        <View
          style={[
            this.props.variant === 'compact'
              ? [
                  styles.compactContainer,
                  {
                    backgroundColor: appTheme.palette.surfaceElevated,
                    borderColor: appTheme.palette.borderStrong,
                  },
                ]
              : [
                  styles.container,
                  {
                    backgroundColor: appTheme.palette.background,
                  },
                ],
            this.props.fallbackContainerStyle,
          ]}
          testID={this.props.testID ?? 'app-error-boundary-fallback'}
        >
          <Text style={[styles.text, { color: appTheme.palette.text.primary }]}>
            {this.props.fallbackMessage ?? DEFAULT_FALLBACK_MESSAGE}
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={[styles.button, { backgroundColor: appTheme.palette.primary }]}
            testID="app-error-boundary-reset"
            accessibilityRole="button"
            accessibilityLabel="Neu versuchen"
          >
            <Text style={[styles.buttonText, { color: appTheme.palette.text.onPrimary }]}>Neu versuchen</Text>
          </Pressable>
        </View>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const AppErrorBoundary: React.FC<AppErrorBoundaryProps> = props => {
  const appThemeValue = typeof maybeUseOptionalAppTheme === 'function' ? maybeUseOptionalAppTheme() : null;

  return <AppErrorBoundaryInner {...props} appTheme={appThemeValue?.theme ?? DEFAULT_APP_THEME} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  compactContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 72,
    zIndex: 50,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  text: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 16,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 14,
  },
});

export default AppErrorBoundary;
