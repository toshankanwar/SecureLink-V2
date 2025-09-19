// screens/chat/ChatListScreen.js - COMPLETE FIXED VERSION
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

// Context imports
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useContacts } from '../../context/ContactContext';

// Services
import StorageService from '../../services/storage';
import FirebaseService from '../../services/firebase';

// Styles and constants
import { typography } from '../../styles/typography';
import { ROUTES } from '../../utils/constants';

// Firebase Web SDK imports
import { 
  collection, 
  doc, 
  onSnapshot, 
  orderBy, 
  query, 
  getDocs,
  limit 
} from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function ChatListScreen({ navigation }) {
  const { user, isOnline } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { contacts } = useContacts();
  const insets = useSafeAreaInsets();

  // State management
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isListenerActive, setIsListenerActive] = useState(false);

  // Refs
  const searchInputRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const isComponentMountedRef = useRef(true);

  // ✅ FIXED: Robust Firebase Listener Setup
  const setupFirebaseListener = useCallback(() => {
    if (!user?.uid || unsubscribeRef.current) {
      console.log('⚠️ Skipping listener setup - no user or already active');
      return;
    }

    console.log('🔄 Setting up Firebase chat listener for user:', user.uid);
    setIsListenerActive(true);
    setError(null);

    try {
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const q = query(chatsRef, orderBy('lastMessageTime', 'desc'), limit(50));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isComponentMountedRef.current) return;

          console.log('📨 Firebase chat update received:', snapshot.size, 'chats');

          if (snapshot.empty) {
            console.log('📭 No chats found');
            setChats([]);
            setFilteredChats([]);
            setLoading(false);
            return;
          }

          // ✅ Process chat updates
          const updatedChats = [];
          const chatUpdates = [];

          snapshot.forEach((docSnapshot) => {
            const chatData = docSnapshot.data();
            
            const processedChat = {
              contactId: docSnapshot.id,
              ...chatData,
              lastMessageTime: chatData.lastMessageTime?.toDate?.()?.toISOString() || 
                               chatData.lastMessageTime,
              updatedAt: chatData.updatedAt?.toDate?.()?.toISOString() || 
                         chatData.updatedAt || new Date().toISOString(),
            };

            updatedChats.push(processedChat);
            chatUpdates.push(processedChat);
          });

          // ✅ Sort by last message time (most recent first)
          updatedChats.sort((a, b) => {
            const timeA = new Date(a.lastMessageTime || 0);
            const timeB = new Date(b.lastMessageTime || 0);
            return timeB - timeA;
          });

          console.log('✅ Processed chats:', updatedChats.length);

          // ✅ Update state immediately
          setChats(updatedChats);
          applySearchFilter(search, updatedChats);
          setLoading(false);

          // ✅ Update local storage asynchronously (don't block UI)
          if (chatUpdates.length > 0) {
            Promise.all(
              chatUpdates.map(chat => 
                StorageService.updateChatMetadata(chat.contactId, chat).catch(err => 
                  console.warn('Storage update failed for chat:', chat.contactId, err)
                )
              )
            ).catch(err => console.warn('Batch storage update failed:', err));
          }
        },
        (error) => {
          if (!isComponentMountedRef.current) return;

          console.error('❌ Firebase chat listener error:', error);
          setError('Connection issue - showing offline data');
          setIsListenerActive(false);
          
          // ✅ Fallback to local storage
          loadChatsFromLocal();
        }
      );

      unsubscribeRef.current = unsubscribe;
      console.log('✅ Firebase listener established');

    } catch (error) {
      console.error('❌ Error setting up Firebase listener:', error);
      setError('Failed to connect - working offline');
      setIsListenerActive(false);
      loadChatsFromLocal();
    }
  }, [user?.uid, search]);

  // ✅ Load chats from local storage
  const loadChatsFromLocal = useCallback(async () => {
    try {
      console.log('📱 Loading chats from local storage...');
      setLoading(true);
      setError(null);
      
      const localChats = await StorageService.getChats();
      
      // Sort local chats by last message time
      const sortedChats = localChats.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime || 0);
        const timeB = new Date(b.lastMessageTime || 0);
        return timeB - timeA;
      });
      
      setChats(sortedChats);
      applySearchFilter(search, sortedChats);
      
      console.log(`📱 Loaded ${sortedChats.length} chats from local storage`);
    } catch (err) {
      console.error('❌ Error loading local chats:', err);
      setError('Failed to load offline data');
      setChats([]);
      setFilteredChats([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ✅ Apply search filter
  const applySearchFilter = useCallback((searchText, chatList) => {
    if (!searchText.trim()) {
      setFilteredChats(chatList);
      return;
    }

    const lowerSearch = searchText.toLowerCase();
    const filtered = chatList.filter(chat => {
      return (
        (chat.displayName && chat.displayName.toLowerCase().includes(lowerSearch)) ||
        (chat.contactId && chat.contactId.toLowerCase().includes(lowerSearch)) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(lowerSearch))
      );
    });
    
    setFilteredChats(filtered);
  }, []);

  // ✅ Cleanup function
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      console.log('🧹 Cleaning up Firebase listener');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setIsListenerActive(false);
    }
  }, []);

  // ✅ MAIN EFFECT: Setup and cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;

    if (!user?.uid) {
      console.log('❌ No user found, clearing chats');
      setChats([]);
      setFilteredChats([]);
      setLoading(false);
      cleanup();
      return;
    }

    // Load local data first for immediate UI response
    loadChatsFromLocal();
    
    // Then setup real-time listener
    const timeoutId = setTimeout(() => {
      setupFirebaseListener();
    }, 100); // Small delay to prevent rapid listener setup

    return () => {
      isComponentMountedRef.current = false;
      clearTimeout(timeoutId);
      cleanup();
    };
  }, [user?.uid, setupFirebaseListener, loadChatsFromLocal, cleanup]);

  // ✅ Focus effect for screen refresh
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 ChatListScreen focused');
      
      if (user?.uid && !isListenerActive) {
        console.log('🔄 Reactivating listener on focus');
        setupFirebaseListener();
      }

      return () => {
        console.log('🎯 ChatListScreen unfocused');
      };
    }, [user?.uid, isListenerActive, setupFirebaseListener])
  );

  // ✅ Search effect
  useEffect(() => {
    applySearchFilter(search, chats);
  }, [search, chats, applySearchFilter]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  // ✅ Enhanced refresh handler
  const handleRefresh = useCallback(async () => {
    if (!user?.uid) return;

    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    setError(null);
    
    try {
      // Cleanup existing listener
      cleanup();
      
      // Load fresh data from Firestore
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const q = query(chatsRef, orderBy('lastMessageTime', 'desc'), limit(50));
      const snapshot = await getDocs(q);

      const freshChats = [];
      
      snapshot.forEach((docSnapshot) => {
        const chatData = docSnapshot.data();
        freshChats.push({
          contactId: docSnapshot.id,
          ...chatData,
          lastMessageTime: chatData.lastMessageTime?.toDate?.()?.toISOString() || 
                           chatData.lastMessageTime,
          updatedAt: chatData.updatedAt?.toDate?.()?.toISOString() || 
                     chatData.updatedAt || new Date().toISOString(),
        });
      });

      // Sort by last message time
      freshChats.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime || 0);
        const timeB = new Date(b.lastMessageTime || 0);
        return timeB - timeA;
      });

      // Update state
      setChats(freshChats);
      applySearchFilter(search, freshChats);
      
      // Update local storage
      await Promise.all(
        freshChats.map(chat => 
          StorageService.updateChatMetadata(chat.contactId, chat)
        )
      );
      
      // Re-setup listener
      setTimeout(() => {
        setupFirebaseListener();
      }, 100);
      
      console.log(`🔄 Refreshed ${freshChats.length} chats from Firebase`);
    } catch (err) {
      console.error('❌ Refresh chats error:', err);
      setError('Failed to refresh - check connection');
      
      // Fallback to local data
      await loadChatsFromLocal();
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, cleanup, setupFirebaseListener, loadChatsFromLocal, search, applySearchFilter]);

  // ✅ Handle chat press
  const handleChatPress = useCallback((chat) => {
    console.log('💬 Opening chat with:', chat.contactId);
    
    // Mark as read locally
    StorageService.markChatAsRead(chat.contactId).catch(err => 
      console.warn('Failed to mark chat as read:', err)
    );
    
    navigation.navigate(ROUTES.CHAT_ROOM, {
      contactId: chat.contactId,
      contactName: chat.displayName || chat.contactId,
      displayName: chat.displayName || chat.contactId,
      contactPhoto: chat.photoURL,
    });
  }, [navigation]);

  // ✅ Handle chat long press
  const handleChatLongPress = useCallback((chat) => {
    Alert.alert(
      'Chat Options',
      `Options for ${chat.displayName || chat.contactId}`,
      [
        {
          text: 'Delete Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.removeChatMessages(chat.contactId);
              // Refresh after deletion
              handleRefresh();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chat');
            }
          }
        },
        {
          text: 'Mark as Unread',
          onPress: async () => {
            try {
              await StorageService.incrementUnreadCount(chat.contactId);
              // Refresh to show updated unread count
              handleRefresh();
            } catch (error) {
              Alert.alert('Error', 'Failed to mark as unread');
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [handleRefresh]);

  // Handle add contact navigation
  const handleAddContact = useCallback(() => {
    navigation.navigate(ROUTES.CONTACT_ID_ENTRY || 'AddContact');
  }, [navigation]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearch('');
    searchInputRef.current?.blur();
  }, []);

  // Handle settings navigation
  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  // Get time ago string
  const getTimeAgo = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const now = new Date();
      const messageTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const diffMs = now - messageTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return messageTime.toLocaleDateString();
    } catch (err) {
      return '';
    }
  }, []);

  // ✅ Enhanced chat item renderer with stable keys
  const renderChatItem = useCallback(({ item, index }) => {
    const timeAgo = getTimeAgo(item.lastMessageTime);
    const isUnread = (item.unreadCount || 0) > 0;

    return (
      <TouchableOpacity
        style={[
          styles.chatItem, 
          { 
            backgroundColor: theme.background,
            borderBottomColor: theme.border + '30'
          }
        ]}
        onPress={() => handleChatPress(item)}
        onLongPress={() => handleChatLongPress(item)}
        activeOpacity={0.6}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${item.displayName || item.contactId}. Last message: ${item.lastMessage || 'No messages yet'}. ${isUnread ? `${item.unreadCount} unread messages.` : ''}`}
      >
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={[styles.avatarText, { color: theme.textOnPrimary }]}>
              {(item.displayName || item.contactId)?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          {item.isOnline && (
            <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
          )}
        </View>
        
        {/* Chat Content Section */}
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text 
              style={[
                styles.chatName, 
                { color: theme.text },
                isUnread && styles.unreadText
              ]}
              numberOfLines={1}
            >
              {item.displayName || item.contactId}
            </Text>
            <Text style={[styles.chatTime, { color: theme.textSecondary }]}>
              {timeAgo}
            </Text>
          </View>
          
          <View style={styles.messageRow}>
            <Text 
              style={[
                styles.lastMessage, 
                { color: isUnread ? theme.text : theme.textSecondary },
                isUnread && styles.unreadMessage
              ]}
              numberOfLines={1}
            >
              {item.lastMessage || 'No messages yet'}
            </Text>
            {isUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.unreadCount, { color: theme.textOnPrimary }]}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [theme, getTimeAgo, handleChatPress, handleChatLongPress]);

  // Enhanced empty state
  const renderEmptyState = useMemo(() => (
    <View style={styles.emptyState}>
      <MaterialIcons name="chat" size={64} color={theme.textSecondary + '60'} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No chats yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Start a conversation by adding a contact
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: theme.primary }]}
        onPress={handleAddContact}
        activeOpacity={0.8}
      >
        <Text style={[styles.emptyButtonText, { color: theme.textOnPrimary }]}>
          Add Contact
        </Text>
      </TouchableOpacity>
    </View>
  ), [theme, handleAddContact]);

  // ✅ Connection status indicator
  const renderConnectionStatus = useMemo(() => {
    if (isListenerActive && !error) return null;
    
    return (
      <View style={[styles.statusBar, { backgroundColor: error ? '#FF5722' : '#FF9800' }]}>
        <MaterialIcons 
          name={error ? "cloud-off" : "cloud-queue"} 
          size={16} 
          color="white" 
        />
        <Text style={styles.statusText}>
          {error ? 'Offline - Cached data' : 'Connecting...'}
        </Text>
      </View>
    );
  }, [isListenerActive, error]);

  // Show no user state
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.noUserState}>
          <MaterialIcons name="account-circle" size={80} color={theme.textSecondary} />
          <Text style={[styles.noUserText, { color: theme.text }]}>
            Please log in to view chats
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Enhanced Header */}
      <View style={[
        styles.header,
        {
          backgroundColor: theme.primary,
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
        },
      ]}>
        <StatusBar backgroundColor={theme.primary} barStyle="light-content" />
        
        <Text style={[styles.headerTitle, { color: theme.textOnPrimary }]}>
          SecureLink
        </Text>
        
        <View style={styles.headerActions}>
          {isOnline && (
            <View style={styles.onlineStatus}>
              <MaterialIcons name="wifi" size={20} color={theme.textOnPrimary + 'CC'} />
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={24}
              color={theme.textOnPrimary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSettingsPress}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={24} color={theme.textOnPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection Status */}
      {renderConnectionStatus}

      {/* Enhanced Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.surface }]}>
          <MaterialIcons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search chats..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity 
              onPress={clearSearch}
              style={styles.clearButton}
            >
              <MaterialIcons name="clear" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.error + '15' }]}>
          <MaterialIcons name="error-outline" size={18} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity 
            onPress={() => setError(null)}
            style={styles.errorClose}
          >
            <MaterialIcons name="close" size={18} color={theme.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Chat List */}
      <View style={styles.listContainer}>
        {loading && chats.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading chats...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredChats}
            renderItem={renderChatItem}
            keyExtractor={(item) => `chat_${item.contactId}`} // ✅ Stable key
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
                title="Pull to refresh"
                titleColor={theme.textSecondary}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              filteredChats.length === 0 ? { flex: 1 } : { paddingBottom: 90 }
            }
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false} // ✅ Prevent disappearing items
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            updateCellsBatchingPeriod={50}
            getItemLayout={null} // ✅ Let FlatList calculate layout
          />
        )}
      </View>

      {/* Enhanced Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#25D366' }]}
        onPress={handleAddContact}
        activeOpacity={0.8}
      >
        <MaterialIcons name="person-add" size={26} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Enhanced Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineStatus: {
    marginRight: 8,
    opacity: 0.8,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginLeft: 4,
    borderRadius: 20,
  },

  // ✅ NEW: Connection Status Bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Enhanced Search Bar
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
  },

  // Error Display
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  errorClose: {
    padding: 4,
  },

  // Chat List
  listContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },

  // WhatsApp-style Chat Item
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  
  // Chat Content Layout
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  unreadText: {
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 12,
    fontWeight: '400',
  },
  
  // Message Row
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    marginRight: 8,
  },
  unreadMessage: {
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    opacity: 0.8,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Enhanced FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  // No User State
  noUserState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noUserText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});
