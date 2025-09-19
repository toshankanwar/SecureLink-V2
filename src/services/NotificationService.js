// services/NotificationService.js - UPDATED FOR EXPO PUSH NOTIFICATIONS
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ✅ Enhanced notification configuration
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if app is in foreground
    const appState = AppState.currentState;
    const isBackground = appState !== 'active';
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      // Show banner even in foreground for chat messages
      shouldShowBanner: isBackground || notification.request.content.data?.type === 'chat_message',
    };
  },
});

class NotificationService {
  constructor() {
    this.token = null;
    this.userId = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.backgroundTaskListener = null;
    this.appStateListener = null;
    this.networkListener = null;
    
    // ✅ Enhanced state management
    this.initialized = false;
    this.permissionStatus = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isOnline = true;
    this.pendingTokenUpdate = null;
    this.backendRetryCount = 0;
    this.maxBackendRetries = 5;
    
    // ✅ Storage keys
    this.STORAGE_KEYS = {
      TOKEN: 'expo_push_token',
      USER_ID: 'notification_user_id',
      PERMISSION_STATUS: 'notification_permission_status',
      TOKEN_TIMESTAMP: 'token_timestamp',
      BACKEND_REGISTRATION_STATUS: 'backend_registration_status',
    };

    // ✅ Setup app state and network monitoring
    this.setupAppStateListener();
    this.setupNetworkListener();
  }

