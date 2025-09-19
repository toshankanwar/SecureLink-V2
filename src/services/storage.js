// services/StorageService.js - FIXED with missing setChatMessages method
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

class StorageService {
  constructor() {
    // Storage keys
    this.CONTACTS_KEY = 'user_contacts';
    this.CHATS_KEY = 'user_chats';
    this.MESSAGES_KEY_PREFIX = 'messages_';
    this.CHAT_METADATA_KEY = 'chat_metadata';
    this.USER_PROFILE_KEY = 'user_profile';
    this.THEME_KEY = 'app_theme';
    this.STORAGE_VERSION_KEY = 'storage_version';
    this.PUSH_TOKEN_KEY = 'push_token';
    this.USER_CREDENTIALS_KEY = 'user_credentials';
    
    // Configuration
    this.MAX_MESSAGES_PER_CHAT = 1000;
    this.CURRENT_STORAGE_VERSION = '2.0.0';
    this.MESSAGE_CLEANUP_THRESHOLD = 500;
    this.EXPO_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;
    
    // Initialize storage version check
    this.initializeStorage();
  }

  // ====================
  // STORAGE INITIALIZATION & MIGRATION
  // ====================

  async initializeStorage() {
    try {
      const currentVersion = await AsyncStorage.getItem(this.STORAGE_VERSION_KEY);
      
      if (!currentVersion) {
        // First time setup
        await AsyncStorage.setItem(this.STORAGE_VERSION_KEY, this.CURRENT_STORAGE_VERSION);
        console.log('🔧 Storage initialized with version:', this.CURRENT_STORAGE_VERSION);
      } else if (currentVersion !== this.CURRENT_STORAGE_VERSION) {
        // Handle migration if needed
        await this.migrateStorage(currentVersion, this.CURRENT_STORAGE_VERSION);
      }
      
      // Initialize Expo-specific storage
      await this.initializeExpoStorage();
    } catch (error) {
      console.error('Storage initialization error:', error);
    }
  }

  async initializeExpoStorage() {
    try {
      // Check if SecureStore is available
      const isSecureStoreAvailable = await SecureStore.isAvailableAsync();
      if (isSecureStoreAvailable) {
        console.log('🔐 Expo SecureStore is available');
      } else {
        console.log('⚠️ SecureStore not available, using AsyncStorage');
      }
    } catch (error) {
      console.error('Expo storage initialization error:', error);
    }
  }

  async migrateStorage(fromVersion, toVersion) {
    try {
      console.log(`📦 Migrating storage from ${fromVersion} to ${toVersion}`);
      
      // Migration logic for different versions
      if (fromVersion === '1.0.0' && toVersion === '2.0.0') {
        await this.migrateToExpoV2();
      }
      
      await AsyncStorage.setItem(this.STORAGE_VERSION_KEY, toVersion);
      console.log('✅ Migration completed successfully');
    } catch (error) {
      console.error('Storage migration error:', error);
    }
  }

  async migrateToExpoV2() {
    try {
      // Migrate any sensitive data to SecureStore if available
      const isSecureStoreAvailable = await SecureStore.isAvailableAsync();
      
      if (isSecureStoreAvailable) {
        // Move push tokens to secure storage
        const pushToken = await AsyncStorage.getItem(this.PUSH_TOKEN_KEY);
        if (pushToken) {
          await this.storeSecureData('push_token', pushToken);
          await AsyncStorage.removeItem(this.PUSH_TOKEN_KEY);
        }
      }
    } catch (error) {
      console.error('Migration to Expo v2 error:', error);
    }
  }

  // ====================
  // EXPO SECURE STORAGE
  // ====================

