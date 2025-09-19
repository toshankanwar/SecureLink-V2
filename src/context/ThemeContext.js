// context/ThemeContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { Appearance, StatusBar, Platform } from 'react-native';
import { useColorScheme } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import Constants from 'expo-constants';
import { getTheme } from '../styles/colors';
import { THEME_TYPES } from '../utils/constants';
import StorageService from '../services/storage';

const ThemeContext = createContext();

const initialState = {
  isDark: Appearance.getColorScheme() === 'dark',
  theme: getTheme(Appearance.getColorScheme() === 'dark'),
  themeMode: 'system', // 'light', 'dark', 'system'
  systemTheme: Appearance.getColorScheme(),
  isLoaded: false,
};

function themeReducer(state, action) {
  switch (action.type) {
    case 'SET_THEME_MODE':
      const { mode, systemTheme } = action.payload;
      const shouldBeDark = mode === 'dark' || (mode === 'system' && systemTheme === 'dark');
      
      return {
        ...state,
        themeMode: mode,
        isDark: shouldBeDark,
        theme: getTheme(shouldBeDark),
        systemTheme: systemTheme || state.systemTheme,
      };
    
    case 'UPDATE_SYSTEM_THEME':
      const newSystemTheme = action.payload;
      const shouldUpdateTheme = state.themeMode === 'system';
      
      return {
        ...state,
        systemTheme: newSystemTheme,
        isDark: shouldUpdateTheme ? newSystemTheme === 'dark' : state.isDark,
        theme: shouldUpdateTheme ? getTheme(newSystemTheme === 'dark') : state.theme,
      };
    
    case 'TOGGLE_THEME':
      const newMode = state.themeMode === 'light' ? 'dark' : 'light';
      const newIsDark = newMode === 'dark';
      
      return {
        ...state,
        themeMode: newMode,
        isDark: newIsDark,
        theme: getTheme(newIsDark),
      };
    
    case 'SET_LOADED':
      return {
        ...state,
        isLoaded: true,
      };
    
    default:
      return state;
  }
}

export function ThemeProvider({ children }) {
  const [state, dispatch] = useReducer(themeReducer, initialState);
  const systemColorScheme = useColorScheme();
  const subscriptionRef = useRef(null);
  const isInitialized = useRef(false);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    if (systemColorScheme && isInitialized.current) {
      dispatch({
        type: 'UPDATE_SYSTEM_THEME',
        payload: systemColorScheme,
      });
    }
  }, [systemColorScheme]);

  // Update status bar and navigation bar when theme changes
  useEffect(() => {
    if (state.isLoaded) {
      updateSystemBars();
    }
  }, [state.isDark, state.isLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await StorageService.getTheme();
      const currentSystemTheme = Appearance.getColorScheme() || 'light';
      
      if (savedTheme && Object.values(THEME_TYPES).includes(savedTheme)) {
        dispatch({
          type: 'SET_THEME_MODE',
          payload: {
            mode: savedTheme,
            systemTheme: currentSystemTheme,
          },
        });
      } else {
        // Default to system theme if no preference saved
        dispatch({
          type: 'SET_THEME_MODE',
          payload: {
            mode: 'system',
            systemTheme: currentSystemTheme,
          },
        });
      }
      
      dispatch({ type: 'SET_LOADED' });
      isInitialized.current = true;
      
      console.log('🎨 Theme preference loaded:', savedTheme || 'system');
    } catch (error) {
      console.error('Error loading theme preference:', error);
      dispatch({ type: 'SET_LOADED' });
      isInitialized.current = true;
    }
  };

  const updateSystemBars = async () => {
    try {
      // Update StatusBar
      StatusBar.setBarStyle(
        state.isDark ? 'light-content' : 'dark-content',
        true
      );

      // Update Android Navigation Bar (Expo)
      if (Platform.OS === 'android') {
        try {
          await NavigationBar.setBackgroundColorAsync(
            state.isDark ? state.theme.surface : state.theme.background
          );
          await NavigationBar.setButtonStyleAsync(
            state.isDark ? 'light' : 'dark'
          );
        } catch (navError) {
          // NavigationBar API might not be available on all devices
          console.log('Navigation bar update not supported:', navError.message);
        }
      }
    } catch (error) {
      console.error('Error updating system bars:', error);
    }
  };

  const setThemeMode = async (mode) => {
    try {
      if (!Object.values(THEME_TYPES).includes(mode) && mode !== 'system') {
        throw new Error(`Invalid theme mode: ${mode}`);
      }

      const currentSystemTheme = Appearance.getColorScheme() || 'light';
      
      // Save to storage
      await StorageService.storeTheme(mode);
      
      // Update state
      dispatch({
        type: 'SET_THEME_MODE',
        payload: {
          mode,
          systemTheme: currentSystemTheme,
        },
      });

      console.log('🎨 Theme mode changed to:', mode);
    } catch (error) {
      console.error('Error setting theme mode:', error);
      throw error;
    }
  };

  const toggleTheme = async () => {
    try {
      const newMode = state.themeMode === THEME_TYPES.LIGHT ? THEME_TYPES.DARK : THEME_TYPES.LIGHT;
      await setThemeMode(newMode);
    } catch (error) {
      console.error('Error toggling theme:', error);
    }
  };

  const setLightTheme = () => setThemeMode(THEME_TYPES.LIGHT);
  const setDarkTheme = () => setThemeMode(THEME_TYPES.DARK);
  const setSystemTheme = () => setThemeMode('system');

  // Get theme stats for debugging
  const getThemeInfo = () => {
    return {
      currentMode: state.themeMode,
      isDark: state.isDark,
      systemTheme: state.systemTheme,
      isLoaded: state.isLoaded,
      appVersion: Constants.expoVersion,
      platform: Platform.OS,
    };
  };

  // Reset theme to default
  const resetTheme = async () => {
    try {
      await StorageService.removeItem('app_theme'); // Clear stored theme
      await setThemeMode('system');
      console.log('🎨 Theme reset to system default');
    } catch (error) {
      console.error('Error resetting theme:', error);
    }
  };

  const contextValue = {
    // State
    isDark: state.isDark,
    theme: state.theme,
    themeMode: state.themeMode,
    systemTheme: state.systemTheme,
    isLoaded: state.isLoaded,
    
    // Actions
    toggleTheme,
    setThemeMode,
    setLightTheme,
    setDarkTheme,
    setSystemTheme,
    resetTheme,
    
    // Utilities
    getThemeInfo,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