  // ✅ Enhanced initialization with comprehensive error handling
  async initialize(userId = null) {
    try {
      console.log('🔔 Initializing Expo NotificationService...');
      
      if (this.initialized && this.userId === userId) {
        console.log('✅ Expo NotificationService already initialized for this user');
        return this.token;
      }

      // ✅ Device validation
      if (!Device.isDevice) {
        console.warn('⚠️ Push notifications require a physical device');
        await this.showDeviceWarning();
        return null;
      }

      this.userId = userId;

      // ✅ Try to restore previous token first
      const cachedToken = await this.restoreTokenFromStorage();
      if (cachedToken && userId) {
        this.token = cachedToken;
        console.log('📱 Restored cached Expo token:', cachedToken.substring(0, 20) + '...');
      }

      // ✅ Check and request permissions with retry
      const hasPermission = await this.ensurePermissions();
      if (!hasPermission) {
        console.warn('❌ Push notification permissions denied');
        return null;
      }

      // ✅ Get fresh push token with retry mechanism
      const token = await this.getPushTokenWithRetry();
      if (!token) {
        console.error('❌ Failed to obtain Expo push token after retries');
        return null;
      }

      // ✅ Register token with backend and Firestore
      if (userId) {
        await this.registerTokenWithServices(userId, token);
      }

      // ✅ Setup notification channel for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidNotificationChannel();
      }

      // ✅ Setup all listeners
      this.setupNotificationListeners();
      this.setupBackgroundTaskListener();

      // ✅ Save successful initialization
      await this.saveTokenToStorage(token, userId);
      this.initialized = true;
      this.retryCount = 0;

      console.log('✅ Expo NotificationService initialized successfully');
      return token;

    } catch (error) {
      console.error('❌ Error initializing Expo NotificationService:', error);
      await this.handleInitializationError(error);
      return null;
    }
  }

  // ✅ Enhanced permission handling with user-friendly prompts
  async ensurePermissions() {
    try {
      // Check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      this.permissionStatus = existingStatus;

      if (existingStatus === 'granted') {
        console.log('✅ Push notification permissions already granted');
        return true;
      }

      if (existingStatus === 'denied') {
        console.warn('⚠️ Push notification permissions previously denied');
        await this.showPermissionDeniedDialog();
        return false;
      }

      // Request permissions with user-friendly explanation
      await this.showPermissionRequestDialog();
      
      const { status: newStatus } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: true,
          allowProvisional: true,
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        }
      });

      this.permissionStatus = newStatus;
      await AsyncStorage.setItem(this.STORAGE_KEYS.PERMISSION_STATUS, newStatus);

      if (newStatus !== 'granted') {
        console.warn(`❌ Push notification permissions not granted: ${newStatus}`);
        await this.showPermissionDeniedDialog();
        return false;
      }

      console.log('✅ Push notification permissions granted');
      return true;

    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  // ✅ Enhanced token retrieval with retry and validation
  async getPushTokenWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Getting Expo push token (attempt ${attempt}/${this.maxRetries})...`);
        
        const token = await this.getPushToken();
        
        if (token && this.validateTokenFormat(token)) {
          console.log('✅ Valid Expo push token obtained');
          return token;
        } else {
          throw new Error('Invalid Expo token format received');
        }

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Expo push token attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('❌ Failed to get Expo push token after all retries:', lastError);
    throw lastError;
  }

  // ✅ Enhanced push token retrieval
  async getPushToken() {
    try {
      // Get project ID from multiple possible sources
      const projectId = this.getProjectId();
      
      if (!projectId) {
        throw new Error('❌ Expo project ID not found. Please configure EAS project ID in app.json');
      }

      console.log('🔧 Using Expo project ID:', projectId);

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
        applicationId: Constants.expoConfig?.slug,
      });

      if (!tokenData?.data) {
        throw new Error('No token data received from Expo');
      }

      const token = tokenData.data;
      console.log('🔔 Expo push token obtained:', token.substring(0, 20) + '...');
      
      this.token = token;
      return token;

    } catch (error) {
      console.error('❌ Error getting Expo push token:', error);
      throw error;
    }
  }

  // ✅ Get project ID from multiple sources
  getProjectId() {
    return (
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      Constants.manifest?.extra?.eas?.projectId ||
      Constants.expoConfig?.projectId ||
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    );
  }

  // ✅ UPDATED: Validate Expo token format
  validateTokenFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // ✅ Expo push tokens should start with 'ExponentPushToken[' and end with ']'
    const expoTokenRegex = /^ExponentPushToken\[[a-zA-Z0-9_-]+\]$/;
    const isValid = expoTokenRegex.test(token);
    
    if (!isValid) {
      console.warn('⚠️ Invalid Expo token format:', token.substring(0, 30) + '...');
    }
    
    return isValid;
  }

  // ✅ Enhanced token registration with both backend and Firestore
  async registerTokenWithServices(userId, token) {
    const results = {
      firestore: false,
      backend: false
    };

    // Register with Firestore (higher priority, more reliable)
    try {
      await this.saveTokenToFirestore(userId, token);
      results.firestore = true;
      console.log('✅ Expo token registered with Firestore');
    } catch (error) {
      console.error('❌ Failed to register Expo token with Firestore:', error);
    }

    // Register with backend (with enhanced error handling)
    try {
      await this.registerTokenWithBackendRetry(userId, token);
      results.backend = true;
      console.log('✅ Expo token registered with backend');
    } catch (error) {
      console.error('❌ Failed to register Expo token with backend:', error);
      // Store for later retry
      this.pendingTokenUpdate = { userId, token };
    }

    // At least one registration should succeed
    if (results.firestore || results.backend) {
      console.log('✅ Expo token registered with at least one service');
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.BACKEND_REGISTRATION_STATUS, 
        JSON.stringify(results)
      );
    } else {
      console.error('❌ Failed to register Expo token with any service');
    }

    return results;
  }

  // ✅ UPDATED: Enhanced Firestore token saving for Expo
  async saveTokenToFirestore(userId, token) {
    try {
      if (!userId || !token) {
        throw new Error('Missing userId or token');
      }

      const userRef = doc(db, 'users', userId);
      
      // Check if user document exists first
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        console.warn('⚠️ User document does not exist, cannot save token');
        return;
      }

      // ✅ UPDATED: Save as both expoPushToken and fcmToken for compatibility
      await updateDoc(userRef, {
        expoPushToken: token,        // ✅ NEW: Primary field for Expo
        fcmToken: token,             // ✅ Keep for backward compatibility
        tokenProvider: 'expo',       // ✅ NEW: Mark as using Expo
        platform: Platform.OS,
        deviceInfo: {
          brand: Device.brand,
          modelName: Device.modelName,
          osName: Device.osName,
          osVersion: Device.osVersion,
          isDevice: Device.isDevice,
        },
        lastTokenUpdate: new Date(),
        tokenVersion: Constants.expoConfig?.version || '1.0.0',
        appBuildVersion: Constants.expoConfig?.runtimeVersion || '1.0.0',
      });

      console.log('✅ Expo push token saved to Firestore');
    } catch (error) {
      console.error('❌ Error saving Expo token to Firestore:', error);
      throw error;
    }
  }

  // ✅ Enhanced backend token registration with comprehensive error handling
  async registerTokenWithBackendRetry(userId, token) {
    for (let attempt = 1; attempt <= this.maxBackendRetries; attempt++) {
      try {
        await this.registerTokenWithBackend(userId, token);
        this.backendRetryCount = 0; // Reset on success
        return;
      } catch (error) {
        this.backendRetryCount = attempt;
        
        if (attempt < this.maxBackendRetries) {
          const delay = Math.min(Math.pow(2, attempt) * 1000, 30000); // Max 30 seconds
          console.warn(`⚠️ Expo backend registration attempt ${attempt} failed: ${error.message}`);
          console.log(`⏳ Retrying Expo backend registration in ${delay}ms...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ Expo backend registration failed after ${this.maxBackendRetries} attempts:`, error);
          throw error;
        }
      }
    }
  }

  // ✅ Get server URL with fallbacks
  getServerUrl() {
    return (
      process.env.EXPO_PUBLIC_SERVER_URL ||
      process.env.REACT_NATIVE_SERVER_URL ||
      Constants.expoConfig?.extra?.serverUrl ||
      Constants.manifest?.extra?.serverUrl ||
      'https://securelink-backend-e65c.onrender.com' // ✅ Your server URL as fallback
    );
  }

  // ✅ UPDATED: Robust backend token registration for Expo
  async registerTokenWithBackend(userId, token) {
    try {
      // ✅ Get server URL properly
      const SERVER_URL = this.getServerUrl();
      
      console.log(`📤 Using server URL for Expo registration: ${SERVER_URL}`);

      // Get Firebase ID token with retry
      let idToken;
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        
        if (!auth.currentUser) {
          throw new Error('No authenticated user found. Please login first.');
        }
        
        // Force refresh token to ensure it's valid
        idToken = await auth.currentUser.getIdToken(true);
        
        if (!idToken) {
          throw new Error('Failed to get Firebase ID token');
        }
      } catch (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }

      console.log(`📤 Registering Expo token with backend: ${SERVER_URL}/api/notifications/register`);

      // Make request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`${SERVER_URL}/api/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'User-Agent': `SecureLink-Mobile/${Constants.expoConfig?.version || '1.0.0'} (${Platform.OS})`,
          'X-App-Version': Constants.expoConfig?.version || '1.0.0',
          'X-Platform': Platform.OS,
          'X-Token-Provider': 'expo', // ✅ NEW: Indicate Expo provider
        },
        body: JSON.stringify({
          fcmToken: token,                    // ✅ Send as fcmToken for backend compatibility
          expoPushToken: token,               // ✅ NEW: Also send as expoPushToken
          tokenProvider: 'expo',              // ✅ NEW: Mark as Expo token
          platform: Platform.OS,
          deviceId: Constants.deviceId || Constants.sessionId || 'unknown',
          appVersion: Constants.expoConfig?.version || '1.0.0',
          buildVersion: Constants.expoConfig?.runtimeVersion || '1.0.0',
          deviceInfo: {
            brand: Device.brand,
            modelName: Device.modelName,
            osVersion: Device.osVersion,
            isDevice: Device.isDevice,
          },
          registrationTime: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          try {
            errorMessage = await response.text() || errorMessage;
          } catch {
            // Use status code if can't parse response
          }
        }
        
        throw new Error(`Server error: ${errorMessage} (Status: ${response.status})`);
      }

      const result = await response.json();
      console.log('✅ Expo token registered with backend server:', result);
      
      // Clear pending update on success
      this.pendingTokenUpdate = null;
      
      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - server did not respond within 15 seconds');
      }
      
      if (error.name === 'NetworkError' || error.message.includes('network')) {
        throw new Error(`Network error: ${error.message}. Please check your internet connection.`);
      }
      
      throw error;
    }
  }

  // ✅ Setup Android notification channel
  async setupAndroidNotificationChannel() {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default notifications',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });

      // Create chat-specific channel
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00FF00',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      console.log('✅ Android notification channels configured for Expo');
    } catch (error) {
      console.error('❌ Error setting up Android notification channels:', error);
    }
  }

  // ✅ Enhanced notification listeners with better error handling
  setupNotificationListeners() {
    try {
      // Clean up existing listeners first
      this.cleanup();

      // Listener for notifications received while app is running
      this.notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log('🔔 Expo notification received (app active):', notification);
          this.handleForegroundNotification(notification);
        }
      );

      // Listener for when user taps on notification
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log('👆 Expo notification tapped:', response);
          this.handleNotificationResponse(response);
        }
      );

      console.log('✅ Expo notification listeners setup complete');
    } catch (error) {
      console.error('❌ Error setting up Expo notification listeners:', error);
    }
  }

  // ✅ Enhanced foreground notification handling
  handleForegroundNotification(notification) {
    try {
      const { title, body, data } = notification.request.content;
      console.log('📱 Expo foreground notification:', { title, body, data });

      // Handle different notification types
      switch (data?.type) {
        case 'chat_message':
          this.handleChatNotification(data, { title, body });
          break;
        case 'system':
          this.handleSystemNotification(data, { title, body });
          break;
        default:
          console.log('📱 General Expo notification received');
      }

      // Show in-app notification if needed
      this.showInAppNotification(title, body, data);

    } catch (error) {
      console.error('❌ Error handling Expo foreground notification:', error);
    }
  }

  // ✅ Enhanced notification response handling with navigation
  handleNotificationResponse(response) {
    try {
      const { data } = response.notification.request.content;
      console.log('👆 User opened Expo notification with data:', data);

      // Handle navigation based on notification type
      switch (data?.type) {
        case 'chat_message':
          this.navigateToChat(data.contactId || data.chatId);
          break;
        case 'friend_request':
          this.navigateToFriendRequests();
          break;
        case 'system':
          this.navigateToSettings();
          break;
        default:
          console.log('👆 General Expo notification opened');
      }

    } catch (error) {
      console.error('❌ Error handling Expo notification response:', error);
    }
  }

  // ✅ Navigation helpers (implement based on your navigation structure)
  navigateToChat(contactId) {
    try {
      console.log('🧭 Navigate to chat:', contactId);
      // Implement navigation to chat screen
      // Example using React Navigation:
      // NavigationService.navigate('Chat', { contactId });
    } catch (error) {
      console.error('❌ Error navigating to chat:', error);
    }
  }

  navigateToFriendRequests() {
    console.log('🧭 Navigate to friend requests');
    // Implement navigation to friend requests screen
  }

  navigateToSettings() {
    console.log('🧭 Navigate to settings');
    // Implement navigation to settings screen
  }

  // ✅ Handle chat-specific notifications
  handleChatNotification(data, content) {
    console.log('💬 Chat notification from:', data.contactId);
    // You can add custom logic here like updating unread count, etc.
  }

  // ✅ Handle system notifications
  handleSystemNotification(data, content) {
    console.log('⚙️ System notification:', data);
  }

  // ✅ Show in-app notification overlay
  showInAppNotification(title, body, data) {
    // Implement custom in-app notification component
    console.log('📲 Show in-app notification:', { title, body });
  }

  // ✅ Setup background task listener
  setupBackgroundTaskListener() {
    try {
      this.backgroundTaskListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          if (AppState.currentState !== 'active') {
            console.log('🔔 Expo background notification received:', notification);
            // Handle background notification processing
          }
        }
      );
    } catch (error) {
      console.error('❌ Error setting up background task listener:', error);
    }
  }

  // ✅ Setup app state listener for token refresh
  setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && this.initialized) {
        // Refresh token when app becomes active
        this.refreshTokenIfNeeded();
        // Retry backend registration if pending
        this.retryPendingBackendRegistration();
      }
    });
  }

  // ✅ Setup network listener for retry logic
  setupNetworkListener() {
    this.networkListener = NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected;
      
      if (!wasOnline && this.isOnline) {
        console.log('🌐 Network restored, retrying pending Expo operations...');
        this.retryPendingBackendRegistration();
      }
    });
  }

  // ✅ Enhanced retry for pending backend registration
  async retryPendingBackendRegistration() {
    if (!this.pendingTokenUpdate || !this.isOnline) return;

    try {
      const { userId, token } = this.pendingTokenUpdate;
      console.log('🔄 Retrying Expo backend token registration...');
      
      await this.registerTokenWithBackendRetry(userId, token);
      console.log('✅ Expo backend token registration retry successful');
      
      this.pendingTokenUpdate = null;
    } catch (error) {
      console.error('❌ Expo backend token registration retry failed:', error);
    }
  }

  // ✅ Refresh token if needed (e.g., after 24 hours)
  async refreshTokenIfNeeded() {
    try {
      const tokenTimestamp = await AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN_TIMESTAMP);
      if (!tokenTimestamp) return;

      const lastUpdate = new Date(tokenTimestamp);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

      if (hoursSinceUpdate > 24) { // Refresh every 24 hours
        console.log('🔄 Refreshing Expo token (24h passed)...');
        await this.initialize(this.userId);
      }
    } catch (error) {
      console.error('❌ Error checking Expo token refresh:', error);
    }
  }

  // ✅ Storage management
  async saveTokenToStorage(token, userId) {
    try {
      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.TOKEN, token),
        AsyncStorage.setItem(this.STORAGE_KEYS.USER_ID, userId || ''),
        AsyncStorage.setItem(this.STORAGE_KEYS.TOKEN_TIMESTAMP, new Date().toISOString()),
      ]);
      console.log('✅ Expo token saved to local storage');
    } catch (error) {
      console.error('❌ Error saving Expo token to storage:', error);
    }
  }

  async restoreTokenFromStorage() {
    try {
      const token = await AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN);
      const userId = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_ID);
      const timestamp = await AsyncStorage.getItem(this.STORAGE_KEYS.TOKEN_TIMESTAMP);

      if (token && this.validateTokenFormat(token)) {
        console.log('📱 Expo token restored from storage');
        return token;
      }
    } catch (error) {
      console.error('❌ Error restoring Expo token from storage:', error);
    }
    return null;
  }

  // ✅ User-friendly dialog methods
  async showDeviceWarning() {
    Alert.alert(
      'Device Required',
      'Push notifications are only available on physical devices. They won\'t work in the simulator.',
      [{ text: 'OK' }]
    );
  }

  async showPermissionRequestDialog() {
    return new Promise((resolve) => {
      Alert.alert(
        'Enable Notifications',
        'SecureLink would like to send you notifications for new messages and important updates. You can change this in Settings later.',
        [
          { text: 'Not Now', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Enable', onPress: () => resolve(true) }
        ]
      );
    });
  }

  async showPermissionDeniedDialog() {
    Alert.alert(
      'Notifications Disabled',
      'To receive message notifications, please enable notifications in your device Settings > SecureLink > Notifications.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Notifications.openSettingsAsync() }
      ]
    );
  }

  // ✅ Error handling
  async handleInitializationError(error) {
    console.error('💥 Expo NotificationService initialization failed:', error);
    
    // Reset state on critical errors
    this.initialized = false;
    this.token = null;
    
    // Show user-friendly error message
    if (error.message.includes('project')) {
      Alert.alert(
        'Configuration Error',
        'Push notifications are not properly configured. Please contact support.',
        [{ text: 'OK' }]
      );
    }
  }

  // ✅ Public methods
  async updateUserId(newUserId) {
    if (this.userId === newUserId) return;
    
    const oldUserId = this.userId;
    this.userId = newUserId;
    
    if (newUserId && this.token) {
      try {
        await this.registerTokenWithServices(newUserId, this.token);
        await AsyncStorage.setItem(this.STORAGE_KEYS.USER_ID, newUserId);
        console.log(`✅ Updated user ID from ${oldUserId} to ${newUserId}`);
      } catch (error) {
        console.error('❌ Error updating user ID:', error);
        this.pendingTokenUpdate = { userId: newUserId, token: this.token };
      }
    }
  }

  async sendLocalNotification(title, body, data = {}, options = {}) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: options.sound !== false,
          badge: options.badge,
          categoryIdentifier: options.category,
          ...options.content,
        },
        trigger: options.trigger || null, // null = immediate
      });

      console.log('✅ Local Expo notification sent:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error sending local Expo notification:', error);
      return null;
    }
  }

  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('✅ Expo notification cancelled:', notificationId);
    } catch (error) {
      console.error('❌ Error cancelling Expo notification:', error);
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ All Expo notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling all Expo notifications:', error);
    }
  }

  // ✅ Getters
  getToken() {
    return this.token;
  }

  getUserId() {
    return this.userId;
  }

  isInitialized() {
    return this.initialized;
  }

  getPermissionStatus() {
    return this.permissionStatus;
  }

  // ✅ Enhanced cleanup with all listeners
  cleanup() {
    try {
      // Remove notification listeners
      if (this.notificationListener) {
        this.notificationListener.remove();
        this.notificationListener = null;
      }

      if (this.responseListener) {
        this.responseListener.remove();
        this.responseListener = null;
      }

      if (this.backgroundTaskListener) {
        this.backgroundTaskListener.remove();
        this.backgroundTaskListener = null;
      }

      // Remove app state listener
      if (this.appStateListener) {
        this.appStateListener.remove();
        this.appStateListener = null;
      }

      // Remove network listener
      if (this.networkListener) {
        this.networkListener();
        this.networkListener = null;
      }

      // Reset state
      this.token = null;
      this.userId = null;
      this.initialized = false;
      this.permissionStatus = null;
      this.pendingTokenUpdate = null;
      this.backendRetryCount = 0;

      console.log('✅ Expo NotificationService cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  // ✅ UPDATED: Service status for debugging with Expo info
  getServiceStatus() {
    return {
      initialized: this.initialized,
      hasToken: !!this.token,
      userId: this.userId,
      permissionStatus: this.permissionStatus,
      isOnline: this.isOnline,
      serverUrl: this.getServerUrl(),
      provider: 'expo', // ✅ NEW: Indicate using Expo
      hasListeners: {
        notification: !!this.notificationListener,
        response: !!this.responseListener,
        background: !!this.backgroundTaskListener,
        appState: !!this.appStateListener,
        network: !!this.networkListener,
      },
      pendingTokenUpdate: !!this.pendingTokenUpdate,
      retryCount: this.retryCount,
      backendRetryCount: this.backendRetryCount,
      projectId: this.getProjectId(),
      tokenFormat: this.token ? 'expo' : null,
    };
  }

  // ✅ Debugging helper
  async debugNotificationSetup() {
    const status = this.getServiceStatus();
    console.log('🔍 Expo NotificationService Debug Info:', JSON.stringify(status, null, 2));
    
    try {
      const permissions = await Notifications.getPermissionsAsync();
      console.log('🔍 Current permissions:', permissions);
      
      const storedData = await AsyncStorage.multiGet([
        this.STORAGE_KEYS.TOKEN,
        this.STORAGE_KEYS.USER_ID,
        this.STORAGE_KEYS.TOKEN_TIMESTAMP,
        this.STORAGE_KEYS.BACKEND_REGISTRATION_STATUS,
      ]);
      console.log('🔍 Stored data:', storedData);
    } catch (error) {
      console.error('❌ Error getting debug info:', error);
    }
    
    return status;
  }
}

export default new NotificationService();