  async storeSecureData(key, value) {
    try {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.setItemAsync(key, value);
        return true;
      } else {
        // Fallback to AsyncStorage with a prefix
        await AsyncStorage.setItem(`secure_${key}`, value);
        return true;
      }
    } catch (error) {
      console.error(`Error storing secure data for ${key}:`, error);
      return false;
    }
  }

  async getSecureData(key) {
    try {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        return await SecureStore.getItemAsync(key);
      } else {
        // Fallback to AsyncStorage
        return await AsyncStorage.getItem(`secure_${key}`);
      }
    } catch (error) {
      console.error(`Error getting secure data for ${key}:`, error);
      return null;
    }
  }

  async removeSecureData(key) {
    try {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(`secure_${key}`);
      }
      return true;
    } catch (error) {
      console.error(`Error removing secure data for ${key}:`, error);
      return false;
    }
  }

  // ====================
  // PUSH NOTIFICATION STORAGE (EXPO SPECIFIC)
  // ====================

  async storePushToken(token) {
    try {
      const tokenData = {
        token,
        timestamp: new Date().toISOString(),
        projectId: this.EXPO_PROJECT_ID,
        platform: Constants.platform?.ios ? 'ios' : 'android'
      };
      
      await this.storeSecureData('push_token', JSON.stringify(tokenData));
      console.log('📱 Push token stored securely');
      return true;
    } catch (error) {
      console.error('Error storing push token:', error);
      return false;
    }
  }

  async getPushToken() {
    try {
      const tokenData = await this.getSecureData('push_token');
      return tokenData ? JSON.parse(tokenData) : null;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // ====================
  // VALIDATION HELPERS
  // ====================

  validateContact(contact) {
    if (!contact || typeof contact !== 'object') {
      throw new Error('Contact must be an object');
    }
    if (!contact.contactId || typeof contact.contactId !== 'string') {
      throw new Error('Contact must have a valid contactId');
    }
    return true;
  }

  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }
    if (!message.content || typeof message.content !== 'string') {
      throw new Error('Message must have content');
    }
    return true;
  }

  // ====================
  // CONTACTS MANAGEMENT
  // ====================

  async getContacts() {
    try {
      const contactsData = await AsyncStorage.getItem(this.CONTACTS_KEY);
      const contacts = contactsData ? JSON.parse(contactsData) : [];
      
      // Validate and clean contacts
      return contacts.filter(contact => {
        try {
          this.validateContact(contact);
          return true;
        } catch {
          return false;
        }
      });
    } catch (error) {
      console.error('Error getting contacts from storage:', error);
      return [];
    }
  }

  async addContact(contact) {
    try {
      this.validateContact(contact);

      const contacts = await this.getContacts();
      const existingIndex = contacts.findIndex(c => c.contactId === contact.contactId);

      const contactData = {
        contactId: contact.contactId,
        displayName: contact.displayName || contact.contactId,
        photoURL: contact.photoURL || null,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOnline: contact.isOnline || false,
        lastSeen: contact.lastSeen || null,
        ...contact
      };

      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...contactData };
      } else {
        contacts.push(contactData);
      }

      // Sort contacts by display name
      contacts.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

      await AsyncStorage.setItem(this.CONTACTS_KEY, JSON.stringify(contacts));
      console.log('👤 Contact saved locally:', contactData.contactId);
      return contactData;
    } catch (error) {
      console.error('Error adding contact to storage:', error);
      throw error;
    }
  }

  async removeContact(contactId) {
    try {
      const contacts = await this.getContacts();
      const filteredContacts = contacts.filter(c => c.contactId !== contactId);
      await AsyncStorage.setItem(this.CONTACTS_KEY, JSON.stringify(filteredContacts));
      
      // Also remove associated chat data
      await this.removeChatMessages(contactId);
      
      console.log('🗑️ Contact removed from storage:', contactId);
      return true;
    } catch (error) {
      console.error('Error removing contact from storage:', error);
      throw error;
    }
  }

  async getContact(contactId) {
    try {
      const contacts = await this.getContacts();
      return contacts.find(c => c.contactId === contactId) || null;
    } catch (error) {
      console.error('Error getting contact from storage:', error);
      return null;
    }
  }

  async searchContacts(query) {
    try {
      if (!query || typeof query !== 'string') return [];
      
      const contacts = await this.getContacts();
      const lowerQuery = query.toLowerCase();
      
      return contacts.filter(contact => {
        const displayName = (contact.displayName || '').toLowerCase();
        const contactId = (contact.contactId || '').toLowerCase();
        return displayName.includes(lowerQuery) || contactId.includes(lowerQuery);
      });
    } catch (error) {
      console.error('Error searching contacts:', error);
      return [];
    }
  }

  // ====================
  // CHAT MANAGEMENT
  // ====================

  async getChats() {
    try {
      const chatData = await AsyncStorage.getItem(this.CHAT_METADATA_KEY);
      const chats = chatData ? JSON.parse(chatData) : {};
      
      return Object.values(chats)
        .filter(chat => chat && chat.contactId)
        .sort((a, b) => {
          const timeA = new Date(a.lastMessageTime || 0).getTime();
          const timeB = new Date(b.lastMessageTime || 0).getTime();
          return timeB - timeA;
        });
    } catch (error) {
      console.error('Error getting chats from storage:', error);
      return [];
    }
  }

  async updateChatMetadata(contactId, metadata) {
    try {
      if (!contactId || typeof contactId !== 'string') {
        throw new Error('Invalid contactId');
      }

      const chatData = await AsyncStorage.getItem(this.CHAT_METADATA_KEY);
      const chats = chatData ? JSON.parse(chatData) : {};

      const existingChat = chats[contactId] || {};
      
      chats[contactId] = {
        contactId,
        displayName: metadata.displayName || existingChat.displayName || contactId,
        photoURL: metadata.photoURL || existingChat.photoURL || null,
        lastMessage: metadata.lastMessage || existingChat.lastMessage || '',
        lastMessageTime: metadata.lastMessageTime || existingChat.lastMessageTime || new Date().toISOString(),
        unreadCount: metadata.unreadCount !== undefined ? metadata.unreadCount : existingChat.unreadCount || 0,
        isOnline: metadata.isOnline !== undefined ? metadata.isOnline : existingChat.isOnline || false,
        lastSeen: metadata.lastSeen || existingChat.lastSeen || null,
        updatedAt: new Date().toISOString(),
        ...existingChat,
        ...metadata
      };

      await AsyncStorage.setItem(this.CHAT_METADATA_KEY, JSON.stringify(chats));
      return true;
    } catch (error) {
      console.error('Error updating chat metadata:', error);
      return false;
    }
  }

  async getChatMetadata(contactId) {
    try {
      const chatData = await AsyncStorage.getItem(this.CHAT_METADATA_KEY);
      const chats = chatData ? JSON.parse(chatData) : {};
      return chats[contactId] || null;
    } catch (error) {
      console.error('Error getting chat metadata:', error);
      return null;
    }
  }

  async markChatAsRead(contactId) {
    try {
      await this.updateChatMetadata(contactId, { unreadCount: 0 });
      return true;
    } catch (error) {
      console.error('Error marking chat as read:', error);
      return false;
    }
  }

  async incrementUnreadCount(contactId) {
    try {
      const metadata = await this.getChatMetadata(contactId);
      const currentCount = (metadata && metadata.unreadCount) || 0;
      await this.updateChatMetadata(contactId, { unreadCount: currentCount + 1 });
      return true;
    } catch (error) {
      console.error('Error incrementing unread count:', error);
      return false;
    }
  }

  // ====================
  // MESSAGE MANAGEMENT
  // ====================

  async getChatMessages(contactId) {
    try {
      if (!contactId) return [];
      
      const messagesData = await AsyncStorage.getItem(this.MESSAGES_KEY_PREFIX + contactId);
      const messages = messagesData ? JSON.parse(messagesData) : [];
      
      const validMessages = messages.filter(message => {
        try {
          this.validateMessage(message);
          return true;
        } catch {
          return false;
        }
      });
      
      return validMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      console.error('Error getting chat messages from storage:', error);
      return [];
    }
  }

  // ✅ FIXED: Added missing setChatMessages method
  async setChatMessages(contactId, messages) {
    try {
      if (!contactId || typeof contactId !== 'string') {
        throw new Error('Invalid contactId provided');
      }

      if (!Array.isArray(messages)) {
        throw new Error('Messages must be an array');
      }

      // Validate all messages
      const validMessages = messages.filter(message => {
        try {
          this.validateMessage(message);
          return true;
        } catch {
          console.warn('Invalid message filtered out:', message);
          return false;
        }
      });

      // Sort messages by timestamp
      validMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Trim to maximum allowed messages
      const trimmedMessages = validMessages.slice(-this.MAX_MESSAGES_PER_CHAT);

      // Save messages to storage
      await AsyncStorage.setItem(
        this.MESSAGES_KEY_PREFIX + contactId, 
        JSON.stringify(trimmedMessages)
      );

      // Update chat metadata with last message info
      if (trimmedMessages.length > 0) {
        const lastMessage = trimmedMessages[trimmedMessages.length - 1];
        await this.updateChatMetadata(contactId, {
          lastMessage: lastMessage.content,
          lastMessageTime: lastMessage.timestamp,
          displayName: lastMessage.senderDisplayName || lastMessage.displayName || contactId
        });
      }

      console.log(`💬 Set ${trimmedMessages.length} messages for contact: ${contactId}`);
      return trimmedMessages;
    } catch (error) {
      console.error('❌ Error setting chat messages:', error);
      throw error;
    }
  }

  async addChatMessage(contactId, message) {
    try {
      if (!contactId || typeof contactId !== 'string') {
        throw new Error('Invalid contactId');
      }
      
      this.validateMessage(message);

      const messages = await this.getChatMessages(contactId);
      
      const messageData = {
        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderContactId: message.senderContactId || '',
        recipientContactId: message.recipientContactId || contactId,
        content: message.content.trim(),
        timestamp: message.timestamp || new Date().toISOString(),
        messageType: message.messageType || 'text',
        status: message.status || 'sent',
        localId: message.localId || null,
        ...message
      };

      // Check for duplicate messages
      const existingMessageIndex = messages.findIndex(m => 
        m.id === messageData.id || 
        (m.content === messageData.content && 
         Math.abs(new Date(m.timestamp) - new Date(messageData.timestamp)) < 5000)
      );

      if (existingMessageIndex >= 0) {
        messages[existingMessageIndex] = { ...messages[existingMessageIndex], ...messageData };
      } else {
        messages.push(messageData);
      }

      await this.cleanupOldMessages(messages, contactId);
      await AsyncStorage.setItem(this.MESSAGES_KEY_PREFIX + contactId, JSON.stringify(messages));

      // Update chat metadata
      await this.updateChatMetadata(contactId, {
        lastMessage: messageData.content,
        lastMessageTime: messageData.timestamp,
        displayName: message.senderDisplayName || message.displayName || contactId
      });

      console.log('💬 Message saved locally for:', contactId);
      return messageData;
    } catch (error) {
      console.error('Error adding chat message to storage:', error);
      throw error;
    }
  }

  async cleanupOldMessages(messages, contactId) {
    try {
      if (messages.length > this.MAX_MESSAGES_PER_CHAT) {
        const trimmedMessages = messages
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, this.MESSAGE_CLEANUP_THRESHOLD);
        
        await AsyncStorage.setItem(
          this.MESSAGES_KEY_PREFIX + contactId, 
          JSON.stringify(trimmedMessages.reverse())
        );
        
        console.log(`🧹 Cleaned up old messages for ${contactId}: ${messages.length} -> ${trimmedMessages.length}`);
      }
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
    }
  }

  async removeChatMessages(contactId) {
    try {
      await AsyncStorage.removeItem(this.MESSAGES_KEY_PREFIX + contactId);
      
      const chatData = await AsyncStorage.getItem(this.CHAT_METADATA_KEY);
      const chats = chatData ? JSON.parse(chatData) : {};
      delete chats[contactId];
      await AsyncStorage.setItem(this.CHAT_METADATA_KEY, JSON.stringify(chats));
      
      return true;
    } catch (error) {
      console.error('Error removing chat messages:', error);
      return false;
    }
  }

  async updateMessageStatus(contactId, messageId, status) {
    try {
      const messages = await this.getChatMessages(contactId);
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex >= 0) {
        messages[messageIndex].status = status;
        messages[messageIndex].updatedAt = new Date().toISOString();
        await AsyncStorage.setItem(this.MESSAGES_KEY_PREFIX + contactId, JSON.stringify(messages));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating message status:', error);
      return false;
    }
  }

  // ====================
  // USER PROFILE MANAGEMENT
  // ====================

  async storeUserProfile(profile) {
    try {
      if (!profile || typeof profile !== 'object') {
        throw new Error('Invalid profile data');
      }

      const profileData = {
        uid: profile.uid,
        contactId: profile.contactId,
        displayName: profile.displayName || '',
        email: profile.email || '',
        photoURL: profile.photoURL || null,
        isOnline: profile.isOnline !== undefined ? profile.isOnline : true,
        lastSeen: new Date().toISOString(),
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...profile
      };

      await AsyncStorage.setItem(this.USER_PROFILE_KEY, JSON.stringify(profileData));
      console.log('👤 User profile saved locally');
      return profileData;
    } catch (error) {
      console.error('Error storing user profile:', error);
      throw error;
    }
  }

  async getUserProfile() {
    try {
      const profileData = await AsyncStorage.getItem(this.USER_PROFILE_KEY);
      return profileData ? JSON.parse(profileData) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async updateUserProfile(updates) {
    try {
      if (!updates || typeof updates !== 'object') {
        throw new Error('Invalid update data');
      }

      const currentProfile = await this.getUserProfile();
      if (!currentProfile) {
        throw new Error('No existing profile found');
      }

      const updatedProfile = {
        ...currentProfile,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem(this.USER_PROFILE_KEY, JSON.stringify(updatedProfile));
      return updatedProfile;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // ====================
  // THEME & CACHE MANAGEMENT
  // ====================

  async storeTheme(theme) {
    try {
      if (typeof theme !== 'string') {
        throw new Error('Theme must be a string');
      }
      await AsyncStorage.setItem(this.THEME_KEY, theme);
      return true;
    } catch (error) {
      console.error('Error storing theme:', error);
      return false;
    }
  }

  async getTheme() {
    try {
      return await AsyncStorage.getItem(this.THEME_KEY);
    } catch (error) {
      console.error('Error getting theme:', error);
      return null;
    }
  }

  // ====================
  // EXPO FILE SYSTEM OPERATIONS
  // ====================

  async getStorageSize() {
    try {
      const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
      return info.size || 0;
    } catch (error) {
      console.error('Error getting storage size:', error);
      return 0;
    }
  }

  async exportChatData(contactId) {
    try {
      const messages = await this.getChatMessages(contactId);
      const contact = await this.getContact(contactId);
      
      const exportData = {
        contact: contact,
        messages: messages,
        exportedAt: new Date().toISOString(),
        version: this.CURRENT_STORAGE_VERSION
      };

      const fileName = `chat_${contactId}_${Date.now()}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));
      
      console.log('📤 Chat data exported to:', fileUri);
      return fileUri;
    } catch (error) {
      console.error('Error exporting chat data:', error);
      throw error;
    }
  }

  // ====================
  // UTILITY & CLEANUP METHODS
  // ====================

  async getStorageInfo() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const values = await AsyncStorage.multiGet(keys);
      
      let totalSize = 0;
      const keyInfo = values.map(([key, value]) => {
        const size = (key.length + (value ? value.length : 0));
        totalSize += size;
        return { key, size, type: this.getKeyType(key) };
      });

      const contacts = await this.getContacts();
      const chats = await this.getChats();
      const storageSize = await this.getStorageSize();

      return {
        version: this.CURRENT_STORAGE_VERSION,
        expoProjectId: this.EXPO_PROJECT_ID,
        platform: Constants.platform,
        totalKeys: keys.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        fileSystemSize: storageSize,
        keyInfo: keyInfo.sort((a, b) => b.size - a.size),
        counts: {
          contacts: contacts.length,
          chats: chats.length,
          cache: keys.filter(k => k.startsWith('cache_')).length,
          secure: keys.filter(k => k.startsWith('secure_')).length
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }

  getKeyType(key) {
    if (key.startsWith('cache_')) return 'cache';
    if (key.startsWith('secure_')) return 'secure';
    if (key.startsWith(this.MESSAGES_KEY_PREFIX)) return 'messages';
    if (key === this.CONTACTS_KEY) return 'contacts';
    if (key === this.CHAT_METADATA_KEY) return 'chat_metadata';
    if (key === this.USER_PROFILE_KEY) return 'user_profile';
    if (key === this.THEME_KEY) return 'theme';
    return 'other';
  }

  async clearAllAppData() {
    try {
      await AsyncStorage.clear();
      
      // Also clear secure storage
      const secureKeys = ['push_token', 'user_credentials'];
      for (const key of secureKeys) {
        await this.removeSecureData(key);
      }
      
      console.log('🧹 All app data cleared from storage');
      return true;
    } catch (error) {
      console.error('Error clearing all app data:', error);
      return false;
    }
  }

  // ✅ ADDITIONAL UTILITY METHODS for better integration

  async bulkSetMessages(contactMessagesMap) {
    try {
      const results = {};
      
      for (const [contactId, messages] of Object.entries(contactMessagesMap)) {
        try {
          const savedMessages = await this.setChatMessages(contactId, messages);
          results[contactId] = {
            success: true,
            count: savedMessages.length
          };
        } catch (error) {
          results[contactId] = {
            success: false,
            error: error.message
          };
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error in bulk set messages:', error);
      throw error;
    }
  }

  async syncMessages(contactId, serverMessages) {
    try {
      const localMessages = await this.getChatMessages(contactId);
      const localMessageIds = new Set(localMessages.map(m => m.id));
      
      const newMessages = serverMessages.filter(msg => !localMessageIds.has(msg.id));
      
      if (newMessages.length > 0) {
        const allMessages = [...localMessages, ...newMessages];
        await this.setChatMessages(contactId, allMessages);
        console.log(`📥 Synced ${newMessages.length} new messages for ${contactId}`);
        return newMessages;
      }
      
      return [];
    } catch (error) {
      console.error('Error syncing messages:', error);
      throw error;
    }
  }
}

export default new StorageService();
