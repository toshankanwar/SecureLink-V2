// screens/chat/SettingsScreen.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

// Context imports
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// Firebase Web SDK imports
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

// Services and utils
import { typography } from '../../styles/typography';
import StorageService from '../../services/storage';

export default function SettingsScreen({ navigation }) {
  const { user, logout, isOnline } = useAuth();
  const { theme, isDark, toggleTheme, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();

  // State management
  const [userProfile, setUserProfile] = useState({
    contactId: 'Loading...',
    displayName: user?.displayName || 'User',
    email: user?.email || '',
    photoURL: user?.photoURL || null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load user data from Firestore users collection
  const loadUserProfile = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch from Firestore users collection
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const profile = {
          contactId: userData.contactId || user.uid,
          displayName: userData.displayName || user.displayName || userData.email || 'User',
          email: userData.email || user.email || '',
          photoURL: userData.photoURL || user.photoURL || null,
          isOnline: userData.isOnline || false,
          lastSeen: userData.lastSeen,
        };
        
        setUserProfile(profile);
        console.log('📱 User profile loaded from Firestore');
        
        // Save to local storage for offline access
        await StorageService.storeUserProfile(profile);
      } else {
        // Fallback to auth user data if Firestore doc doesn't exist
        const fallbackProfile = {
          contactId: user.uid,
          displayName: user.displayName || 'User',
          email: user.email || '',
          photoURL: user.photoURL || null,
        };
        setUserProfile(fallbackProfile);
      }
    } catch (err) {
      console.error('❌ Error loading user profile:', err);
      setError('Failed to load profile information');
      
      // Try to load from local storage as fallback
      try {
        const localProfile = await StorageService.getUserProfile();
        if (localProfile) {
          setUserProfile(localProfile);
        }
      } catch (localErr) {
        console.error('❌ Failed to load local profile:', localErr);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Real-time listener for user profile changes
  const setupProfileListener = useCallback(() => {
    if (!user?.uid) return () => {};

    try {
      const userDocRef = doc(db, 'users', user.uid);
      
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const updatedProfile = {
            contactId: userData.contactId || user.uid,
            displayName: userData.displayName || user.displayName || userData.email || 'User',
            email: userData.email || user.email || '',
            photoURL: userData.photoURL || user.photoURL || null,
            isOnline: userData.isOnline || false,
            lastSeen: userData.lastSeen,
          };
          
          setUserProfile(updatedProfile);
          StorageService.storeUserProfile(updatedProfile);
        }
      }, (err) => {
        console.error('❌ Profile listener error:', err);
        setError('Connection lost - showing cached data');
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up profile listener:', error);
      return () => {};
    }
  }, [user]);

  // Focus effect for refreshing when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadUserProfile();
        const unsubscribe = setupProfileListener();
        return unsubscribe;
      }
    }, [user, loadUserProfile, setupProfileListener])
  );

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserProfile();
    setRefreshing(false);
  }, [loadUserProfile]);

  // Handle logout with confirmation
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to sign in again to access your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        },
      ]
    );
  }, [logout]);

  // Handle theme mode change
  const handleThemeChange = useCallback((mode) => {
    setThemeMode(mode);
  }, [setThemeMode]);

  // Copy contact ID to clipboard
  const copyContactId = useCallback(() => {
    if (userProfile.contactId && userProfile.contactId !== 'Loading...') {
      // Note: Expo clipboard functionality would be implemented here
      Alert.alert('Contact ID', `Your Contact ID: ${userProfile.contactId}`, [
        { text: 'OK' }
      ]);
    }
  }, [userProfile.contactId]);

  // Memoized setting item component
  const SettingItem = useMemo(() => ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement, 
    showArrow = true,
    iconColor,
    titleColor,
    disabled = false 
  }) => (
    <TouchableOpacity
      style={[
        styles.settingItem, 
        { 
          borderBottomColor: theme.border, 
          backgroundColor: theme.surface,
          opacity: disabled ? 0.6 : 1 
        }
      ]}
      onPress={onPress}
      disabled={!onPress || disabled}
      activeOpacity={onPress ? 0.7 : 1}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View style={styles.settingLeft}>
        <View style={[
          styles.settingIcon, 
          { backgroundColor: iconColor || theme.primary }
        ]}>
          <MaterialIcons 
            name={icon} 
            size={24} 
            color={theme.textOnPrimary} 
          />
        </View>
        <View style={styles.settingText}>
          <Text style={[
            styles.settingTitle, 
            { color: titleColor || theme.text }, 
            typography.h4
          ]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[
              styles.settingSubtitle, 
              { color: theme.textSecondary }, 
              typography.body2
            ]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightElement}
        {showArrow && onPress && !disabled && (
          <MaterialIcons 
            name="chevron-right" 
            size={24} 
            color={theme.iconSecondary} 
          />
        )}
      </View>
    </TouchableOpacity>
  ), [theme]);

  // Show loading screen for initial load
  if (loading && !userProfile.displayName) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          backgroundColor: theme.primary,
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
        },
      ]}>
        <Text style={[styles.headerTitle, { color: theme.textOnPrimary }]}>
          Settings
        </Text>
        
        {/* Connection Status */}
        <View style={styles.headerRight}>
          {isOnline && (
            <MaterialIcons 
              name="wifi" 
              size={20} 
              color={theme.textOnPrimary + '80'} 
            />
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Error Display */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + '20' }]}>
            <MaterialIcons name="error-outline" size={20} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>
              {error}
            </Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <MaterialIcons name="close" size={20} color={theme.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Section */}
        <View style={[styles.section, styles.profileSection, { backgroundColor: theme.surface }]}>
          <TouchableOpacity 
            style={styles.profileHeader}
            onPress={() => navigation.navigate('Profile')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="View and edit profile"
          >
            <View style={[styles.profileAvatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.profileAvatarText, { color: theme.textOnPrimary }]}>
                {userProfile.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }, typography.h2]}>
                {userProfile.displayName}
              </Text>
              <TouchableOpacity 
                onPress={copyContactId}
                style={styles.contactIdContainer}
              >
                <Text style={[styles.profileLabel, { color: theme.textSecondary }]}>
                  Contact ID: 
                </Text>
                <Text style={[styles.profileContactId, { color: theme.primary }]}>
                  {userProfile.contactId}
                </Text>
                <MaterialIcons 
                  name="copy" 
                  size={16} 
                  color={theme.primary} 
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
              {userProfile.email && (
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                  {userProfile.email}
                </Text>
              )}
            </View>
            <MaterialIcons 
              name="edit" 
              size={20} 
              color={theme.iconSecondary} 
            />
          </TouchableOpacity>
        </View>

        {/* Account Settings */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            ACCOUNT
          </Text>
          <SettingItem
            icon="person"
            title="Profile"
            subtitle="Update your profile information"
            onPress={() => navigation.navigate('Profile')}
          />
          <SettingItem
            icon="security"
            title="Security"
            subtitle="Privacy and security settings"
            onPress={() => navigation.navigate('SecurityScreen')}
          />
          <SettingItem
            icon="notifications"
            title="Notifications"
            subtitle="Manage your notifications"
            onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available soon!')}
          />
        </View>

        {/* Appearance */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            APPEARANCE
          </Text>
          <SettingItem
            icon={isDark ? 'light-mode' : 'dark-mode'}
            title="Dark Mode"
            subtitle={`Currently using ${isDark ? 'dark' : 'light'} theme`}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.surface}
                ios_backgroundColor={theme.border}
              />
            }
            showArrow={false}
          />
          <SettingItem
            icon="palette"
            title="Theme"
            subtitle={`Theme mode: ${themeMode}`}
            onPress={() => {
              Alert.alert('Theme Mode', 'Choose your preferred theme mode', [
                { text: 'Light', onPress: () => handleThemeChange('light') },
                { text: 'Dark', onPress: () => handleThemeChange('dark') },
                { text: 'System', onPress: () => handleThemeChange('system') },
                { text: 'Cancel', style: 'cancel' }
              ]);
            }}
          />
        </View>

        {/* Privacy & Storage */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            PRIVACY & STORAGE
          </Text>
          <SettingItem
            icon="backup"
            title="Chat Backup"
            subtitle="Manage your chat backups"
            onPress={() => Alert.alert('Coming Soon', 'Chat backup will be available soon!')}
          />
          <SettingItem
            icon="block"
            title="Blocked Contacts"
            subtitle="Manage blocked contacts"
            onPress={() => Alert.alert('Coming Soon', 'Blocked contacts management will be available soon!')}
          />
          <SettingItem
            icon="storage"
            title="Storage Usage"
            subtitle="Manage app storage"
            onPress={() => Alert.alert('Coming Soon', 'Storage management will be available soon!')}
          />
        </View>

        {/* Support & About */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            SUPPORT & ABOUT
          </Text>
          <SettingItem
            icon="help"
            title="Help & Support"
            subtitle="Get help and contact support"
            onPress={() => Alert.alert('Help & Support', 'Contact our support team at support@securelink.com')}
          />
          <SettingItem
            icon="info"
            title="About SecureLink"
            subtitle="Version 1.0.0 • Privacy focused messaging"
            onPress={() => Alert.alert('About SecureLink', 'SecureLink v1.0.0\n\nA secure messaging application built with privacy in mind.\n\n© 2025 SecureLink Team')}
          />
          <SettingItem
            icon="description"
            title="Terms & Privacy"
            subtitle="Read our terms and privacy policy"
            onPress={() => Alert.alert('Coming Soon', 'Terms and Privacy Policy will be available soon!')}
          />
        </View>

        {/* Logout */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <SettingItem
            icon="logout"
            title="Sign Out"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            iconColor={theme.error}
            titleColor={theme.error}
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: theme.textSecondary }]}>
            SecureLink • Secure Messaging
          </Text>
          <Text style={[styles.appVersionText, { color: theme.textSecondary }]}>
            Version 1.0.0 • Built with ❤️ for privacy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  scrollContainer: {
    paddingBottom: 32,
  },
  section: {
    borderRadius: 12,
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.8,
  },
  profileSection: {
    marginTop: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontWeight: '600',
    fontSize: 20,
    marginBottom: 4,
  },
  contactIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  profileContactId: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  settingSubtitle: {
    marginTop: 2,
    fontSize: 13,
    opacity: 0.8,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  appInfoText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  appVersionText: {
    fontSize: 12,
    opacity: 0.8,
  },
});
