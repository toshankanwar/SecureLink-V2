// screens/profile/ProfileScreen.js - ENHANCED PROFESSIONAL VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  TextInput,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Context imports
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// Firebase Web SDK imports
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

// Components and services
import Button from '../../components/common/Button';
import { typography } from '../../styles/typography';
import StorageService from '../../services/storage';

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=200&rounded=true&bold=true';
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/drlxxyu9o/upload';
const CLOUDINARY_PRESET = 'securelink_default';
const AVATAR_SIZE = 140;

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Animated values for smooth transitions
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // State management
  const [userProfile, setUserProfile] = useState({
    contactId: user?.uid || '',
    displayName: user?.displayName || '',
    email: user?.email || '',
    about: 'Hey there! I am using SecureLink.',
    photoURL: user?.photoURL || DEFAULT_AVATAR,
  });

  const [formData, setFormData] = useState({
    displayName: '',
    about: '',
    photoURL: '',
  });

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs for inputs
  const displayNameRef = useRef(null);
  const aboutRef = useRef(null);

  // Animation effects
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load user profile on focus
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadUserProfile();
      }
    }, [user])
  );

  // Load user profile from Firestore with enhanced error handling
  const loadUserProfile = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const profile = {
          contactId: userData.contactId || user.uid,
          displayName: userData.displayName || user.displayName || '',
          email: userData.email || user.email || '',
          about: userData.about || 'Hey there! I am using SecureLink.',
          photoURL: userData.photoURL || user.photoURL || DEFAULT_AVATAR,
        };

        setUserProfile(profile);
        setFormData({
          displayName: profile.displayName,
          about: profile.about,
          photoURL: profile.photoURL,
        });

        await StorageService.storeUserProfile(profile);
      } else {
        // Create new profile if doesn't exist
        const newProfile = {
          contactId: user.uid,
          displayName: user.displayName || '',
          email: user.email || '',
          about: 'Hey there! I am using SecureLink.',
          photoURL: user.photoURL || DEFAULT_AVATAR,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await updateDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
        setFormData({
          displayName: newProfile.displayName,
          about: newProfile.about,
          photoURL: newProfile.photoURL,
        });
      }
    } catch (err) {
      console.error('❌ Error loading user profile:', err);
      // Try loading from local storage
      try {
        const localProfile = await StorageService.getUserProfile();
        if (localProfile) {
          setUserProfile(localProfile);
          setFormData({
            displayName: localProfile.displayName,
            about: localProfile.about,
            photoURL: localProfile.photoURL,
          });
        }
      } catch (localErr) {
        console.error('❌ Failed to load local profile:', localErr);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Handle form data changes with haptic feedback
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      const hasChanges = Object.keys(newData).some(key => 
        newData[key] !== userProfile[key]
      );
      setHasChanges(hasChanges);
      
      if (hasChanges && Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      return newData;
    });
  }, [userProfile]);

  // Enhanced image selection with better UX
  const handleSelectImage = useCallback(async () => {
    if (!editing) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant media library permissions to change your profile photo.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => ImagePicker.openSettings?.() }
          ]
        );
        return;
      }

      Alert.alert(
        'Change Profile Photo',
        'Choose how you\'d like to update your profile photo',
        [
          {
            text: 'Camera',
            onPress: () => openCamera(),
            style: 'default',
          },
          {
            text: 'Photo Library',
            onPress: () => openImageLibrary(),
            style: 'default',
          },
          {
            text: 'Remove Photo',
            style: 'destructive',
            onPress: () => handleInputChange('photoURL', DEFAULT_AVATAR),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('❌ Permission error:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  }, [editing, handleInputChange]);

  // Open camera with enhanced settings
  const openCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        uploadImageToCloudinary(result.assets[0]);
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  }, []);

  // Open image library with enhanced settings
  const openImageLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        uploadImageToCloudinary(result.assets[0]);
      }
    } catch (error) {
      console.error('❌ Image library error:', error);
      Alert.alert('Error', 'Failed to open image library');
    }
  }, []);

  // Enhanced Cloudinary upload with progress tracking
  const uploadImageToCloudinary = useCallback(async (imageAsset) => {
    try {
      setImageUploading(true);
      setUploadProgress(0);
      
      const { uri, type = 'image/jpeg' } = imageAsset;

      // Show immediate feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const formData = new FormData();
      
      const fileObject = {
        uri,
        type,
        name: `profile_${userProfile.contactId}_${Date.now()}.jpg`,
      };
      
      formData.append('file', fileObject);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('public_id', `securelink/profile_pictures/profile_${userProfile.contactId}`);
      formData.append('overwrite', 'true');
      formData.append('transformation', 'c_fill,w_400,h_400,q_auto,f_auto');

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (result.secure_url) {
        handleInputChange('photoURL', result.secure_url);
        
        // Success haptic feedback
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert(
          'Success!',
          'Your profile photo has been updated successfully.',
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        throw new Error(result.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Image upload error:', error);
      
      // Error haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      Alert.alert(
        'Upload Failed',
        'Failed to upload your profile photo. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => uploadImageToCloudinary(imageAsset) }
        ]
      );
    } finally {
      setImageUploading(false);
      setUploadProgress(0);
    }
  }, [userProfile.contactId, handleInputChange]);

  // Enhanced save profile with better validation
  const handleSaveProfile = useCallback(async () => {
    if (!user?.uid || !hasChanges) return;

    if (!formData.displayName.trim()) {
      Alert.alert(
        'Validation Error',
        'Display name is required and cannot be empty.',
        [{ text: 'OK', onPress: () => displayNameRef.current?.focus() }]
      );
      return;
    }

    if (formData.displayName.trim().length < 2) {
      Alert.alert(
        'Validation Error',
        'Display name must be at least 2 characters long.',
        [{ text: 'OK', onPress: () => displayNameRef.current?.focus() }]
      );
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        displayName: formData.displayName.trim(),
        about: formData.about.trim(),
        photoURL: formData.photoURL,
        updatedAt: serverTimestamp(),
      };

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, updateData);

      const updatedProfile = { 
        ...userProfile, 
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      
      setUserProfile(updatedProfile);
      setHasChanges(false);
      setEditing(false);

      await StorageService.storeUserProfile(updatedProfile);

      // Success haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Profile Updated!',
        'Your profile has been successfully updated.',
        [{ text: 'Great!', style: 'default' }]
      );
    } catch (err) {
      console.error('❌ Error saving profile:', err);
      
      // Error haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      Alert.alert(
        'Save Failed',
        'Failed to save your profile changes. Please check your connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setSaving(false);
    }
  }, [user, formData, userProfile, hasChanges]);

  // Enhanced cancel editing with better UX
  const handleCancelEdit = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              setFormData({
                displayName: userProfile.displayName,
                about: userProfile.about,
                photoURL: userProfile.photoURL,
              });
              setHasChanges(false);
              setEditing(false);
              
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          },
        ]
      );
    } else {
      setEditing(false);
    }
  }, [hasChanges, userProfile]);

  // Start editing with animation
  const handleStartEdit = useCallback(() => {
    setEditing(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  // Enhanced loading screen
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar 
          backgroundColor={theme.background} 
          barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        backgroundColor={theme.background} 
        barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* ✅ Enhanced Header with Gradient */}
        {/* ✅ FLOATING EDIT BUTTON - NO LAYOUT SPACE TAKEN */}
      {!editing && (
        <TouchableOpacity
          style={[styles.floatingEditButton, { 
            backgroundColor: theme.primary,
            shadowColor: theme.primary 
          }]}
          onPress={handleStartEdit}
          activeOpacity={0.8}
        >
          <MaterialIcons name="edit" size={20} color={theme.textOnPrimary} />
        </TouchableOpacity>
      )}

        <Animated.View style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ✅ Enhanced Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                onPress={handleSelectImage}
                style={styles.avatarContainer}
                activeOpacity={editing ? 0.7 : 1}
                disabled={!editing || imageUploading}
              >
                <View style={styles.avatarWrapper}>
                  <Image
                    source={{ uri: formData.photoURL || DEFAULT_AVATAR }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                  
                  {/* Upload progress overlay */}
                  {imageUploading && (
                    <View style={styles.uploadOverlay}>
                      <View style={styles.progressContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.uploadText, { color: 'white' }]}>
                          Uploading... {uploadProgress}%
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Camera icon when editing */}
                  {editing && !imageUploading && (
                    <View style={[styles.cameraIcon, { 
                      backgroundColor: theme.primary,
                      shadowColor: theme.primary,
                    }]}>
                      <MaterialIcons name="photo-camera" size={22} color={theme.textOnPrimary} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              
              <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
                {editing ? 'Tap to change photo' : formData.displayName || 'Your Profile'}
              </Text>
            </View>

            {/* ✅ Enhanced Profile Information Cards */}
            <View style={styles.infoContainer}>
              {/* Display Name Card */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={styles.fieldHeader}>
                  <Ionicons name="person-outline" size={20} color={theme.primary} />
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Display Name
                  </Text>
                </View>
                {editing ? (
                  <TextInput
                    ref={displayNameRef}
                    style={[styles.fieldInput, { 
                      color: theme.text,
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    }]}
                    value={formData.displayName}
                    onChangeText={(value) => handleInputChange('displayName', value)}
                    placeholder="Enter your display name"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={50}
                    returnKeyType="next"
                    onSubmitEditing={() => aboutRef.current?.focus()}
                  />
                ) : (
                  <Text style={[styles.fieldValue, { color: theme.text }]}>
                    {formData.displayName || 'Not set'}
                  </Text>
                )}
              </View>

              {/* About Card */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={styles.fieldHeader}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    About
                  </Text>
                </View>
                {editing ? (
                  <TextInput
                    ref={aboutRef}
                    style={[styles.fieldInput, { 
                      color: theme.text,
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    }]}
                    value={formData.about}
                    onChangeText={(value) => handleInputChange('about', value)}
                    placeholder="Tell others about yourself..."
                    placeholderTextColor={theme.textSecondary}
                    maxLength={80}
                    returnKeyType="done"
                    multiline
                  />
                ) : (
                  <Text style={[styles.fieldValue, { 
                    color: theme.textSecondary, 
                    fontStyle: 'italic' 
                  }]}>
                    {formData.about || 'Hey there! I am using SecureLink.'}
                  </Text>
                )}
              </View>

              {/* Contact ID Card */}
              <TouchableOpacity
                style={[styles.fieldCard, { backgroundColor: theme.surface }]}
                onPress={() => {
                  Alert.alert(
                    'Your Contact ID',
                    `${userProfile.contactId}\n\nShare this unique ID with friends so they can add you to SecureLink!`,
                    [
                      { text: 'Copy ID', onPress: () => {/* Implement copy functionality */} },
                      { text: 'Close', style: 'cancel' }
                    ]
                  );
                }}
              >
                <View style={styles.fieldHeader}>
                  <Ionicons name="id-card-outline" size={20} color={theme.primary} />
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Contact ID
                  </Text>
                  <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                </View>
                <Text style={[styles.fieldValue, { 
                  color: theme.primary, 
                  fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
                  fontWeight: '600',
                }]}>
                  {userProfile.contactId}
                </Text>
              </TouchableOpacity>

              {/* Email Card */}
              <View style={[styles.fieldCard, { backgroundColor: theme.surface }]}>
                <View style={styles.fieldHeader}>
                  <Ionicons name="mail-outline" size={20} color={theme.primary} />
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Email Address
                  </Text>
                </View>
                <Text style={[styles.fieldValue, { color: theme.text }]}>
                  {userProfile.email || 'Not set'}
                </Text>
              </View>
            </View>

            {/* ✅ Professional Action Buttons */}
            {editing && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: hasChanges && !saving ? theme.primary : theme.textSecondary + '40',
                      shadowColor: theme.primary,
                    }
                  ]}
                  onPress={handleSaveProfile}
                  disabled={saving || !hasChanges || imageUploading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={hasChanges && !saving ? 
                      [theme.primary, theme.primary + 'DD'] : 
                      [theme.textSecondary + '40', theme.textSecondary + '20']
                    }
                    style={styles.buttonGradient}
                  >
                    {saving ? (
                      <>
                        <ActivityIndicator size="small" color={theme.textOnPrimary} />
                        <Text style={[styles.buttonText, { color: theme.textOnPrimary }]}>
                          Saving...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color={theme.textOnPrimary} />
                        <Text style={[styles.buttonText, { color: theme.textOnPrimary }]}>
                          Save Changes
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    }
                  ]}
                  onPress={handleCancelEdit}
                  disabled={saving || imageUploading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                  <Text style={[styles.buttonText, { color: theme.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },

  // Header
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  floatingEditButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000, // Ensures it stays on top
  },
  // Animated container
  animatedContainer: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 40,
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginVertical: 30,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarWrapper: {
    position: 'relative',
    borderRadius: AVATAR_SIZE / 2,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#f0f0f0',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  avatarHint: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Info Container
  infoContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  fieldCard: {
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  fieldInput: {
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
  },

  // Action Buttons
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
    gap: 12,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
