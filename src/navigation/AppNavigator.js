// navigation/AppNavigator.js
import React, { useEffect, useMemo, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar, Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';

// Context imports
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Navigation stacks
import AuthStack from './AuthStack';
import ChatStack from './ChatStack';

// Components
import LoadingSpinner from '../components/common/LoadingSpinner';

const Stack = createStackNavigator();

// Focused Status Bar component for better control
const FocusedStatusBar = React.memo(({ backgroundColor, barStyle, ...props }) => {
  return (
    <StatusBar
      backgroundColor={backgroundColor}
      barStyle={barStyle}
      translucent={false}
      animated={true}
      {...props}
    />
  );
});

FocusedStatusBar.displayName = 'FocusedStatusBar';

export default function AppNavigator() {
  const { isAuthenticated, loading, user, isOnline } = useAuth();
  const { theme, isDark, isLoaded: themeLoaded } = useTheme();
  const deviceColorScheme = useColorScheme();

  // Update status bar when theme changes
  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
      StatusBar.setBackgroundColor(theme.statusBar || theme.primary, true);
    }
  }, [isDark, theme]);

  // Handle app state changes for better UX
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        // App became active - refresh status bar
        if (Platform.OS === 'android') {
          StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
          StatusBar.setBackgroundColor(theme.statusBar || theme.primary, true);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isDark, theme]);

  // Memoized navigation theme for better performance
  const navigationTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.accent || theme.primary,
    },
    fonts: {
      regular: {
        fontFamily: Platform.select({
          ios: 'System',
          android: 'Roboto',
          web: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          default: 'System',
        }),
        fontWeight: '400',
      },
      medium: {
        fontFamily: Platform.select({
          ios: 'System',
          android: 'Roboto',
          web: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          default: 'System',
        }),
        fontWeight: '500',
      },
      bold: {
        fontFamily: Platform.select({
          ios: 'System',
          android: 'Roboto',
          web: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          default: 'System',
        }),
        fontWeight: '700',
      },
    },
  }), [isDark, theme]);

  // Memoized stack screen options
  const stackScreenOptions = useMemo(() => ({
    headerShown: false,
    cardStyle: { 
      backgroundColor: theme.background,
    },
    animationTypeForReplace: isAuthenticated ? 'push' : 'pop',
    gestureEnabled: Platform.OS === 'ios',
  }), [theme.background, isAuthenticated]);

  // Loading component with proper theming
  const LoadingComponent = useCallback(() => (
    <>
      <FocusedStatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.statusBar || theme.primary}
      />
      <LoadingSpinner 
        message={
          !themeLoaded ? "Loading theme..." :
          !isOnline ? "Connecting..." :
          "Initializing SecureLink..."
        } 
      />
    </>
  ), [isDark, theme, themeLoaded, isOnline]);

  // Show loading screen while auth or theme is loading
  if (loading || !themeLoaded) {
    return <LoadingComponent />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={navigationTheme}
        fallback={<LoadingComponent />}
        onReady={() => {
          console.log('📱 Navigation ready');
        }}
        onStateChange={(state) => {
          // Optional: Log navigation state changes for debugging
          if (__DEV__) {
            console.log('📱 Navigation state changed:', state?.routes?.[0]?.name);
          }
        }}
      >
        {/* Global Status Bar */}
        <FocusedStatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.statusBar || theme.primary}
        />

        {/* Main Navigation Stack */}
        <Stack.Navigator
          screenOptions={stackScreenOptions}
          initialRouteName={isAuthenticated && user ? 'ChatStack' : 'AuthStack'}
        >
          {isAuthenticated && user ? (
            <Stack.Group
              screenOptions={{
                animationTypeForReplace: 'push',
              }}
            >
              <Stack.Screen
                name="ChatStack"
                component={ChatStack}
                options={{
                  title: 'SecureLink',
                }}
              />
            </Stack.Group>
          ) : (
            <Stack.Group
              screenOptions={{
                animationTypeForReplace: 'pop',
              }}
            >
              <Stack.Screen
                name="AuthStack"
                component={AuthStack}
                options={{
                  title: 'Welcome',
                }}
              />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Enhanced error boundary for navigation errors
export const NavigationErrorBoundary = ({ children }) => {
  return (
    <React.Suspense 
      fallback={
        <LoadingSpinner message="Loading navigation..." />
      }
    >
      {children}
    </React.Suspense>
  );
};
