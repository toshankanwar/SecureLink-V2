// screens/contacts/AddContactScreen.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

// Context imports
import { useTheme } from '../../context/ThemeContext';
import { useContacts } from '../../context/ContactContext';
import { useAuth } from '../../context/AuthContext';

// Firebase Web SDK imports
import { collection, query, where, getDocs, doc, getDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';

// Components and styles
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { typography } from '../../styles/typography';
import StorageService from '../../services/storage';
import { ROUTES } from '../../utils/constants';

const { height: screenHeight } = Dimensions.get('window');

export default function AddContactScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { 
    contacts, 
    loading: contactsLoading, 
    error: contactsError,
    addContact, 
    removeContact, 
    refreshContacts,
  } = useContacts();
  const insets = useSafeAreaInsets();

  // Form state
  const [contactId, setContactId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  // UI state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Refs
  const contactIdRef = useRef(null);
  const displayNameRef = useRef(null);
  const scrollViewRef = useRef(null);

  // ✅ Enhanced keyboard listeners with height tracking
  useEffect(() => {
    const keyboardDidShow = (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
      // Scroll to top when keyboard opens
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    };

    const keyboardDidHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showListener = Keyboard.addListener('keyboardDidShow', keyboardDidShow);
    const hideListener = Keyboard.addListener('keyboardDidHide', keyboardDidHide);

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Focus effect to refresh contacts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        refreshContacts();
      }
    }, [user, refreshContacts])
  );

  // Clear error when component mounts
  useEffect(() => {
    setError('');
  }, []);

  // ✅ Validate contactId (10-digit numeric)
  const validateContactId = useCallback((contactId) => {
    const errors = {};
    
    if (!contactId || !contactId.trim()) {
      errors.contactId = 'Contact ID is required';
    } else {
      const cleanId = contactId.trim();
      
      if (!/^\d{10}$/.test(cleanId)) {
        errors.contactId = 'Contact ID must be exactly 10 digits';
      } else if (cleanId.startsWith('0')) {
        errors.contactId = 'Contact ID cannot start with 0';
      }
    }
    
    return errors;
  }, []);

  // ✅ ENHANCED: Robust findUserByContactId function (keeping original logic)
  const findUserByContactId = useCallback(async (contactIdToFind, maxRetries = 3) => {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Attempt ${attempt}/${maxRetries} - Searching for user:`, contactIdToFind);
        
        if (!contactIdToFind) {
          throw new Error('Contact ID is required');
        }
        
        if (typeof contactIdToFind !== 'string') {
          throw new Error('Contact ID must be a string');
        }
        
        const cleanId = contactIdToFind.trim();
        
        if (!cleanId) {
          throw new Error('Contact ID cannot be empty');
        }
        
        if (!db) {
          throw new Error('Database connection not available');
        }

        let userData = null;
        let searchMethod = '';

        // Method 1: Search by 10-digit contactId
        if (/^\d{10}$/.test(cleanId)) {
          console.log('🔢 Searching by 10-digit contactId:', cleanId);
          searchMethod = 'contactId';
          
          try {
            const q = query(
              collection(db, 'users'),
              where('contactId', '==', cleanId),
              limit(1)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              userData = querySnapshot.docs[0].data();
              console.log('✅ User found by contactId:', userData?.uid);
            } else {
              console.log('⚠️ No user found with contactId:', cleanId);
            }
          } catch (contactIdError) {
            console.error('❌ Error searching by contactId:', contactIdError);
            
            if (contactIdError.code === 'permission-denied') {
              throw new Error('Access denied. Please check your permissions and try again.');
            }
            
            if (contactIdError.code === 'unavailable') {
              throw new Error('Service temporarily unavailable. Please check your connection.');
            }
            
            console.log('🔄 Continuing to UID search due to contactId error');
          }
        }

        // Method 2: Search by UID (fallback)
        if (!userData && cleanId.length > 10) {
          console.log('🆔 Searching by UID:', cleanId);
          searchMethod = 'uid';
          
          try {
            const userDocRef = doc(db, 'users', cleanId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              userData = userDoc.data();
              console.log('✅ User found by UID:', userData?.uid);
            } else {
              console.log('⚠️ No user found with UID:', cleanId);
            }
          } catch (uidError) {
            console.error('❌ Error searching by UID:', uidError);
            
            if (uidError.code === 'permission-denied') {
              throw new Error('Access denied. Please check your permissions and try again.');
            }
          }
        }

        if (!userData) {
          throw new Error(`User with Contact ID "${cleanId}" does not exist. Please verify the Contact ID and try again.`);
        }

        if (!userData.uid) {
          console.error('❌ User data missing UID:', userData);
          throw new Error('Invalid user data found. Please try again.');
        }

        // Build safe user object with fallbacks
        const safeUserData = {
          uid: userData.uid,
          contactId: userData.contactId || cleanId,
          displayName: userData.displayName || 'Unknown User',
          email: userData.email || '',
          about: userData.about || 'Hey there! I am using SecureLink.',
          createdAt: userData.createdAt || null,
          lastSeen: null,
          isOnline: false,
          photoURL: null,
        };

        // Safely handle privacy settings
        try {
          if (userData.settings && typeof userData.settings === 'object') {
            safeUserData.photoURL = userData.settings.profilePhotoVisible !== false 
              ? (userData.photoURL || null) 
              : null;
              
            safeUserData.lastSeen = userData.settings.lastSeenVisible !== false 
              ? (userData.lastSeen || null) 
              : null;
              
            safeUserData.isOnline = userData.settings.onlineStatusVisible !== false 
              ? (userData.isOnline || false) 
              : false;
          } else {
            safeUserData.photoURL = userData.photoURL || null;
            safeUserData.lastSeen = userData.lastSeen || null;
            safeUserData.isOnline = userData.isOnline || false;
          }
        } catch (privacyError) {
          console.warn('⚠️ Error processing privacy settings:', privacyError);
        }

        console.log(`✅ User successfully found via ${searchMethod} on attempt ${attempt}`);
        return safeUserData;

      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (error.message.includes('does not exist') || 
            error.message.includes('Access denied') ||
            error.message.includes('required') ||
            error.message.includes('must be')) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError || new Error('Failed to find user after multiple attempts. Please try again.');
  }, []);

  // ✅ UPDATED: Add contact handler (keeping original logic)
  const handleAddContact = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert('Authentication Error', 'Please log in to add contacts');
      return;
    }

    try {
      setError('');
      
      const contactIdErrors = validateContactId(contactId);
      if (Object.keys(contactIdErrors).length > 0) {
        setError(contactIdErrors.contactId);
        return;
      }

      if (!displayName.trim()) {
        setError('Display name is required');
        return;
      }

      const existingContact = contacts.find(c => 
        c.contactId === contactId.trim()
      );
      if (existingContact) {
        Alert.alert('Duplicate Contact', 'This contact is already in your contact list.');
        return;
      }

      if (user.contactId && user.contactId === contactId.trim()) {
        Alert.alert('Invalid Contact', 'You cannot add yourself as a contact.');
        return;
      }

      setAdding(true);
      Keyboard.dismiss();

      console.log('🔄 Starting contact addition process...');

      const userData = await findUserByContactId(contactId.trim());
      
      if (!userData) {
        Alert.alert('User Not Found', 'No user found with this Contact ID. Please verify the ID and try again.');
        return;
      }

      const newContact = {
        contactId: userData.contactId || contactId.trim(),
        uid: userData.uid,
        displayName: displayName.trim(),
        email: userData.email || '',
        photoURL: userData.photoURL || null,
        about: userData.about || '',
        addedAt: serverTimestamp(),
        isOnline: userData.isOnline || false,
        lastSeen: userData.lastSeen || null,
      };

      console.log('✅ Adding contact to context:', newContact.displayName);

      await addContact(newContact.contactId, newContact.displayName, newContact);

      Alert.alert(
        'Contact Added! 🎉',
        `${newContact.displayName} has been added to your contacts.`,
        [
          {
            text: 'Start Chat',
            onPress: () => {
              navigation.navigate(ROUTES.CHAT_ROOM, {
                contactId: newContact.contactId,
                contactName: newContact.displayName,
                displayName: newContact.displayName,
                contactPhoto: newContact.photoURL,
              });
            }
          },
          { 
            text: 'Add Another', 
            onPress: () => {
              setContactId('');
              setDisplayName('');
              setTimeout(() => contactIdRef.current?.focus(), 100);
            }
          },
          { text: 'Done' }
        ]
      );

      setContactId('');
      setDisplayName('');

    } catch (err) {
      console.error('❌ Add contact error:', err);
      const errorMessage = err.message || 'Failed to add contact. Please try again.';
      setError(errorMessage);
      Alert.alert('Add Contact Failed', errorMessage);
    } finally {
      setAdding(false);
    }
  }, [user, contactId, displayName, contacts, validateContactId, findUserByContactId, addContact, navigation]);

  // Contact interaction handlers (keeping original logic)
  const handleContactPress = useCallback((contact) => {
    navigation.navigate(ROUTES.CHAT_ROOM, {
      contactId: contact.contactId,
      contactName: contact.displayName,
      displayName: contact.displayName,
      contactPhoto: contact.photoURL,
    });
  }, [navigation]);

  const handleContactLongPress = useCallback((contact) => {
    Alert.alert(
      contact.displayName,
      `Contact ID: ${contact.contactId}`,
      [
        {
          text: 'Start Chat',
          onPress: () => handleContactPress(contact)
        },
        {
          text: 'Edit Name',
          onPress: () => handleEditContactName(contact)
        },
        {
          text: 'Remove Contact',
          onPress: () => confirmRemoveContact(contact),
          style: 'destructive',
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [handleContactPress]);

  const handleEditContactName = useCallback((contact) => {
    Alert.prompt(
      'Edit Contact Name',
      'Enter a new name for this contact:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Save', 
          onPress: async (newName) => {
            if (newName && newName.trim() && newName.trim() !== contact.displayName) {
              try {
                await addContact(contact.contactId, newName.trim(), {
                  ...contact,
                  displayName: newName.trim()
                });
                Alert.alert('Success', 'Contact name updated successfully!');
              } catch (error) {
                Alert.alert('Error', 'Failed to update contact name.');
              }
            }
          }
        }
      ],
      'plain-text',
      contact.displayName
    );
  }, [addContact]);

  const confirmRemoveContact = useCallback((contact) => {
    Alert.alert(
      'Remove Contact',
      `Are you sure you want to remove ${contact.displayName} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            try {
              await removeContact(contact.contactId);
              Alert.alert('Contact Removed', `${contact.displayName} has been removed from your contacts.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove contact. Please try again.');
            }
          },
          style: 'destructive',
        },
      ],
    );
  }, [removeContact]);

  // Handle numeric input for contactId
  const handleContactIdChange = useCallback((text) => {
    const numericText = text.replace(/[^0-9]/g, '').slice(0, 10);
    setContactId(numericText);
    setError('');
  }, []);

  // Focus next input
  const focusDisplayName = useCallback(() => {
    displayNameRef.current?.focus();
  }, []);

  // ✅ Enhanced contact item renderer with better styling
  const renderContactItem = useCallback(({ item, index }) => (
    <TouchableOpacity
      style={[
        styles.contactItem, 
        { 
          backgroundColor: theme.surface,
          borderBottomWidth: index === contacts.length - 1 ? 0 : 1,
          borderBottomColor: theme.border + '30',
        }
      ]}
      onPress={() => handleContactPress(item)}
      onLongPress={() => handleContactLongPress(item)}
      activeOpacity={0.6}
    >
      <View style={[styles.contactAvatar, { backgroundColor: theme.primary }]}>
        <Text style={[styles.contactAvatarText, { color: theme.textOnPrimary }]}>
          {item.displayName?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>
      
      <View style={styles.contactDetails}>
        <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
          {item.displayName || 'Unknown'}
        </Text>
        <Text style={[styles.contactIdText, { color: theme.textSecondary }]}>
          {item.contactId}
        </Text>
        {item.about && (
          <Text style={[styles.contactAbout, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.about}
          </Text>
        )}
      </View>
      
      <View style={styles.contactStatus}>
        {item.isOnline && (
          <View style={[styles.onlineIndicator, { backgroundColor: '#10B981' }]} />
        )}
        <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
      </View>
    </TouchableOpacity>
  ), [theme, handleContactPress, handleContactLongPress, contacts.length]);

  // Show login prompt if no user
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.noUserContainer}>
          <MaterialIcons name="account-circle" size={64} color={theme.textSecondary} />
          <Text style={[styles.noUserText, { color: theme.text }]}>
            Please log in to manage contacts
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardVisible ? keyboardHeight + 20 : 20 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ✅ Compact Add Contact Form */}
          <View style={[styles.addContactCard, { backgroundColor: theme.surface }]}>
            {/* Error Display */}
            {(error || contactsError) && (
              <View style={[styles.errorBanner, { backgroundColor: theme.error + '15' }]}>
                <MaterialIcons name="error-outline" size={18} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {error || contactsError}
                </Text>
                <TouchableOpacity onPress={() => setError('')} style={styles.errorClose}>
                  <MaterialIcons name="close" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
            )}
            
            {/* Input Fields */}
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact ID</Text>
                <TextInput
                  ref={contactIdRef}
                  style={[styles.compactInput, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text 
                  }]}
                  placeholder="10-digit ID"
                  placeholderTextColor={theme.textSecondary}
                  value={contactId}
                  onChangeText={handleContactIdChange}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="next"
                  onSubmitEditing={focusDisplayName}
                  editable={!adding}
                />
              </View>
              
              <View style={[styles.inputContainer, { marginLeft: 12 }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Display Name</Text>
                <TextInput
                  ref={displayNameRef}
                  style={[styles.compactInput, { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text 
                  }]}
                  placeholder="Enter name"
                  placeholderTextColor={theme.textSecondary}
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text);
                    setError('');
                  }}
                  maxLength={50}
                  returnKeyType="done"
                  onSubmitEditing={handleAddContact}
                  editable={!adding}
                />
              </View>
            </View>
            
            {/* Add Button */}
            <TouchableOpacity
              style={[
                styles.addButton,
                { 
                  backgroundColor: theme.primary,
                  opacity: (!contactId.trim() || !displayName.trim() || adding) ? 0.6 : 1
                }
              ]}
              onPress={handleAddContact}
              disabled={!contactId.trim() || !displayName.trim() || adding}
              activeOpacity={0.8}
            >
              {adding && (
                <MaterialIcons name="hourglass-empty" size={18} color={theme.textOnPrimary} style={{ marginRight: 8 }} />
              )}
              <Text style={[styles.addButtonText, { color: theme.textOnPrimary }]}>
                {adding ? 'Adding...' : 'Add Contact'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ✅ Contact List Section */}
          <View style={styles.contactsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Your Contacts
              </Text>
              <Text style={[styles.contactCount, { color: theme.textSecondary }]}>
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              </Text>
            </View>
            
            {contacts.length > 0 ? (
              <View style={[styles.contactsList, { backgroundColor: theme.surface }]}>
                {contacts.map((contact, index) => renderContactItem({ item: contact, index }))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="contacts" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No contacts yet
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                  Add friends using their Contact ID
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  noUserContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noUserText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // ✅ Compact Add Contact Form
  addContactCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
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
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactInput: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // ✅ Professional Contact List
  contactsSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  contactCount: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
  contactsList: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactDetails: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  contactIdText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    opacity: 0.8,
  },
  contactAbout: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  contactStatus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  
  // ✅ Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});
