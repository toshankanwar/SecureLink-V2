// navigation/AuthStack.js
import React, { useCallback, useMemo } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, Platform, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screen imports
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Context and constants
import { useTheme } from '../context/ThemeContext';
import { ROUTES } from '../utils/constants';

const Stack = createStackNavigator();

// ✅ Fixed: Create proper component instead of inline function
function EmailVerificationScreen() {
  const { theme } = useTheme();
  
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: theme.background,
      padding: 24 
    }}>
      <MaterialIcons 
        name="mark-email-read" 
        size={80} 
        color={theme.primary} 
        style={{ marginBottom: 20 }}
      />
      <Text style={{ 
        color: theme.text, 
        fontSize: 28, 
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16
      }}>
        Verify Your Email
      </Text>
      <Text style={{ 
        color: theme.textSecondary, 
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20
      }}>
        We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
      </Text>
      <View style={{
        marginTop: 32,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: theme.primary + '10',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: theme.primary
      }}>
        <Text style={{
          color: theme.textSecondary,
          fontSize: 14,
          textAlign: 'center'
        }}>
          💡 Tip: Check your spam folder if you don't see the email
        </Text>
      </View>
    </View>
  );
}

export default function AuthStack() {
  const { theme, toggleTheme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Memoized theme toggle button for better performance
  const ThemeToggleButton = useCallback(() => (
    <TouchableOpacity
      onPress={toggleTheme}
      style={{
        marginRight: 16,
        padding: 8,
        borderRadius: 20,
      }}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      accessibilityHint="Toggles between light and dark app themes"
      testID="theme-toggle-button"
    >
      <MaterialIcons
        name={isDark ? 'light-mode' : 'dark-mode'}
        size={24}
        color={theme.textOnPrimary}
      />
    </TouchableOpacity>
  ), [toggleTheme, isDark, theme.textOnPrimary]);

  // Memoized header options for better performance
  const defaultHeaderOptions = useMemo(() => ({
    headerStyle: {
      backgroundColor: theme.primary,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      borderBottomWidth: 0,
    },
    headerTintColor: theme.textOnPrimary,
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 18,
      letterSpacing: 0.5,
    },
    headerBackTitleVisible: false,
    gestureEnabled: Platform.OS === 'ios',
    cardStyleInterpolator: Platform.OS === 'android' 
      ? ({ current, layouts }) => ({
          cardStyle: {
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [layouts.screen.width, 0],
                }),
              },
            ],
          },
        })
      : undefined,
  }), [theme]);

  // Memoized screen options
  const stackScreenOptions = useMemo(() => ({
    ...defaultHeaderOptions,
    cardStyle: { 
      backgroundColor: theme.background,
    },
    headerRight: ThemeToggleButton,
  }), [defaultHeaderOptions, theme.background, ThemeToggleButton]);

  return (
    <Stack.Navigator
      initialRouteName={ROUTES.LOGIN}
      screenOptions={stackScreenOptions}
    >
      {/* Login Screen */}
      <Stack.Screen
        name={ROUTES.LOGIN}
        component={LoginScreen}
        options={{
          title: 'Welcome Back',
          headerLeft: () => null, // Remove back button on login screen
          headerRight: ThemeToggleButton,
          gestureEnabled: false, // Disable swipe back on login
        }}
      />

      {/* Register Screen */}
      <Stack.Screen
        name={ROUTES.REGISTER}
        component={RegisterScreen}
        options={{
          title: 'Create Account',
          headerRight: ThemeToggleButton,
          headerBackTitle: 'Back',
        }}
      />

      {/* Forgot Password Screen */}
      <Stack.Screen
        name={ROUTES.FORGOT_PASSWORD}
        component={ForgotPasswordScreen}
        options={{
          title: 'Reset Password',
          headerRight: ThemeToggleButton,
          headerBackTitle: 'Back',
        }}
      />

      {/* ✅ Fixed: Use proper component instead of inline function */}
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{
          title: 'Verify Email',
          headerRight: ThemeToggleButton,
          gestureEnabled: false,
          headerLeft: () => null,
        }}
      />
    </Stack.Navigator>
  );
}

// Export for testing or nested use
export { AuthStack };
