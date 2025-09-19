// context/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  onSnapshot,
  where,
  startAfter
} from 'firebase/firestore';
import { db } from '../services/firebase';
import FirebaseService from '../services/firebase';
import StorageService from '../services/storage';
import NotificationService from '../services/NotificationService';
import io from 'socket.io-client';

const AuthContext = createContext();

// Storage keys for persistence
const STORAGE_KEYS = {
  USER_SESSION: 'auth_user_session',
  LOGIN_TIMESTAMP: 'auth_login_timestamp',
  DEVICE_INFO: 'auth_device_info',
  PUSH_TOKEN: 'auth_push_token',
  APP_PREFERENCES: 'auth_app_preferences',
  DATA_SYNC_STATUS: 'auth_data_sync_status',
  LAST_SYNC_TIMESTAMP: 'auth_last_sync_timestamp',
};

// Session expiry (30 days)
const SESSION_EXPIRY_DAYS = 30;
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://securelink-backend-e65c.onrender.com';

const initialState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
  emailVerified: false,
  isOnline: true,
  isConnected: true,
  appState: 'active',
  pushToken: null,
  sessionRestored: false,
  lastActivity: null,
  // ✅ NEW: Data sync states
  syncing: false,
  syncProgress: 0,
  syncStatus: null,
  lastSyncTime: null,
  chatCount: 0,
  messageCount: 0,
  contactCount: 0,
};

// Enhanced user object builder with device info
async function buildFullUser(firebaseUser) {
  if (!firebaseUser) return null;
  
  try {
    const profile = await FirebaseService.getCurrentUserProfile();
    const deviceInfo = await getDeviceInfo();
    
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
      phoneNumber: firebaseUser.phoneNumber || null,
      photoURL: firebaseUser.photoURL || profile?.photoURL || null,
      contactId: profile?.contactId || firebaseUser.uid,
      displayName: profile?.displayName || firebaseUser.displayName || '',
      about: profile?.about || 'Hey there! I am using SecureLink.',
      isOnline: profile?.isOnline || false,
      lastSeen: profile?.lastSeen || null,
      deviceInfo,
      createdAt: profile?.createdAt || new Date(),
      lastLogin: new Date(),
      settings: profile?.settings || {
        profilePhotoVisible: true,
        lastSeenVisible: true,
        onlineStatusVisible: true,
        readReceiptsEnabled: true,
        notificationsEnabled: true,
      },
      privacy: profile?.privacy || {
        whoCanSeeProfile: 'everyone',
        whoCanAddMe: 'everyone',
        whoCanSeeLastSeen: 'everyone',
      },
      ...profile,
    };
  } catch (error) {
    console.error('❌ Error building user profile:', error);
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
      contactId: firebaseUser.uid,
      displayName: firebaseUser.displayName || '',
      deviceInfo: await getDeviceInfo(),
      lastLogin: new Date(),
    };
  }
}

