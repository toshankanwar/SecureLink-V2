// App.js
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, LogBox, Platform, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Context Providers
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { ContactProvider } from './src/context/ContactContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Services
import NotificationService from './src/services/NotificationService';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Require cycle:',
  'Warning: componentWillReceiveProps',
  'Expo push notifications',
  'AsyncStorage has been extracted',
  'SafeAreaView has been deprecated',
  'Looks like you\'re passing an inline function',
  'VirtualizedLists should never be nested',
]);

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const appState = useRef(AppState.currentState);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize app components
        await initializeApp();
        
        // Setup listeners
        setupAppStateListener();
        setupNotificationListeners();
        
        console.log('✅ App initialized successfully');
      } catch (error) {
        console.error('❌ Error initializing app:', error);
      } finally {
        // Tell the app to render
        setAppIsReady(true);
        setInitializing(false);
        
        // Hide splash screen after a short delay
        setTimeout(() => {
          SplashScreen.hideAsync();
        }, 1000);
      }
    }

    prepare();

    return () => {
      cleanup();
    };
  }, []);

  // Initialize app components
  const initializeApp = async () => {
    try {
      // Configure status bar for Android
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent', true);
      }

      // Initialize storage and check for existing sessions
      await initializeStorage();

      // Initialize notifications
      await initializeNotifications();

      console.log('🚀 App initialization complete');
    } catch (error) {
      console.error('❌ Error in app initialization:', error);
      throw error;
    }
  };

  // Initialize storage and session persistence
  const initializeStorage = async () => {
    try {
      // Check for existing user session
      const userSession = await AsyncStorage.getItem('user_logged_in');
      const lastLogin = await AsyncStorage.getItem('last_login');
      
      if (userSession && lastLogin) {
        const loginTime = new Date(lastLogin);
        const now = new Date();
        const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);
        
        // Session valid for 30 days
        if (daysSinceLogin > 30) {
          // Clear expired session
          await AsyncStorage.multiRemove([
            'user_logged_in',
            'last_login',
            'remembered_email',
            'remember_me'
          ]);
          console.log('🧹 Expired session cleared');
        } else {
          console.log('✅ Valid session found, user will be restored');
        }
      }

      // Initialize app preferences
      const appPreferences = await AsyncStorage.getItem('app_preferences');
      if (!appPreferences) {
        await AsyncStorage.setItem('app_preferences', JSON.stringify({
          theme: 'system',
          notifications: true,
          sound: true,
          vibration: true,
        }));
      }

      console.log('📦 Storage initialization complete');
    } catch (error) {
      console.error('❌ Storage initialization error:', error);
    }
  };

  // Initialize notification service
  const initializeNotifications = async () => {
    try {
      if (!Device.isDevice) {
        console.log('📱 Push notifications only work on physical devices');
        return;
      }

      // Initialize notification service
      await NotificationService.initialize();

      // Handle notification when app is launched from notification
      const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastNotificationResponse) {
        handleNotificationResponse(lastNotificationResponse);
      }

      console.log('🔔 Notifications initialized');
    } catch (error) {
      console.log('⚠️ Notification initialization failed:', error.message);
    }
  };

  // Setup app state listener
  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appState.current;
      
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground');
        handleAppForeground();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 App went to background');
        handleAppBackground();
      }
      
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  };

  // Handle app coming to foreground
  const handleAppForeground = async () => {
    try {
      // Update last active timestamp
      await AsyncStorage.setItem('last_active', new Date().toISOString());
      
      // Refresh notifications if needed
      if (Device.isDevice) {
        await NotificationService.refresh();
      }
      
      console.log('🔄 App state refreshed on foreground');
    } catch (error) {
      console.error('❌ Error handling app foreground:', error);
    }
  };

  // Handle app going to background
  const handleAppBackground = async () => {
    try {
      // Save app state
      await AsyncStorage.setItem('last_background', new Date().toISOString());
      
      console.log('💾 App state saved on background');
    } catch (error) {
      console.error('❌ Error handling app background:', error);
    }
  };

  // ✅ Fixed: Setup notification listeners with proper cleanup
  const setupNotificationListeners = () => {
    // Listener for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('🔔 Notification received (foreground):', notification);
        handleForegroundNotification(notification);
      }
    );

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        handleNotificationResponse(response);
      }
    );

    console.log('👂 Notification listeners setup');
  };

  // Handle foreground notifications
  const handleForegroundNotification = (notification) => {
    const { title, body, data } = notification.request.content;
    console.log('📱 Foreground notification:', { title, body, data });
    
    // Store notification for badge count or in-app display
    storeNotification(notification);
  };

  // Handle notification tap
  const handleNotificationResponse = (response) => {
    const { data } = response.notification.request.content;
    console.log('👆 User tapped notification with data:', data);
    
    // Handle navigation based on notification data
    if (data?.type === 'chat_message') {
      console.log('📨 Navigate to chat:', data.contactId);
      // Navigation will be handled by deep linking or navigation service
    } else if (data?.type === 'contact_request') {
      console.log('👥 Navigate to contacts');
    } else if (data?.type === 'app_update') {
      console.log('🔄 Handle app update notification');
    }
  };

  // Store notification for later processing
  const storeNotification = async (notification) => {
    try {
      const existingNotifications = await AsyncStorage.getItem('stored_notifications');
      const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
      
      notifications.unshift({
        id: notification.request.identifier,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 50 notifications
      const trimmedNotifications = notifications.slice(0, 50);
      
      await AsyncStorage.setItem('stored_notifications', JSON.stringify(trimmedNotifications));
    } catch (error) {
      console.error('❌ Error storing notification:', error);
    }
  };

  // ✅ Fixed: Cleanup function with proper subscription removal
  const cleanup = () => {
    console.log('🧹 Starting app cleanup...');

    // Remove notification listeners using the correct method
    if (notificationListener.current) {
      notificationListener.current.remove(); // ✅ Fixed: Use .remove() instead of removeNotificationSubscription
      notificationListener.current = null;
    }
    
    if (responseListener.current) {
      responseListener.current.remove(); // ✅ Fixed: Use .remove() instead of removeNotificationSubscription  
      responseListener.current = null;
    }

    // Cleanup notification service
    try {
      NotificationService.cleanup();
    } catch (error) {
      console.error('❌ Error cleaning up notification service:', error);
    }

    console.log('✅ App cleanup completed');
  };

  // Handle app crashes or errors
  const handleAppError = (error, errorInfo) => {
    console.error('💥 App Error:', error, errorInfo);
    
    // Log error to AsyncStorage for debugging
    AsyncStorage.setItem('last_app_error', JSON.stringify({
      error: error.toString(),
      errorInfo,
      timestamp: new Date().toISOString(),
    })).catch(e => console.error('Failed to log error:', e));
  };

  // Show loading screen while app is initializing
  if (!appIsReady || initializing) {
    return null; // Splash screen will be shown
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ContactProvider>
              <StatusBar
                barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
                backgroundColor="transparent"
                translucent={Platform.OS === 'android'}
              />
              <AppNavigator />
            </ContactProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
