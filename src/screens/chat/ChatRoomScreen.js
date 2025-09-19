// screens/chat/ChatRoomScreen.js
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Text,
  Image,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  ActionSheetIOS,
} from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

// Context imports
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useContacts } from '../../context/ContactContext';

// Services
import StorageService from '../../services/storage';
import FirebaseService from '../../services/firebase';

// Firebase Web SDK imports
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  deleteDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../../services/firebase';

// WebSocket for real-time features
import io from 'socket.io-client';

// Constants
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://securelink-backend-e65c.onrender.com';
const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// ✅ Proper status bar height calculation
const getStatusBarHeight = () => {
  if (Platform.OS === 'ios') {
    return 0;
  }
  return StatusBar.currentHeight || 0;
};

// ✅ Date formatting utilities
const formatMessageDate = (date) => {
  const now = new Date();
  const messageDate = new Date(date);
  const diffInDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) {
    return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return messageDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const formatMessageTime = (date) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export default function ChatRoomScreen({ navigation }) {
  const route = useRoute();
  const { theme, isDark } = useTheme();
  const { user, isOnline: userOnline } = useAuth();
  const { getContact } = useContacts();
  const insets = useSafeAreaInsets();

  // Route params with fallbacks
  const { 
    contactId, 
    contactName, 
    displayName,
    contactPhoto 
  } = route.params || {};

  // State management
  const [messages, setMessages] = useState([]);
  const [groupedMessages, setGroupedMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactProfile, setContactProfile] = useState(null);
  const [recipientUserId, setRecipientUserId] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageUnsubscribeRef = useRef(null);
  const userUnsubscribeRef = useRef(null);
  const inputRef = useRef(null);
  const messageQueueRef = useRef([]);

  // ✅ Enhanced keyboard listeners
  useEffect(() => {
    const keyboardDidShow = (event) => {
      const { height } = event.endCoordinates;
      setKeyboardHeight(height);
      setKeyboardVisible(true);
      
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    };

    const keyboardDidHide = () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    };

    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', 
      keyboardDidShow
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', 
      keyboardDidHide
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Focus effect for screen lifecycle
  useFocusEffect(
    useCallback(() => {
      if (user?.uid && contactId) {
        initializeChat();
      }

      return cleanup;
    }, [contactId, user])
  );

  // ✅ FIXED: Setup Firebase listeners when recipientUserId is available
  useEffect(() => {
    if (user?.uid && recipientUserId && contactId) {
      console.log('✅ Setting up Firebase listeners with:', { 
        userUid: user.uid, 
        recipientUserId, 
        contactId 
      });
      setupFirebaseListeners();
    }

    return cleanup;
  }, [user?.uid, recipientUserId, contactId]);

  // ✅ COMPLETE: Initialize chat data
  const initializeChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Load contact profile and get recipient Firebase ID
      await loadContactProfile();
      
      // 2. Setup WebSocket connection
      await setupWebSocket();
      
      // 3. Load messages from Firebase AND local storage
      await loadAllMessages();
      
      // 4. Setup custom header
      setupCustomHeader();
      
      // Note: Firebase listeners are set up via useEffect when recipientUserId becomes available

      console.log('✅ Chat initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
      setError('Failed to initialize chat');
    } finally {
      setLoading(false);
    }
  }, [contactId, user]);

  // ✅ Group messages by date with WhatsApp-style date separators
  const groupMessagesByDate = useCallback((messages) => {
    if (!messages || messages.length === 0) return [];

    const grouped = [];
    let currentDateKey = null;

    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    sortedMessages.forEach((message) => {
      const messageDate = new Date(message.timestamp);
      const dateKey = messageDate.toDateString();

      if (currentDateKey !== dateKey) {
        grouped.push({
          type: 'date',
          id: `date_${dateKey}`,
          date: formatMessageDate(message.timestamp),
          timestamp: message.timestamp,
        });
        currentDateKey = dateKey;
      }

      grouped.push({
        ...message,
        type: 'message',
      });
    });

    return grouped.reverse();
  }, []);

  // Update grouped messages when messages change
  useEffect(() => {
    const grouped = groupMessagesByDate(messages);
    setGroupedMessages(grouped);
  }, [messages, groupMessagesByDate]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (messageUnsubscribeRef.current) {
      messageUnsubscribeRef.current();
      messageUnsubscribeRef.current = null;
    }
    if (userUnsubscribeRef.current) {
      userUnsubscribeRef.current();
      userUnsubscribeRef.current = null;
    }
  }, []);

  // ✅ COMPLETE: Load contact profile and get recipient Firebase user ID
  const loadContactProfile = useCallback(async () => {
    try {
      console.log(`🔍 Loading profile for contactId: ${contactId}`);
      
      const localContact = getContact ? getContact(contactId) : null;
      if (localContact) {
        setContactProfile(localContact);
        setIsOnline(localContact.isOnline || false);
        setLastSeen(localContact.lastSeen);
      }

      // ✅ CRITICAL: Find recipient's Firebase user ID
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('contactId', '==', contactId), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const userId = snapshot.docs[0].id; // ✅ Get Firebase UID
        
        const profile = {
          contactId: userData.contactId,
          displayName: userData.displayName || contactName || displayName,
          photoURL: userData.photoURL || contactPhoto,
          isOnline: userData.isOnline || false,
          lastSeen: userData.lastSeen,
        };
        
        setContactProfile(profile);
        setRecipientUserId(userId); // ✅ Store recipient's Firebase UID
        setIsOnline(profile.isOnline);
        setLastSeen(profile.lastSeen);
        
        await StorageService.addContact(profile);
        console.log(`✅ Found recipient user ID: ${userId} for contactId: ${contactId}`);
      } else {
        console.warn(`⚠️ No Firebase user found for contactId: ${contactId}`);
        const fallbackProfile = {
          contactId,
          displayName: contactName || displayName || contactId,
          photoURL: contactPhoto,
          isOnline: false,
          lastSeen: null,
        };
        setContactProfile(fallbackProfile);
        setError('Contact not found in database');
      }
    } catch (error) {
      console.error('❌ Error loading contact profile:', error);
      setError('Failed to load contact information');
    }
  }, [contactId, contactName, displayName, contactPhoto, getContact]);

  // ✅ FIXED: Load messages from Firebase AND local storage
  const loadAllMessages = useCallback(async () => {
    try {
      console.log(`📥 Loading messages for chat with ${contactId}`);
      
      // 1. Load from local storage first (instant loading)
      const localMessages = await StorageService.getChatMessages(contactId);
      if (localMessages.length > 0) {
        setMessages(localMessages);
        console.log(`📱 Loaded ${localMessages.length} messages from local storage`);
      }

      // 2. Load from Firebase (get latest messages) - only if we have the required IDs
      if (user?.uid && recipientUserId) {
        console.log(`🔥 Loading Firebase messages with userUid: ${user.uid}, recipientUserId: ${recipientUserId}`);
        
        const messagesRef = collection(db, 'users', user.uid, 'chats', contactId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(100));
        const snapshot = await getDocs(q);

        const firebaseMessages = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          firebaseMessages.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString()
          });
        });

        console.log(`🔥 Loaded ${firebaseMessages.length} messages from Firebase`);

        if (firebaseMessages.length > 0) {
          // Merge with local messages (avoid duplicates)
          const mergedMessages = [...firebaseMessages];
          const firebaseIds = new Set(firebaseMessages.map(msg => msg.id));
          
          localMessages.forEach(localMsg => {
            if (!firebaseIds.has(localMsg.id)) {
              mergedMessages.push(localMsg);
            }
          });

          // Sort by timestamp
          mergedMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          setMessages(mergedMessages);
          
          // Update local storage with merged messages
          await StorageService.setChatMessages(contactId, mergedMessages);
        }
      } else {
        console.log('⚠️ Skipping Firebase message load - missing required IDs');
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setError('Failed to load messages');
    }
  }, [contactId, user, recipientUserId]);

  // ✅ FIXED: Setup Firebase real-time listeners
  const setupFirebaseListeners = useCallback(() => {
    if (!user?.uid || !recipientUserId) {
      console.warn('⚠️ Cannot setup Firebase listeners - missing user IDs:', {
        userUid: user?.uid,
        recipientUserId
      });
      return;
    }

    try {
      console.log('🔥 Setting up Firebase real-time listeners...');

      // 1. Listen to messages in real-time
      const messagesRef = collection(db, 'users', user.uid, 'chats', contactId, 'messages');
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(100));

      const messageUnsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
        console.log('🔥 Firebase messages updated');
        
        const firebaseMessages = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          firebaseMessages.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString()
          });
        });

        if (firebaseMessages.length > 0) {
          // Update local storage
          await StorageService.setChatMessages(contactId, firebaseMessages);
          
          // Update state
          setMessages(firebaseMessages);
          
          console.log(`✅ Updated ${firebaseMessages.length} messages from Firebase listener`);
        }
      }, (error) => {
        console.error('❌ Firebase messages listener error:', error);
      });

      messageUnsubscribeRef.current = messageUnsubscribe;

      // 2. Listen to recipient user status
      const userRef = doc(db, 'users', recipientUserId);
      const userUnsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          setIsOnline(userData.isOnline || false);
          setLastSeen(userData.lastSeen?.toDate?.()?.toISOString() || userData.lastSeen);
          
          console.log(`👤 User ${contactId} status: ${userData.isOnline ? 'online' : 'offline'}`);
        }
      }, (error) => {
        console.error('❌ Firebase user listener error:', error);
      });

      userUnsubscribeRef.current = userUnsubscribe;

      console.log('✅ Firebase real-time listeners setup complete');

    } catch (error) {
      console.error('❌ Error setting up Firebase listeners:', error);
    }
  }, [user, recipientUserId, contactId]);

  // ✅ ENHANCED: WebSocket setup with proper message status handling
  const setupWebSocket = useCallback(async () => {
    if (!userOnline || !user?.uid) return;

    try {
      const idToken = await FirebaseService.getIdToken();
      if (!idToken) {
        console.error('❌ No Firebase token available');
        return;
      }

      console.log('🔌 Connecting to WebSocket...');

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
        console.log('🔌 WebSocket connected:', socket.id);
        setIsConnected(true);
        setError(null);
        
        // ✅ Authenticate with server
        socket.emit('authenticate', {
          token: idToken,
          contactId: user.contactId || user.uid,
          deviceId: 'mobile_app'
        });
      });

      socket.on('authenticated', (data) => {
        console.log('✅ WebSocket authenticated:', data);
        // ✅ Process any queued messages
        processMessageQueue();
      });

      socket.on('auth_error', (error) => {
        console.error('❌ WebSocket auth error:', error);
        setIsConnected(false);
        setError('Authentication failed');
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        setIsConnected(false);
        setError('Connection lost');
        
        if (reason === 'io server disconnect') {
          // Server disconnected, manually reconnect
          setTimeout(() => socket.connect(), 2000);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        setIsConnected(false);
        setError('Failed to connect');
      });

      // ✅ CRITICAL: Handle incoming messages
      socket.on('new_message', async (messageData) => {
        console.log('📨 Received new message via WebSocket:', messageData);
        
        if (messageData.senderContactId === contactId) {
          try {
            // ✅ Store message locally
            await StorageService.addChatMessage(contactId, messageData);
            
            // ✅ Update messages state (avoid duplicates)
            setMessages(prev => {
              const exists = prev.find(msg => msg.id === messageData.id);
              if (!exists) {
                return [messageData, ...prev];
              }
              return prev;
            });
            
            // ✅ IMPORTANT: Send delivery confirmation automatically
            socket.emit('message_delivered', {
              messageId: messageData.id,
              senderContactId: messageData.senderContactId,
              recipientContactId: user.contactId || user.uid,
              deliveredAt: new Date().toISOString()
            });

            // ✅ Scroll to show new message
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
            
            console.log('✅ New message processed and delivery confirmation sent');
          } catch (error) {
            console.error('❌ Error processing new message:', error);
          }
        }
      });

      // ✅ CRITICAL: Handle message status updates (delivery confirmations)
      socket.on('message_delivered_confirmation', (data) => {
        const { messageId, deliveredAt } = data;
        console.log(`📋 Message delivered confirmation: ${messageId} at ${deliveredAt}`);
        
        // ✅ Update message status to 'delivered' (double tick)
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            status: 'delivered',
            deliveredAt: deliveredAt
          } : msg
        ));
        
        // Update local storage
        StorageService.updateMessageStatus(contactId, messageId, 'delivered');
      });

      // ✅ ENHANCED: Handle read receipts
      socket.on('message_read_confirmation', (data) => {
        const { messageId, readAt } = data;
        console.log(`📖 Message read confirmation: ${messageId} at ${readAt}`);
        
        // ✅ Update message status to 'read' (blue double tick)
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            status: 'read',
            readAt: readAt
          } : msg
        ));
        
        // Update local storage
        StorageService.updateMessageStatus(contactId, messageId, 'read');
      });

      // ✅ Handle general message status updates
      socket.on('message_status_updated', (data) => {
        const { messageId, status, timestamp } = data;
        console.log(`📋 Message status updated: ${messageId} -> ${status}`);
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            status,
            [`${status}At`]: timestamp
          } : msg
        ));
        
        // Update local storage
        StorageService.updateMessageStatus(contactId, messageId, status);
      });

      socket.on('user_online', (data) => {
        if (data.contactId === contactId) {
          setIsOnline(true);
          console.log(`🟢 ${contactId} is online`);
        }
      });

      socket.on('user_offline', (data) => {
        if (data.contactId === contactId) {
          setIsOnline(false);
          setLastSeen(new Date().toISOString());
          console.log(`🔴 ${contactId} is offline`);
        }
      });

      socket.on('typing_start', (data) => {
        if (data.contactId === contactId) {
          setIsTyping(true);
        }
      });

      socket.on('typing_stop', (data) => {
        if (data.contactId === contactId) {
          setIsTyping(false);
        }
      });

    } catch (error) {
      console.error('❌ WebSocket setup error:', error);
      setError('Failed to connect to chat server');
    }
  }, [contactId, user, userOnline]);

  // ✅ Process queued messages when socket reconnects
  const processMessageQueue = useCallback(async () => {
    if (messageQueueRef.current.length > 0 && socketRef.current?.connected) {
      console.log(`📤 Processing ${messageQueueRef.current.length} queued messages`);
      
      for (const queuedMessage of messageQueueRef.current) {
        try {
          await sendMessageViaAPI(queuedMessage);
        } catch (error) {
          console.error('❌ Failed to send queued message:', error);
        }
      }
      
      messageQueueRef.current = [];
    }
  }, []);

  // ✅ COMPLETE: Send message via API (Firebase storage + WebSocket notification)
  const sendMessageViaAPI = useCallback(async (messageData) => {
    try {
      const idToken = await FirebaseService.getIdToken();
      if (!idToken) {
        throw new Error('No authentication token available');
      }

      console.log('📤 Sending message via API...');

      const response = await fetch(`${SERVER_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientContactId: messageData.recipientContactId,
          content: messageData.content,
          messageType: messageData.messageType || 'text',
          messageId: messageData.id,  // ✅ Include messageId for status tracking
          silent: false
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      console.log('✅ Message sent via API:', result);
      return result;

    } catch (error) {
      console.error('❌ API send error:', error);
      throw error;
    }
  }, []);

  // ✅ COMPLETE: Main send message function
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    Keyboard.dismiss();

    try {
      if (!recipientUserId) {
        Alert.alert('Error', 'Recipient not found. Please try again.');
        return;
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const messageData = {
        id: messageId,
        senderContactId: user.contactId || user.uid,
        recipientContactId: contactId,
        senderUserId: user.uid,
        recipientUserId: recipientUserId,
        content: messageText,
        timestamp: new Date().toISOString(),
        messageType: 'text',
        status: 'sending',
      };

      console.log('📤 Preparing to send message:', {
        messageId,
        senderContactId: messageData.senderContactId,
        recipientContactId: contactId,
        recipientUserId
      });

      // ✅ Optimistic UI update
      setMessages(prev => [messageData, ...prev]);
      await StorageService.addChatMessage(contactId, messageData);

      try {
        // ✅ Send via API (handles Firebase storage + WebSocket notification)
        const result = await sendMessageViaAPI(messageData);
        
        // ✅ Update message status to sent (single tick)
        const updatedMessage = { 
          ...messageData, 
          status: 'sent',
          sentAt: new Date().toISOString()
        };
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? updatedMessage : msg
        ));
        await StorageService.updateMessageStatus(contactId, messageId, 'sent');

        // ✅ Update chat metadata
        await StorageService.updateChatMetadata(contactId, {
          lastMessage: messageText,
          lastMessageTime: new Date().toISOString(),
          displayName: contactProfile?.displayName || contactId,
        });

        console.log('✅ Message sent successfully - waiting for delivery confirmation');

      } catch (apiError) {
        console.error('❌ API send failed, trying WebSocket:', apiError);
        
        // ✅ Fallback to WebSocket if API fails
        if (socketRef.current?.connected) {
          socketRef.current.emit('send_message', {
            recipientContactId: contactId,
            content: messageText,
            messageType: 'text',
            messageId,
          }, (response) => {
            if (response && response.success) {
              const updatedMessage = { 
                ...messageData, 
                status: 'sent',
                sentAt: new Date().toISOString()
              };
              setMessages(prev => prev.map(msg => 
                msg.id === messageId ? updatedMessage : msg
              ));
              StorageService.updateMessageStatus(contactId, messageId, 'sent');
              console.log('✅ Message sent via WebSocket');
            } else {
              throw new Error('WebSocket send failed');
            }
          });
        } else {
          // ✅ Queue message for later if no connection
          messageQueueRef.current.push(messageData);
          throw new Error('No connection available');
        }
      }

    } catch (error) {
      console.error('❌ Complete send failure:', error);
      
      // ✅ Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.content === messageText && msg.status === 'sending' 
          ? { ...msg, status: 'failed' } 
          : msg
      ));
      
      Alert.alert('Send Failed', 'Message failed to send. It will be retried when connection is restored.', [
        { text: 'OK' }
      ]);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, user, contactId, recipientUserId, contactProfile, sendMessageViaAPI]);

  // Handle typing indicators
  const handleTextChange = useCallback((text) => {
    setInputText(text);
    
    if (socketRef.current?.connected) {
      if (text.length > 0) {
        socketRef.current.emit('typing_start', { contactId });
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          socketRef.current.emit('typing_stop', { contactId });
        }, 2000);
      } else {
        socketRef.current.emit('typing_stop', { contactId });
      }
    }
  }, [contactId]);

  // ✅ Enhanced message deletion with proper options
  const handleMessageLongPress = useCallback((message) => {
    const isOwnMessage = message.senderContactId === (user.contactId || user.uid);
    
    const options = [
      { text: 'Cancel', style: 'cancel' }
    ];

    if (isOwnMessage) {
      options.unshift(
        { 
          text: 'Delete for Everyone', 
          style: 'destructive',
          onPress: () => handleDeleteForEveryone(message)
        }
      );
    }

    options.unshift({
      text: 'Delete for Me',
      style: 'destructive', 
      onPress: () => handleDeleteForMe(message)
    });

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options.map(opt => opt.text),
          destructiveButtonIndex: options.findIndex(opt => opt.style === 'destructive'),
          cancelButtonIndex: options.findIndex(opt => opt.style === 'cancel'),
        },
        (buttonIndex) => {
          if (buttonIndex !== options.length - 1) {
            options[buttonIndex].onPress?.();
          }
        }
      );
    } else {
      Alert.alert('Message Options', '', options);
    }
  }, [user]);

  // Delete message for me only
  const handleDeleteForMe = useCallback(async (message) => {
    try {
      await StorageService.deleteMessageForMe(contactId, message.id);
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
      console.log('✅ Message deleted for me');
    } catch (error) {
      console.error('❌ Error deleting message for me:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  }, [contactId]);

  // Delete message for everyone
  const handleDeleteForEveryone = useCallback(async (message) => {
    try {
      const messageTime = new Date(message.timestamp);
      const now = new Date();
      const timeDiff = now - messageTime;
      const oneHour = 60 * 60 * 1000;

      if (timeDiff > oneHour) {
        Alert.alert('Cannot Delete', 'You can only delete messages for everyone within 1 hour of sending.');
        return;
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('delete_message', {
          messageId: message.id,
          contactId: contactId
        });
      } else {
        const idToken = await FirebaseService.getIdToken();
        const response = await fetch(`${SERVER_URL}/api/chat/delete/${message.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Server deletion failed');
        }
      }

      await StorageService.deleteMessageForMe(contactId, message.id);
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
      
      console.log('✅ Message deleted for everyone');
    } catch (error) {
      console.error('❌ Error deleting message for everyone:', error);
      Alert.alert('Error', 'Failed to delete message for everyone');
    }
  }, [contactId]);

  // Get time ago string
  const getTimeAgo = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const now = new Date();
      const messageTime = new Date(timestamp);
      const diffMs = now - messageTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return 'online';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return messageTime.toLocaleDateString();
    } catch {
      return '';
    }
  }, []);

  // ✅ Enhanced custom header with connection status
  const setupCustomHeader = useCallback(() => {
    navigation.setOptions({
      header: () => (
        <SafeAreaView style={[
          styles.headerContainer, 
          { 
            backgroundColor: theme.primary,
            paddingTop: Platform.OS === 'android' ? getStatusBarHeight() : 0
          }
        ]}>
          <StatusBar 
            backgroundColor={theme.primary} 
            barStyle="light-content"
            translucent={false}
          />
          
          <View style={[styles.header]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={24} color={theme.textOnPrimary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.profileSection}
              onPress={() => {
                Alert.alert(
                  contactProfile?.displayName || contactId,
                  `Contact ID: ${contactId}\nStatus: ${isOnline ? 'Online' : 'Offline'}\nConnection: ${isConnected ? 'Connected' : 'Disconnected'}`,
                  [{ text: 'OK' }]
                );
              }}
            >
              <View style={styles.avatarContainer}>
                <Image
                  source={{ 
                    uri: contactProfile?.photoURL || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(contactProfile?.displayName || contactId)}&background=random&color=fff&size=40`
                  }}
                  style={styles.avatar}
                />
                {isOnline && <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />}
                {!isConnected && <View style={[styles.offlineIndicator, { backgroundColor: '#FF5252' }]} />}
              </View>
              
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: theme.textOnPrimary }]} numberOfLines={1}>
                  {contactProfile?.displayName || contactName || displayName || contactId}
                </Text>
                <Text style={[styles.contactStatus, { color: theme.textOnPrimary + 'CC' }]} numberOfLines={1}>
                  {isTyping ? 'typing...' : 
                   isOnline ? 'online' : 
                   lastSeen ? `last seen ${getTimeAgo(lastSeen)}` : 'offline'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => Alert.alert('Coming Soon', 'Voice call feature will be available soon!')}
              >
                <MaterialIcons name="call" size={22} color={theme.textOnPrimary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => Alert.alert('Coming Soon', 'Video call feature will be available soon!')}
              >
                <MaterialIcons name="videocam" size={22} color={theme.textOnPrimary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  Alert.alert('Chat Options', 'Choose an option', [
                    { text: 'Clear Chat', style: 'destructive' },
                    { text: 'Block Contact', style: 'destructive' },
                    { text: 'Cancel', style: 'cancel' }
                  ]);
                }}
              >
                <MaterialIcons name="more-vert" size={22} color={theme.textOnPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      ),
    });
  }, [navigation, contactProfile, isOnline, isTyping, lastSeen, theme, contactId, contactName, displayName, getTimeAgo, isConnected]);

  // ✅ ENHANCED: Message renderer with proper status indicators
  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <View style={[styles.dateBadge, { backgroundColor: theme.surface }]}>
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {item.date}
            </Text>
          </View>
        </View>
      );
    }

    const isOwn = item.senderContactId === (user.contactId || user.uid);

    return (
      <TouchableOpacity
        style={styles.messageWrapper}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={500}
      >
        <View style={[
          styles.messageBubble,
          isOwn ? [styles.ownMessage, { backgroundColor: theme.primary }] 
                : [styles.otherMessage, { backgroundColor: theme.surface }]
        ]}>
          <Text style={[
            styles.messageText,
            { color: isOwn ? theme.textOnPrimary : theme.text }
          ]}>
            {item.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              { color: isOwn ? theme.textOnPrimary + '99' : theme.textSecondary }
            ]}>
              {formatMessageTime(item.timestamp)}
            </Text>
            
            {/* ✅ ENHANCED: Message status indicators with proper icons */}
            {isOwn && (
              <View style={styles.messageStatus}>
                {item.status === 'sending' && (
                  <ActivityIndicator size="small" color={theme.textOnPrimary + '99'} />
                )}
                {item.status === 'sent' && (
                  <MaterialIcons name="done" size={16} color={theme.textOnPrimary + '99'} />
                )}
                {item.status === 'delivered' && (
                  <MaterialIcons name="done-all" size={16} color={theme.textOnPrimary + '99'} />
                )}
                {item.status === 'read' && (
                  <MaterialIcons name="done-all" size={16} color="#4FC3F7" />
                )}
                {item.status === 'failed' && (
                  <TouchableOpacity onPress={() => setInputText(item.content)}>
                    <MaterialIcons name="error" size={16} color="#FF5252" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [theme, user, handleMessageLongPress]);

  // Empty state
  const renderEmptyState = useMemo(() => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="chat" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.text }]}>
        No messages yet
      </Text>
      <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
        Start the conversation with {contactProfile?.displayName || contactId}
      </Text>
      {error && (
        <Text style={[styles.errorText, { color: theme.error, marginTop: 10 }]}>
          {error}
        </Text>
      )}
    </View>
  ), [theme, contactProfile, contactId, error]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="account-circle" size={80} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            Please login to access chat
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const keyboardVerticalOffset = Platform.OS === 'ios' 
    ? insets.top + 44 
    : getStatusBarHeight() + 56;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={groupedMessages.length === 0 ? { flex: 1 } : { 
            paddingVertical: 16,
            paddingHorizontal: 16,
            paddingBottom: 20,
          }}
          inverted={groupedMessages.length > 0}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading messages...
              </Text>
            </View>
          ) : renderEmptyState}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={[styles.typingContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.typingAvatar}>
              <Image
                source={{ 
                  uri: contactProfile?.photoURL || 
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(contactProfile?.displayName || contactId)}&background=random&color=fff&size=24`
                }}
                style={styles.typingAvatarImage}
              />
            </View>
            <View style={styles.typingDots}>
              <View style={[styles.typingDot, { backgroundColor: theme.primary }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.primary }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.primary }]} />
            </View>
          </View>
        )}

        {/* Input Container */}
        <View style={[
          styles.inputContainer, 
          { 
            backgroundColor: theme.surface,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8,
          }
        ]}>
          <View style={[styles.inputRow, { backgroundColor: theme.background }]}>
            <TouchableOpacity 
              style={styles.attachButton}
              onPress={() => Alert.alert('Coming Soon', 'Image sending will be available soon!')}
            >
              <MaterialIcons name="attach-file" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
            
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: theme.text }]}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder={`Message ${contactProfile?.displayName || contactId}...`}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={1000}
              textAlignVertical="center"
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                { 
                  backgroundColor: inputText.trim() && !sending ? theme.primary : theme.border,
                  opacity: (!isConnected && !error) ? 0.5 : 1
                }
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.textOnPrimary} />
              ) : (
                <MaterialIcons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() ? theme.textOnPrimary : theme.textSecondary} 
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  headerContainer: {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  backButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 20,
  },
  profileSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  offlineIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactStatus: {
    fontSize: 13,
    fontWeight: '400',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
  },

  messagesList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },

  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  messageWrapper: {
    marginVertical: 2,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: '400',
  },
  messageStatus: {
    marginLeft: 4,
  },

  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    alignSelf: 'flex-start',
    maxWidth: '60%',
  },
  typingAvatar: {
    marginRight: 8,
  },
  typingAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1,
    opacity: 0.7,
  },

  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  attachButton: {
    marginRight: 12,
    padding: 4,
    borderRadius: 20,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.8,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});
