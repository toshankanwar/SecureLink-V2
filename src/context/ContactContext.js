// context/ContactContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  writeBatch,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import StorageService from '../services/storage';

const ContactContext = createContext();

export function ContactProvider({ children }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  
  // Refs for cleanup and preventing state updates on unmounted components
  const unsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);

  // ✅ FIXED: Main effect with proper dependencies and cleanup
  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      // Clear state when user is not authenticated
      if (isMountedRef.current) {
        setContacts([]);
        setLoading(false);
        setError(null);
      }
      cleanup();
      return;
    }

    // Initialize contacts loading
    initializeContacts();

    // Cleanup on unmount or user change
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [user?.uid]); // ✅ FIXED: Only depend on user.uid to prevent unnecessary re-runs

  // ✅ FIXED: Memoized initialization function
  const initializeContacts = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      // Load from local storage first for instant UI
      await loadContactsFromStorage();
      
      // Then setup Firebase listener for real-time sync
      setupFirebaseListener();
      
      // Setup network state monitoring
      setupNetworkListener();
      
    } catch (error) {
      console.error('❌ Error initializing contacts:', error);
      if (isMountedRef.current) {
        setError('Failed to initialize contacts');
        setLoading(false);
      }
    }
  }, []); // ✅ Empty dependency array - function doesn't depend on external values

  // ✅ FIXED: Load contacts from storage only once
  const loadContactsFromStorage = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setLoading(true);
      
      const localContacts = await StorageService.getContacts();
      
      if (isMountedRef.current) {
        setContacts(localContacts || []);
        setError(null);
        console.log(`✅ Loaded ${localContacts?.length || 0} contacts from local storage`);
      }
    } catch (err) {
      console.error('❌ Error loading contacts from storage:', err);
      if (isMountedRef.current) {
        setError('Failed to load contacts from local storage');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // ✅ No dependencies to prevent re-creation

  // ✅ FIXED: Cleanup function
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // ✅ FIXED: Network state monitoring
  const setupNetworkListener = useCallback(() => {
    const handleAppStateChange = (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        if (isMountedRef.current) {
          setIsOnline(true);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // ✅ FIXED: Firebase listener setup with proper error handling
  const setupFirebaseListener = useCallback(() => {
    if (!user?.uid || !isMountedRef.current) return;

    try {
      const contactsRef = collection(db, 'users', user.uid, 'contacts');
      const q = query(contactsRef, orderBy('addedAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          if (!isMountedRef.current) return;

          try {
            if (snapshot && !snapshot.empty) {
              const firebaseContacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                addedAt: doc.data().addedAt?.toDate?.()?.toISOString() || doc.data().addedAt,
                updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
              }));

              // Sync to local storage
              for (const contact of firebaseContacts) {
                await StorageService.addContact(contact);
              }

              // Get updated contacts from storage
              const mergedContacts = await StorageService.getContacts();
              
              if (isMountedRef.current) {
                setContacts(mergedContacts || []);
                setIsOnline(true);
                setError(null);
                console.log(`🔄 Synced ${firebaseContacts.length} contacts from Firebase`);
              }
            } else {
              // Empty snapshot
              if (isMountedRef.current) {
                setContacts([]);
                setError(null);
              }
            }
          } catch (err) {
            console.error('❌ Error processing Firebase contacts:', err);
            if (isMountedRef.current) {
              setError('Failed to sync contacts from Firebase');
              setIsOnline(false);
            }
          }
        },
        (err) => {
          console.error('🔥 Firebase listener error:', err);
          if (isMountedRef.current) {
            setError('Firebase connection failed - working offline');
            setIsOnline(false);
          }
        }
      );

      unsubscribeRef.current = unsubscribe;

    } catch (error) {
      console.error('❌ Error setting up Firebase listener:', error);
      if (isMountedRef.current) {
        setError('Failed to connect to Firebase - working offline');
        setIsOnline(false);
      }
    }
  }, [user?.uid]); // ✅ Only depend on user.uid

  // ✅ FIXED: Add contact with proper error handling
  const addContact = useCallback(async (contactId, displayName) => {
    try {
      setLoading(true);
      setError(null);

      if (!contactId || !displayName) {
        throw new Error('Contact ID and display name are required');
      }

      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      const cleanContactId = contactId.trim();
      const cleanDisplayName = displayName.trim();

      // Check for existing contact
      const existingContact = contacts.find(c => c.contactId === cleanContactId);
      if (existingContact) {
        throw new Error('Contact already exists');
      }

      const contactData = {
        contactId: cleanContactId,
        displayName: cleanDisplayName,
        addedAt: new Date().toISOString(),
        photoURL: null,
        isOnline: false,
        lastSeen: null,
      };

      // Add to Firebase first (if online)
      try {
        const contactRef = doc(db, 'users', user.uid, 'contacts', cleanContactId);
        await setDoc(contactRef, {
          ...contactData,
          addedAt: serverTimestamp(),
        });
        
        console.log('✅ Contact added to Firebase:', cleanContactId);
        if (isMountedRef.current) {
          setIsOnline(true);
        }
      } catch (firebaseError) {
        console.warn('⚠️ Failed to add to Firebase (offline?):', firebaseError.message);
        if (isMountedRef.current) {
          setIsOnline(false);
        }
      }

      // Add to local storage
      await StorageService.addContact(contactData);

      // Update local state immediately
      if (isMountedRef.current) {
        setContacts(prev => {
          const updated = prev.filter(c => c.contactId !== cleanContactId);
          return [...updated, contactData].sort((a, b) => 
            new Date(b.addedAt) - new Date(a.addedAt)
          );
        });
      }

      console.log('👤 Contact added successfully:', cleanContactId);
      return contactData;
    } catch (err) {
      console.error('❌ Error adding contact:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contacts, user?.uid]);

  // ✅ FIXED: Remove contact
  const removeContact = useCallback(async (contactId) => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.uid || !contactId) {
        throw new Error('Invalid parameters for contact removal');
      }

      // Remove from Firebase first (if online)
      try {
        const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
        await deleteDoc(contactRef);
        
        console.log('🗑️ Contact removed from Firebase:', contactId);
        if (isMountedRef.current) {
          setIsOnline(true);
        }
      } catch (firebaseError) {
        console.warn('⚠️ Failed to remove from Firebase (offline?):', firebaseError.message);
        if (isMountedRef.current) {
          setIsOnline(false);
        }
      }

      // Remove from local storage
      await StorageService.removeContact(contactId);

      // Update local state
      if (isMountedRef.current) {
        setContacts(prev => prev.filter(c => c.contactId !== contactId));
      }

      console.log('✅ Contact removed successfully:', contactId);
      return true;
    } catch (err) {
      console.error('❌ Error removing contact:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.uid]);

  // ✅ FIXED: Update contact
  const updateContact = useCallback(async (contactId, updates) => {
    try {
      if (!user?.uid || !contactId) {
        throw new Error('Invalid parameters for contact update');
      }

      const updateData = {
        ...updates,
        contactId,
        updatedAt: new Date().toISOString(),
      };

      // Update in Firebase
      try {
        const contactRef = doc(db, 'users', user.uid, 'contacts', contactId);
        await updateDoc(contactRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        
        console.log('📝 Contact updated in Firebase:', contactId);
        if (isMountedRef.current) {
          setIsOnline(true);
        }
      } catch (firebaseError) {
        console.warn('⚠️ Failed to update in Firebase:', firebaseError.message);
        if (isMountedRef.current) {
          setIsOnline(false);
        }
      }

      // Update in local storage
      const existingContact = await StorageService.getContact(contactId);
      if (existingContact) {
        const merged = { ...existingContact, ...updateData };
        await StorageService.addContact(merged);

        // Update local state
        if (isMountedRef.current) {
          setContacts(prev => prev.map(c => 
            c.contactId === contactId ? merged : c
          ));
        }
      }

      return true;
    } catch (err) {
      console.error('❌ Error updating contact:', err);
      throw err;
    }
  }, [user?.uid]);

  // ✅ FIXED: Search contacts (local operation)
  const searchContacts = useCallback((searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) {
      return contacts;
    }

    const query = searchQuery.toLowerCase().trim();
    return contacts.filter(contact => {
      const displayName = contact.displayName?.toLowerCase() || '';
      const contactId = contact.contactId?.toLowerCase() || '';
      
      return displayName.includes(query) || contactId.includes(query);
    });
  }, [contacts]);

  // ✅ FIXED: Get single contact
  const getContact = useCallback((contactId) => {
    return contacts.find(c => c.contactId === contactId) || null;
  }, [contacts]);

  // ✅ FIXED: Refresh contacts
  const refreshContacts = useCallback(async () => {
    await loadContactsFromStorage();
  }, [loadContactsFromStorage]);

  // ✅ FIXED: Clear all contacts
  const clearAllContacts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Clear from Firebase using batch (if online)
      if (user?.uid && isOnline) {
        try {
          const contactsRef = collection(db, 'users', user.uid, 'contacts');
          const snapshot = await getDocs(contactsRef);
          
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            
            snapshot.docs.forEach(docSnapshot => {
              batch.delete(docSnapshot.ref);
            });
            
            await batch.commit();
            console.log('🧹 All contacts cleared from Firebase');
          }
          
          if (isMountedRef.current) {
            setIsOnline(true);
          }
        } catch (firebaseError) {
          console.warn('⚠️ Failed to clear from Firebase:', firebaseError.message);
          if (isMountedRef.current) {
            setIsOnline(false);
          }
        }
      }

      // Clear from local storage
      await StorageService.clearAllContactData();

      // Clear local state
      if (isMountedRef.current) {
        setContacts([]);
      }
      
      console.log('✅ All contacts cleared successfully');
      return true;
    } catch (err) {
      console.error('❌ Error clearing contacts:', err);
      throw err;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.uid, isOnline]);

  // ✅ FIXED: Clear error
  const clearError = useCallback(() => {
    if (isMountedRef.current) {
      setError(null);
    }
  }, []);

  // ✅ FIXED: Get contact stats
  const getContactStats = useCallback(() => {
    return {
      totalContacts: contacts.length,
      onlineContacts: contacts.filter(c => c.isOnline).length,
      isOnline,
      lastSynced: new Date().toISOString(),
    };
  }, [contacts, isOnline]);

  // ✅ FIXED: Context value with memoized functions
  const contextValue = {
    // State
    contacts,
    loading,
    error,
    isOnline,
    
    // Actions
    addContact,
    removeContact,
    updateContact,
    searchContacts,
    getContact,
    refreshContacts,
    clearAllContacts,
    clearError,
    getContactStats,
  };

  return (
    <ContactContext.Provider value={contextValue}>
      {children}
    </ContactContext.Provider>
  );
}

export const useContacts = () => {
  const context = useContext(ContactContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactProvider');
  }
  return context;
};

export default ContactContext;
