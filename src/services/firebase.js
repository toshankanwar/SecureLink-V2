// services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail,
  updatePassword,
  onAuthStateChanged,
  reload
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB3Cn8ex2Xw2RDQmGhh6AlARDf8VX8kiHc",
  authDomain: "link-toshan-kanwar.firebaseapp.com",
  projectId: "link-toshan-kanwar",
  storageBucket: "link-toshan-kanwar.firebasestorage.app",
  messagingSenderId: "896317303681",
  appId: "1:896317303681:web:db7ff87bdb80abb3969680",
  measurementId: "G-6QPKDGNXJS"
};

// ✅ Initialize Firebase app only if none exists
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Initialize Auth with persistence, handle multiple initialization attempts
let auth;
try {
  // Try to initialize Auth with AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Firebase Auth initialized with persistence');
} catch (error) {
  // If already initialized, get the existing Auth instance
  if (error.code === 'auth/already-initialized') {
    console.log('⚠️ Firebase Auth already initialized, using existing instance');
    auth = getAuth(app);
  } else {
    console.error('❌ Firebase Auth initialization error:', error);
    throw error;
  }
}

// Initialize Firestore
const db = getFirestore(app);

class FirebaseService {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.currentUser = null;
  }

  // Generate unique Contact ID
// ✅ FIXED: Enhanced generateUniqueContactId with better fallback
// ✅ UPDATED: Generate pure 10-digit numeric contactId
async generateUniqueContactId() {
  let contactId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // ✅ Generate 10-digit number that NEVER starts with 0
    // Range: 1000000000 to 9999999999 (starts with 1-9, never 0)
    contactId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    // ✅ Additional safety check - ensure first digit is not 0
    if (contactId.charAt(0) === '0') {
      console.log('⚠️ Generated ID starts with 0, regenerating...');
      continue; // Skip this iteration, generate new ID
    }
    
    try {
      // Check uniqueness in Firestore
      const q = query(
        collection(this.db, 'users'),
        where('contactId', '==', contactId)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        isUnique = true;
        console.log('✅ Unique 10-digit contactId generated (no leading zero):', contactId);
      } else {
        console.log('⚠️ ContactId exists, trying another:', contactId);
      }
    } catch (error) {
      console.error('❌ Error checking contactId uniqueness:', error);
      
      // Fallback: generate highly unique 10-digit ID (no leading zero)
      if (error.code === 'permission-denied' || error.message.includes('permission')) {
        console.log('🔄 Using fallback 10-digit contactId generation (no leading zero)');
        
        // Create unique 10-digit number using timestamp + random (ensures no leading zero)
        const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
        const randomPart = Math.floor(100000 + Math.random() * 900000).toString(); // 6 random digits (100000-999999)
        contactId = '1' + timestamp + randomPart.slice(0, 5); // Start with '1' + 4 + 5 = 10 digits
        
        console.log('✅ Fallback 10-digit contactId generated (no leading zero):', contactId);
        return contactId;
      }
    }
    
    attempts++;
  }
  
  if (!isUnique) {
    // Final fallback - guaranteed 10-digit unique ID (no leading zero)
    const timestamp = Date.now().toString().slice(-4); // Last 4 digits
    const randomPart = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    contactId = '1' + timestamp + randomPart.slice(0, 5); // Always starts with '1'
    
    console.log('🆔 Final fallback 10-digit contactId (no leading zero):', contactId);
  }
  
  return contactId;
}

  // Create user profile in Firestore
  async createUserProfile(user, contactId, photoURL = null) {
    try {
      const profileData = {
        uid: user.uid,
        contactId: contactId,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: photoURL || this.getCloudinaryPhotoUrl(contactId),
        about: 'Hey there! I am using SecureLink.',
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        lastLogin: serverTimestamp(),
        isOnline: true,
        deviceInfo: {
          lastDevice: 'mobile',
          appVersion: '1.0.0',
          platform: 'expo',
        },
        settings: {
          profilePhotoVisible: true,
          lastSeenVisible: true,
          onlineStatusVisible: true,
          readReceiptsEnabled: true,
          notificationsEnabled: true,
        },
        privacy: {
          whoCanSeeProfile: 'everyone',
          whoCanAddMe: 'everyone',
          whoCanSeeLastSeen: 'everyone',
        }
      };
      
      await setDoc(doc(this.db, 'users', user.uid), profileData);
      console.log('✅ User profile created successfully');
      return profileData;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  // Get Cloudinary photo URL
  getCloudinaryPhotoUrl(contactId, transformation = 'w_400,h_400,c_fill,f_auto,q_auto') {
    return `https://res.cloudinary.com/drlxxyu9o/image/upload/${transformation}/securelink/profile_pictures/profile_${contactId}.jpg`;
  }

  // Find user by contact ID
// In your ContactContext or search function

// ✅ UPDATED: Find user by 10-digit numeric contactId
async findUserByContactId(contactId) {
  try {
    // ✅ Validate 10-digit numeric format
    if (!contactId || typeof contactId !== 'string') {
      return null;
    }
    
    const cleanId = contactId.trim();
    
    // Must be exactly 10 digits
    if (!/^\d{10}$/.test(cleanId)) {
      console.log('❌ Invalid contactId format. Must be 10 digits:', cleanId);
      return null;
    }
    
    const q = query(
      collection(this.db, 'users'),
      where('contactId', '==', cleanId)
    );
    const querySnapshot = await getDocs(q);
      
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      
      return {
        uid: userData.uid,
        contactId: userData.contactId,
        displayName: userData.displayName,
        photoURL: userData.settings?.profilePhotoVisible ? userData.photoURL : null,
        about: userData.about || 'Hey there! I am using SecureLink.',
        lastSeen: userData.settings?.lastSeenVisible ? userData.lastSeen : null,
        isOnline: userData.settings?.onlineStatusVisible ? userData.isOnline : false,
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error finding user by contactId:', error);
    return null;
  }
}

  // Update user profile
 // services/firebase.js - Add this method to your FirebaseService class

// ✅ FIXED: Safe token saving that handles missing documents
async saveUserToken(userId, token, deviceInfo = {}) {
  try {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }

    const userRef = doc(this.db, 'users', userId);
    
    // Check if user document exists
    const docSnap = await getDoc(userRef);
    
    const tokenData = {
      fcmToken: token,
      tokenUpdatedAt: serverTimestamp(),
      deviceInfo: {
        platform: deviceInfo.platform || 'unknown',
        deviceName: deviceInfo.deviceName || 'unknown',
        appVersion: deviceInfo.appVersion || '1.0.0',
        ...deviceInfo
      },
      lastTokenUpdate: new Date().toISOString()
    };

    if (docSnap.exists()) {
      // Document exists, safe to merge update
      await setDoc(userRef, tokenData, { merge: true });
      console.log('✅ Token updated in existing user document');
    } else {
      // Document doesn't exist, create it with token
      await setDoc(userRef, {
        uid: userId,
        ...tokenData,
        createdAt: serverTimestamp(),
      });
      console.log('✅ Token saved in new user document');
    }

    return true;
  } catch (error) {
    console.error('❌ Error saving user token:', error);
    
    // Fallback approach - always use setDoc with merge
    try {
      const userRef = doc(this.db, 'users', userId);
      await setDoc(userRef, {
        uid: userId,
        fcmToken: token,
        tokenUpdatedAt: serverTimestamp(),
        lastFallbackUpdate: new Date().toISOString()
      }, { merge: true });
      
      console.log('✅ Token saved using fallback method');
      return true;
    } catch (fallbackError) {
      console.error('❌ Fallback token save also failed:', fallbackError);
      return false;
    }
  }
}

// ✅ FIXED: Safe user profile updates
async updateUserProfile(uid, updates) {
  try {
    if (!uid) {
      console.log('❌ No UID provided for profile update');
      return false;
    }

    const userRef = doc(this.db, 'users', uid);
    
    // Always use setDoc with merge to avoid "no document to update" error
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, updateData, { merge: true });
    console.log('✅ User profile updated successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    return false;
  }
}


  // Get current user profile from Firestore
  async getCurrentUserProfile() {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        console.log('❌ No authenticated user found');
        return null;
      }
      
      const userRef = doc(this.db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        console.log('✅ User profile loaded successfully');
        return { id: userDoc.id, ...userDoc.data() };
      } else {
        // ✅ FIX: Create basic profile if it doesn't exist
        console.log('⚠️ User profile does not exist, will be created on next update');
        return {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          emailVerified: user.emailVerified || false,
          // Basic profile that will be enhanced when first updated
        };
      }
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      return null;
    }
  }
  
  // Sign up with email
  async signUpWithEmail(email, password, displayName) {
    try {
      // Validate inputs
      if (!email || !password || !displayName) {
        throw new Error('Email, password, and display name are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      console.log('✅ User created successfully:', userCredential.user.uid);

      // Update Firebase Auth profile
      await updateProfile(userCredential.user, { displayName });
      await reload(userCredential.user);
      const updatedUser = this.auth.currentUser;

      // Generate unique contact ID
      const contactId = await this.generateUniqueContactId();

      // Create user profile in Firestore
      const profileData = await this.createUserProfile({
        uid: updatedUser.uid,
        displayName,
        email: updatedUser.email,
        photoURL: updatedUser.photoURL,
      }, contactId);
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      console.log('✅ Email verification sent');

      // Store registration success in AsyncStorage
      await AsyncStorage.setItem('lastRegistration', JSON.stringify({
        uid: updatedUser.uid,
        email: updatedUser.email,
        timestamp: new Date().toISOString()
      }));

      return {
        user: updatedUser,
        contactId,
        profileData,
        needsEmailVerification: true,
      };
    } catch (error) {
      console.error('❌ Sign up error:', error);
      throw this.handleFirebaseError(error);
    }
  }

  // Sign in with email
  async signInWithEmail(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
  
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('✅ User signed in successfully:', userCredential.user.uid);
      
      // ✅ FIX: Update user online status safely (won't fail if document doesn't exist)
      if (userCredential.user) {
        // Use the fixed updateUserProfile method that handles missing documents
        await this.updateUserProfile(userCredential.user.uid, {
          isOnline: true,
          lastLogin: serverTimestamp(),
          lastSeen: serverTimestamp(),
        });
      }
  
      // Store login success in AsyncStorage
      await AsyncStorage.setItem('lastLogin', JSON.stringify({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        timestamp: new Date().toISOString()
      }));
      
      return {
        user: userCredential.user,
        needsEmailVerification: !userCredential.user.emailVerified,
      };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw this.handleFirebaseError(error);
    }
  }
  // Sign out
  async signOut() {
    try {
      const user = this.auth.currentUser;
      
      if (user) {
        // ✅ FIX: Use the fixed updateUserProfile method
        await this.updateUserProfile(user.uid, {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });
      }
  
      await signOut(this.auth);
      
      // Clear stored session data
      await AsyncStorage.multiRemove(['lastLogin', 'userPreferences', 'cachedProfile']);
      
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      // Don't throw error to allow sign out to continue
    }
  }

  // Send password reset
  async sendPasswordReset(email) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      await sendPasswordResetEmail(this.auth, email);
      console.log('✅ Password reset email sent');
    } catch (error) {
      console.error('❌ Password reset error:', error);
      throw this.handleFirebaseError(error);
    }
  }

  // Send email verification
  async sendEmailVerification() {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      if (user.emailVerified) {
        throw new Error('Email is already verified');
      }

      await sendEmailVerification(user);
      console.log('✅ Email verification sent');
    } catch (error) {
      console.error('❌ Email verification error:', error);
      throw this.handleFirebaseError(error);
    }
  }

  // Reload user
  async reloadUser() {
    try {
      const user = this.auth.currentUser;
      if (user) {
        await reload(user);
        console.log('✅ User data reloaded');
        return this.auth.currentUser;
      }
      return null;
    } catch (error) {
      console.error('❌ User reload error:', error);
      throw this.handleFirebaseError(error);
    }
  }

  // Update profile
  async updateProfile(updates) {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      await updateProfile(user, updates);
      console.log('✅ Profile updated successfully');
      return this.auth.currentUser;
    } catch (error) {
      console.error('❌ Profile update error:', error);
      throw this.handleFirebaseError(error);
    }
  }

  // Auth state listener
  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        // Store user session data
        await AsyncStorage.setItem('currentUser', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          photoURL: user.photoURL,
          lastLoginCheck: new Date().toISOString()
        }));
      } else {
        // Clear user session data
        await AsyncStorage.removeItem('currentUser');
      }
      
      callback(user);
    });
  }

  // Get current user
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // Handle Firebase errors
  handleFirebaseError(error) {
    const code = error?.code || error?.errorCode || '';
    const message = error?.message || 'An unknown error occurred';
    
    console.error('Firebase Error:', { code, message });
    
    switch (code) {
      case 'auth/user-not-found':
        return new Error('No account found with this email address');
      case 'auth/wrong-password':
        return new Error('Incorrect password. Please try again.');
      case 'auth/email-already-in-use':
        return new Error('An account with this email already exists');
      case 'auth/weak-password':
        return new Error('Password should be at least 6 characters long');
      case 'auth/invalid-email':
        return new Error('Please enter a valid email address');
      case 'auth/user-disabled':
        return new Error('This account has been disabled');
      case 'auth/too-many-requests':
        return new Error('Too many failed attempts. Please try again later');
      case 'auth/network-request-failed':
        return new Error('Network connection failed. Please check your internet');
      case 'auth/requires-recent-login':
        return new Error('Please log in again to continue with this action');
      case 'auth/invalid-credential':
        return new Error('The provided credentials are invalid');
      default:
        return new Error(message || 'Authentication failed. Please try again');
    }
  }

  // Get ID token
  async getIdToken(forceRefresh = false) {
    try {
      const user = this.auth.currentUser;
      if (user) {
        return await user.getIdToken(forceRefresh);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting ID token:', error);
      return null;
    }
  }

  // Check if authenticated
  isAuthenticated() {
    return !!this.auth.currentUser;
  }

  // Check if email verified
  isEmailVerified() {
    const user = this.auth.currentUser;
    return user ? user.emailVerified : false;
  }
}

// Export singleton instance
export default new FirebaseService();

// Also export individual instances for direct use
export { auth, db, app };