// Get device information for tracking
async function getDeviceInfo() {
  try {
    return {
      deviceName: Device.deviceName || 'Unknown Device',
      deviceType: Device.deviceType,
      platform: Device.osName || (Platform.OS === 'ios' ? 'iOS' : 'Android'),
      platformVersion: Device.osVersion,
      appVersion: Application.nativeApplicationVersion || '1.0.0',
      buildVersion: Application.nativeBuildVersion || '1',
      bundleId: Application.applicationId,
      expoVersion: Constants.expoVersion,
      isDevice: Device.isDevice,
      brand: Device.brand,
      modelName: Device.modelName,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error getting device info:', error);
    return {
      platform: Platform.OS,
      isDevice: Device.isDevice,
      timestamp: new Date().toISOString(),
    };
  }
}

// ✅ Enhanced auth reducer with sync states
function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
      
    case 'AUTH_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        emailVerified: action.payload.user?.emailVerified || false,
        loading: false,
        error: null,
        sessionRestored: action.payload.sessionRestored || false,
        lastActivity: new Date(),
      };
      
    case 'SESSION_RESTORED':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        emailVerified: action.payload.user?.emailVerified || false,
        loading: false,
        error: null,
        sessionRestored: true,
        lastActivity: new Date(),
      };
      
    case 'LOGOUT':
      return {
        ...initialState,
        loading: false,
        sessionRestored: false,
      };
      
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        emailVerified: action.payload.emailVerified !== undefined
          ? action.payload.emailVerified
          : state.emailVerified,
        lastActivity: new Date(),
      };
      
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };

    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
      
    case 'SET_APP_STATE':
      return { ...state, appState: action.payload };
      
    case 'SET_PUSH_TOKEN':
      return { ...state, pushToken: action.payload };
      
    case 'UPDATE_LAST_ACTIVITY':
      return { ...state, lastActivity: new Date() };

    // ✅ NEW: Sync-related actions
    case 'START_SYNC':
      return { 
        ...state, 
        syncing: true, 
        syncProgress: 0, 
        syncStatus: action.payload || 'Initializing sync...',
        error: null 
      };

    case 'UPDATE_SYNC_PROGRESS':
      return { 
        ...state, 
        syncProgress: action.payload.progress,
        syncStatus: action.payload.status,
        chatCount: action.payload.chatCount || state.chatCount,
        messageCount: action.payload.messageCount || state.messageCount,
        contactCount: action.payload.contactCount || state.contactCount,
      };

    case 'SYNC_COMPLETE':
      return { 
        ...state, 
        syncing: false, 
        syncProgress: 100,
        syncStatus: 'Sync completed successfully',
        lastSyncTime: new Date(),
        chatCount: action.payload.chatCount || state.chatCount,
        messageCount: action.payload.messageCount || state.messageCount,
        contactCount: action.payload.contactCount || state.contactCount,
      };

    case 'SYNC_ERROR':
      return { 
        ...state, 
        syncing: false, 
        syncProgress: 0,
        syncStatus: null,
        error: action.payload 
      };
      
    case 'CLEAR_ERROR':
      return { ...state, error: null };
      
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const appStateRef = useRef(AppState.currentState);
  const authListenerRef = useRef(null);
  const activityTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const syncInProgressRef = useRef(false);
  const realtimeListenersRef = useRef([]);

  // ✅ Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: state.isConnected });
      dispatch({ type: 'SET_ONLINE_STATUS', payload: state.isConnected });
      
      if (state.isConnected && !syncInProgressRef.current && state.user) {
        // Reconnect socket when network returns
        setupGlobalSocket(state.user);
        // Sync any pending data
        syncAllDataFromFirebase(true);
      }
    });

    return unsubscribe;
  }, [state.user]);

  // Initialize auth state and session restoration
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        // First, try to restore session from AsyncStorage
        await restoreUserSession();

        // Then set up Firebase auth listener
        if (isMounted) {
          setupFirebaseAuthListener();
          setupAppStateListener();
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (isMounted) {
          dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize authentication' });
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  // Restore user session from AsyncStorage
  const restoreUserSession = useCallback(async () => {
    try {
      console.log('🔐 Attempting to restore user session...');
      
      const [storedUser, loginTimestamp, syncStatus] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION),
        AsyncStorage.getItem(STORAGE_KEYS.LOGIN_TIMESTAMP),
        AsyncStorage.getItem(STORAGE_KEYS.DATA_SYNC_STATUS),
      ]);

      if (storedUser && loginTimestamp) {
        const user = JSON.parse(storedUser);
        const loginTime = new Date(loginTimestamp);
        const now = new Date();
        const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);

        // Check if session is still valid (within expiry period)
        if (daysSinceLogin < SESSION_EXPIRY_DAYS) {
          console.log('✅ Session restored from storage:', user.email);
          
          dispatch({
            type: 'SESSION_RESTORED',
            payload: { user, sessionRestored: true }
          });

          // Setup global socket connection
          await setupGlobalSocket(user);

          // Initialize notifications for restored session
          if (Device.isDevice) {
            initializePushNotifications(user);
          }

          // ✅ Sync data if needed
          const lastSyncTime = syncStatus ? JSON.parse(syncStatus).lastSyncTime : null;
          const shouldSync = !lastSyncTime || (now - new Date(lastSyncTime)) > (24 * 60 * 60 * 1000); // 24 hours
          
          if (shouldSync) {
            setTimeout(() => syncAllDataFromFirebase(false), 2000);
          }

          return true;
        } else {
          console.log('⚠️ Session expired, clearing stored data');
          await clearStoredSession();
        }
      }
    } catch (error) {
      console.error('❌ Error restoring session:', error);
      await clearStoredSession();
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
    
    return false;
  }, []);

  // Setup Firebase auth state listener
  const setupFirebaseAuthListener = useCallback(() => {
    authListenerRef.current = FirebaseService.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('🔐 Firebase user authenticated:', firebaseUser.uid);
          
          // Build complete user profile
          const fullUser = await buildFullUser(firebaseUser);
          
          if (fullUser) {
            // Store session data
            await storeUserSession(fullUser);
            
            // Update auth state
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: { user: fullUser, sessionRestored: false }
            });

            // Setup global socket connection
            await setupGlobalSocket(fullUser);

            // Initialize notifications
            if (Device.isDevice) {
              await initializePushNotifications(fullUser);
            }

            // ✅ CRITICAL: Start comprehensive data sync for new login
            setTimeout(() => syncAllDataFromFirebase(true), 1000);

            console.log('✅ User session established:', fullUser.email);
          }
        } else {
          console.log('👋 Firebase user signed out');
          await handleSignOut();
        }
      } catch (error) {
        console.error('❌ Firebase auth state change error:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: 'Authentication state error occurred'
        });
      }
    });
  }, []);

  // ✅ COMPLETE: Sync all data from Firebase
  const syncAllDataFromFirebase = useCallback(async (isFullSync = false) => {
    if (!state.user || syncInProgressRef.current) {
      console.log('⚠️ Sync skipped - no user or sync in progress');
      return;
    }

    syncInProgressRef.current = true;
    
    try {
      console.log(`🔄 Starting ${isFullSync ? 'full' : 'incremental'} data sync...`);
      
      dispatch({ type: 'START_SYNC', payload: 'Initializing data sync...' });
      
      let totalChatCount = 0;
      let totalMessageCount = 0;
      let totalContactCount = 0;

      // ✅ Step 1: Download all chats metadata
      dispatch({ type: 'UPDATE_SYNC_PROGRESS', payload: { progress: 10, status: 'Downloading chats...' } });
      const chats = await downloadAllChats(state.user.uid);
      totalChatCount = chats.length;
      
      dispatch({ 
        type: 'UPDATE_SYNC_PROGRESS', 
        payload: { 
          progress: 30, 
          status: `Downloaded ${totalChatCount} chats`,
          chatCount: totalChatCount 
        } 
      });

      // ✅ Step 2: Download messages for each chat
      if (chats.length > 0) {
        dispatch({ type: 'UPDATE_SYNC_PROGRESS', payload: { progress: 40, status: 'Downloading messages...' } });
        totalMessageCount = await downloadAllMessages(state.user.uid, chats, isFullSync);
        
        dispatch({ 
          type: 'UPDATE_SYNC_PROGRESS', 
          payload: { 
            progress: 70, 
            status: `Downloaded ${totalMessageCount} messages`,
            messageCount: totalMessageCount 
          } 
        });
      }

      // ✅ Step 3: Download contacts
      dispatch({ type: 'UPDATE_SYNC_PROGRESS', payload: { progress: 80, status: 'Downloading contacts...' } });
      totalContactCount = await downloadAllContacts(state.user.uid);
      
      dispatch({ 
        type: 'UPDATE_SYNC_PROGRESS', 
        payload: { 
          progress: 90, 
          status: `Downloaded ${totalContactCount} contacts`,
          contactCount: totalContactCount 
        } 
      });

      // ✅ Step 4: Setup real-time listeners
      if (isFullSync) {
        dispatch({ type: 'UPDATE_SYNC_PROGRESS', payload: { progress: 95, status: 'Setting up real-time sync...' } });
        setupRealtimeListeners(state.user.uid);
      }

      // ✅ Step 5: Update sync status
      const syncStatus = {
        lastSyncTime: new Date().toISOString(),
        isFullSync,
        chatCount: totalChatCount,
        messageCount: totalMessageCount,
        contactCount: totalContactCount,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.DATA_SYNC_STATUS, JSON.stringify(syncStatus));

      dispatch({ 
        type: 'SYNC_COMPLETE', 
        payload: { 
          chatCount: totalChatCount,
          messageCount: totalMessageCount,
          contactCount: totalContactCount,
        } 
      });

      console.log(`✅ Data sync completed: ${totalChatCount} chats, ${totalMessageCount} messages, ${totalContactCount} contacts`);

    } catch (error) {
      console.error('❌ Data sync error:', error);
      dispatch({ type: 'SYNC_ERROR', payload: 'Data sync failed. Please try again.' });
    } finally {
      syncInProgressRef.current = false;
    }
  }, [state.user]);

  // ✅ Download all chats metadata
  const downloadAllChats = useCallback(async (userId) => {
    try {
      console.log('📥 Downloading all chats metadata...');
      
      const chatsRef = collection(db, 'users', userId, 'chats');
      const chatsQuery = query(chatsRef, orderBy('lastMessageTime', 'desc'));
      const snapshot = await getDocs(chatsQuery);
      
      const chats = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        chats.push({
          contactId: doc.id,
          ...data,
          lastMessageTime: data.lastMessageTime?.toDate?.()?.toISOString() || data.lastMessageTime,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        });
      });
      
      // Save to local storage
      await StorageService.setAllChats(chats);
      
      console.log(`✅ Downloaded ${chats.length} chats metadata`);
      return chats;
    } catch (error) {
      console.error('❌ Error downloading chats:', error);
      return [];
    }
  }, []);

  // ✅ Download all messages for all chats
  const downloadAllMessages = useCallback(async (userId, chats, isFullSync = false) => {
    let totalMessages = 0;
    
    try {
      console.log(`📥 Downloading messages for ${chats.length} chats...`);
      
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        
        try {
          // Determine how many messages to download
          const messageLimit = isFullSync ? 100 : 50; // More messages on full sync
          
          const messagesRef = collection(db, 'users', userId, 'chats', chat.contactId, 'messages');
          const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(messageLimit));
          const snapshot = await getDocs(messagesQuery);
          
          const messages = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString()
            });
          });
          
          if (messages.length > 0) {
            // Merge with existing local messages to avoid duplicates
            const existingMessages = await StorageService.getChatMessages(chat.contactId);
            const merged = mergeMessages(existingMessages, messages);
            
            await StorageService.setChatMessages(chat.contactId, merged);
            totalMessages += messages.length;
            
            console.log(`✅ Downloaded ${messages.length} messages for ${chat.contactId}`);
          }

          // Update progress
          const progress = 40 + Math.floor((i / chats.length) * 30);
          dispatch({ 
            type: 'UPDATE_SYNC_PROGRESS', 
            payload: { 
              progress, 
              status: `Downloaded messages for ${i + 1}/${chats.length} chats`,
              messageCount: totalMessages 
            } 
          });
          
        } catch (chatError) {
          console.error(`❌ Error downloading messages for ${chat.contactId}:`, chatError);
        }
      }
      
      console.log(`✅ Downloaded total of ${totalMessages} messages`);
      return totalMessages;
      
    } catch (error) {
      console.error('❌ Error downloading messages:', error);
      return totalMessages;
    }
  }, []);

  // ✅ Download all contacts
  const downloadAllContacts = useCallback(async (userId) => {
    try {
      console.log('📥 Downloading all contacts...');
      
      // Download from user's contacts collection
      const contactsRef = collection(db, 'users', userId, 'contacts');
      const snapshot = await getDocs(contactsRef);
      
      const contacts = [];
      snapshot.forEach(doc => {
        contacts.push({
          contactId: doc.id,
          ...doc.data(),
          addedAt: doc.data().addedAt?.toDate?.()?.toISOString() || doc.data().addedAt,
        });
      });
      
      // Also get contact details from main users collection
      const enhancedContacts = await Promise.all(
        contacts.map(async (contact) => {
          try {
            const userQuery = query(
              collection(db, 'users'),
              where('contactId', '==', contact.contactId),
              limit(1)
            );
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data();
              return {
                ...contact,
                displayName: userData.displayName || contact.displayName,
                photoURL: userData.photoURL || contact.photoURL,
                about: userData.about || contact.about,
                isOnline: userData.isOnline || false,
                lastSeen: userData.lastSeen?.toDate?.()?.toISOString() || userData.lastSeen,
              };
            }
            
            return contact;
          } catch (error) {
            console.error(`❌ Error enhancing contact ${contact.contactId}:`, error);
            return contact;
          }
        })
      );
      
      // Save to local storage
      await StorageService.setAllContacts(enhancedContacts);
      
      console.log(`✅ Downloaded ${enhancedContacts.length} contacts`);
      return enhancedContacts.length;
      
    } catch (error) {
      console.error('❌ Error downloading contacts:', error);
      return 0;
    }
  }, []);

  // ✅ Merge messages avoiding duplicates
  const mergeMessages = useCallback((existingMessages, newMessages) => {
    const existingIds = new Set(existingMessages.map(msg => msg.id));
    const merged = [...existingMessages];
    
    newMessages.forEach(newMsg => {
      if (!existingIds.has(newMsg.id)) {
        merged.push(newMsg);
      }
    });
    
    // Sort by timestamp (newest first)
    return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, []);

  // ✅ Setup real-time Firebase listeners
  const setupRealtimeListeners = useCallback((userId) => {
    try {
      console.log('🔗 Setting up real-time Firebase listeners...');
      
      // Clear existing listeners
      realtimeListenersRef.current.forEach(unsubscribe => unsubscribe());
      realtimeListenersRef.current = [];

      // 1. Listen to chats collection changes
      const chatsRef = collection(db, 'users', userId, 'chats');
      const chatsQuery = query(chatsRef, orderBy('lastMessageTime', 'desc'));
      
      const chatsUnsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        console.log('🔥 Chats updated via Firebase listener');
        
        const chats = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          chats.push({
            contactId: doc.id,
            ...data,
            lastMessageTime: data.lastMessageTime?.toDate?.()?.toISOString() || data.lastMessageTime,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          });
        });
        
        await StorageService.setAllChats(chats);
        
        dispatch({ 
          type: 'UPDATE_SYNC_PROGRESS', 
          payload: { 
            progress: 100, 
            status: `Live sync: ${chats.length} chats updated`,
            chatCount: chats.length 
          } 
        });
      }, (error) => {
        console.error('❌ Real-time chats listener error:', error);
      });
      
      realtimeListenersRef.current.push(chatsUnsubscribe);

      // 2. Listen to user profile changes
      const userDocRef = doc(db, 'users', userId);
      const userUnsubscribe = onSnapshot(userDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          console.log('👤 User profile updated via listener');
          
          dispatch({
            type: 'UPDATE_USER',
            payload: {
              ...userData,
              lastSeen: userData.lastSeen?.toDate?.()?.toISOString() || userData.lastSeen,
              updatedAt: userData.updatedAt?.toDate?.()?.toISOString() || userData.updatedAt,
            }
          });
        }
      }, (error) => {
        console.error('❌ Real-time user listener error:', error);
      });
      
      realtimeListenersRef.current.push(userUnsubscribe);
      
      console.log('✅ Real-time listeners setup complete');
      
    } catch (error) {
      console.error('❌ Error setting up real-time listeners:', error);
    }
  }, []);

  // ✅ Setup global socket connection
  const setupGlobalSocket = useCallback(async (user) => {
    if (!user || !state.isConnected) return;
    
    try {
      const idToken = await FirebaseService.getIdToken();
      if (!idToken) return;
      
      console.log('🔌 Setting up global socket connection...');
      
      // Disconnect existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5,
      });
      
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('🔌 Global socket connected');
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
        
        socket.emit('authenticate', {
          token: idToken,
          contactId: user.contactId || user.uid,
          deviceId: 'mobile_app'
        });
      });
      
      socket.on('authenticated', () => {
        console.log('✅ Global socket authenticated');
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Global socket disconnected:', reason);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
      });
      
      socket.on('new_message', async (messageData) => {
        console.log('📨 Global new message received:', messageData);
        
        try {
          // Store in local storage
          await StorageService.addChatMessage(messageData.senderContactId, messageData);
          
          // Update chat metadata
          await StorageService.updateChatMetadata(messageData.senderContactId, {
            lastMessage: messageData.content,
            lastMessageTime: messageData.timestamp,
            unreadCount: 1,
            displayName: messageData.senderDisplayName || messageData.senderContactId,
          });
          
          console.log('✅ Global message processed and stored');
        } catch (error) {
          console.error('❌ Error processing global message:', error);
        }
      });
      
    } catch (error) {
      console.error('❌ Global socket setup error:', error);
    }
  }, [state.isConnected]);

  // Setup app state listener for presence management
  const setupAppStateListener = useCallback(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      handleAppStateChange(nextAppState);
    });

    return () => subscription?.remove();
  }, []);

  // Handle app state changes
  const handleAppStateChange = useCallback(async (nextAppState) => {
    const previousState = appStateRef.current;
    appStateRef.current = nextAppState;

    dispatch({ type: 'SET_APP_STATE', payload: nextAppState });

    if (state.isAuthenticated && state.user) {
      try {
        if (previousState.match(/inactive|background/) && nextAppState === 'active') {
          console.log('📱 App came to foreground');
          dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
          
          // Update user online status
          await FirebaseService.updateUserProfile(state.user.uid, {
            isOnline: true,
            lastSeen: new Date(),
            appState: 'active',
          });
          
          // Reconnect socket
          await setupGlobalSocket(state.user);
          
          // Sync data if needed
          const shouldSync = !state.lastSyncTime || 
            (new Date() - new Date(state.lastSyncTime)) > (60 * 60 * 1000); // 1 hour
          
          if (shouldSync) {
            setTimeout(() => syncAllDataFromFirebase(false), 2000);
          }
          
          dispatch({ type: 'UPDATE_LAST_ACTIVITY' });
          
        } else if (nextAppState.match(/inactive|background/)) {
          console.log('📱 App went to background');
          dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
          
          // Update user offline status
          await FirebaseService.updateUserProfile(state.user.uid, {
            isOnline: false,
            lastSeen: new Date(),
            appState: 'background',
          });
        }
      } catch (error) {
        console.error('❌ Error updating presence:', error);
      }
    }
  }, [state.isAuthenticated, state.user, state.lastSyncTime, setupGlobalSocket, syncAllDataFromFirebase]);

  // Store user session data
  const storeUserSession = useCallback(async (user) => {
    try {
      const sessionData = {
        ...user,
        // Remove sensitive data before storing
        password: undefined,
        tokens: undefined,
      };

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(sessionData)),
        AsyncStorage.setItem(STORAGE_KEYS.LOGIN_TIMESTAMP, new Date().toISOString()),
        AsyncStorage.setItem(STORAGE_KEYS.DEVICE_INFO, JSON.stringify(user.deviceInfo)),
      ]);

      console.log('✅ User session stored successfully');
    } catch (error) {
      console.error('❌ Error storing user session:', error);
    }
  }, []);

  // Clear stored session data
  const clearStoredSession = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION),
        AsyncStorage.removeItem(STORAGE_KEYS.LOGIN_TIMESTAMP),
        AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_INFO),
        AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.DATA_SYNC_STATUS),
        AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC_TIMESTAMP),
      ]);

      console.log('✅ Stored session cleared');
    } catch (error) {
      console.error('❌ Error clearing session:', error);
    }
  }, []);

  // Initialize push notifications
  const initializePushNotifications = useCallback(async (user) => {
    try {
      const token = await NotificationService.initialize(user.uid);
      
      if (token) {
        dispatch({ type: 'SET_PUSH_TOKEN', payload: token });
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
        console.log('🔔 Push notifications initialized');
      }
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
    }
  }, []);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    // Clear real-time listeners
    realtimeListenersRef.current.forEach(unsubscribe => unsubscribe());
    realtimeListenersRef.current = [];
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    dispatch({ type: 'LOGOUT' });
    await clearStoredSession();
    await StorageService.clearAllAppData();
    NotificationService.cleanup();
  }, [clearStoredSession]);

  // Sign up with email
  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const result = await FirebaseService.signUpWithEmail(email, password, displayName);
      
      if (result?.user) {
        console.log('📝 Registration successful:', result.user.uid);
        
        if (result.needsEmailVerification) {
          Alert.alert(
            'Email Verification Required',
            'Please check your email and verify your account before signing in.',
            [{ text: 'OK' }]
          );
        }
      }
      
      return result;
    } catch (error) {
      console.error('❌ Registration error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error.message || 'Registration failed. Please try again.'
      });
      throw error;
    }
  }, []);

  // Sign in with email
  const signInWithEmail = useCallback(async (email, password) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const result = await FirebaseService.signInWithEmail(email, password);
      
      if (result?.user) {
        console.log('🔑 Login successful:', result.user.uid);
        
        if (result.needsEmailVerification) {
          Alert.alert(
            'Email Verification Required',
            'Please verify your email address to access all features.',
            [{ text: 'OK' }]
          );
        }
      }
      
      return result;
    } catch (error) {
      console.error('❌ Login error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error.message || 'Login failed. Please check your credentials.'
      });
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Update user status to offline before logout
      if (state.user) {
        await FirebaseService.updateUserProfile(state.user.uid, {
          isOnline: false,
          lastSeen: new Date(),
          appState: 'background',
        });
      }
      
      // Sign out from Firebase
      await FirebaseService.signOut();
      
      console.log('👋 User logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Force logout even if there's an error
      await handleSignOut();
    }
  }, [state.user, handleSignOut]);

  // Send password reset
  const sendPasswordReset = useCallback(async (email) => {
    try {
      await FirebaseService.sendPasswordReset(email);
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      console.error('❌ Password reset error:', error);
      throw error;
    }
  }, []);

  // Send email verification
  const sendEmailVerification = useCallback(async () => {
    try {
      await FirebaseService.sendEmailVerification();
      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      console.error('❌ Email verification error:', error);
      throw error;
    }
  }, []);

  // Reload user profile
  const reloadUser = useCallback(async () => {
    try {
      const updatedFirebaseUser = await FirebaseService.reloadUser();
      
      if (updatedFirebaseUser) {
        const fullUser = await buildFullUser(updatedFirebaseUser);
        
        if (fullUser) {
          // Update stored session
          await storeUserSession(fullUser);
          
          // Update state
          dispatch({
            type: 'UPDATE_USER',
            payload: fullUser,
          });
          
          return fullUser;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Reload user error:', error);
      throw error;
    }
  }, [storeUserSession]);

  // Update profile
  const updateProfile = useCallback(async (updates) => {
    try {
      const updatedUser = await FirebaseService.updateProfile(updates);
      
      if (updatedUser && state.user) {
        const deviceInfo = await getDeviceInfo();
        
        // Update Firestore profile
        await FirebaseService.updateUserProfile(updatedUser.uid, {
          ...updates,
          deviceInfo,
          updatedAt: new Date(),
        });
        
        // Reload complete profile
        await reloadUser();
      }
      
      return updatedUser;
    } catch (error) {
      console.error('❌ Update profile error:', error);
      throw error;
    }
  }, [state.user, reloadUser]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Check session validity
  const isSessionValid = useCallback(async () => {
    try {
      const loginTimestamp = await AsyncStorage.getItem(STORAGE_KEYS.LOGIN_TIMESTAMP);
      
      if (loginTimestamp) {
        const loginTime = new Date(loginTimestamp);
        const now = new Date();
        const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);
        
        return daysSinceLogin < SESSION_EXPIRY_DAYS;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking session validity:', error);
      return false;
    }
  }, []);

  // ✅ Manual sync trigger
  const triggerManualSync = useCallback(async () => {
    if (!state.user || state.syncing) return;
    
    await syncAllDataFromFirebase(true);
  }, [state.user, state.syncing, syncAllDataFromFirebase]);

  // Get app info for debugging
  const getAppInfo = useCallback(() => {
    return {
      appVersion: Application.nativeApplicationVersion,
      buildVersion: Application.nativeBuildVersion,
      expoVersion: Constants.expoVersion,
      platform: Platform.OS,
      deviceInfo: state.user?.deviceInfo,
      sessionExpiry: SESSION_EXPIRY_DAYS,
      lastActivity: state.lastActivity,
      syncStatus: {
        syncing: state.syncing,
        lastSyncTime: state.lastSyncTime,
        chatCount: state.chatCount,
        messageCount: state.messageCount,
        contactCount: state.contactCount,
      },
    };
  }, [state.user, state.lastActivity, state.syncing, state.lastSyncTime, state.chatCount, state.messageCount, state.contactCount]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (authListenerRef.current) {
      authListenerRef.current();
      authListenerRef.current = null;
    }
    
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }

    // Clear real-time listeners
    realtimeListenersRef.current.forEach(unsubscribe => unsubscribe());
    realtimeListenersRef.current = [];
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    NotificationService.cleanup();
  }, []);

  // Context value
  const contextValue = {
    // State
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    loading: state.loading,
    error: state.error,
    emailVerified: state.emailVerified,
    isOnline: state.isOnline,
    isConnected: state.isConnected,
    appState: state.appState,
    pushToken: state.pushToken,
    sessionRestored: state.sessionRestored,
    lastActivity: state.lastActivity,
    
    // ✅ NEW: Sync states
    syncing: state.syncing,
    syncProgress: state.syncProgress,
    syncStatus: state.syncStatus,
    lastSyncTime: state.lastSyncTime,
    chatCount: state.chatCount,
    messageCount: state.messageCount,
    contactCount: state.contactCount,
    
    // Methods
    signUpWithEmail,
    signInWithEmail,
    logout,
    sendPasswordReset,
    sendEmailVerification,
    reloadUser,
    updateProfile,
    clearError,
    getAppInfo,
    isSessionValid,
    
    // ✅ NEW: Sync methods
    syncAllDataFromFirebase,
    triggerManualSync,
    
    // Internal methods (if needed)
    initializePushNotifications,
    storeUserSession,
    clearStoredSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
