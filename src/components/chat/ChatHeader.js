// components/common/ChatHeader.js
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function ChatHeader({
  displayName,
  contactId,
  isOnline = false,
  lastSeen,
  onBack,
  onVideoCall,
  onVoiceCall,
  onMoreOptions,
  showCallButtons = true,
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Memoize status text calculation for performance
  const statusText = useMemo(() => {
    if (isOnline) return 'Online';
    if (lastSeen) {
      const now = new Date();
      const lastSeenDate = new Date(lastSeen);
      const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Last seen just now';
      if (diffInMinutes < 60) return `Last seen ${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `Last seen ${Math.floor(diffInMinutes / 60)}h ago`;
      
      // Format date for older messages
      const options = { 
        month: 'short', 
        day: 'numeric',
        ...(lastSeenDate.getFullYear() !== now.getFullYear() && { year: 'numeric' })
      };
      return `Last seen ${lastSeenDate.toLocaleDateString('en-US', options)}`;
    }
    return 'Last seen recently';
  }, [isOnline, lastSeen]);

  // Generate initials for avatar
  const avatarText = useMemo(() => {
    if (displayName) {
      const words = displayName.trim().split(' ');
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return displayName.charAt(0).toUpperCase();
    }
    return contactId ? contactId.charAt(0).toUpperCase() : 'U';
  }, [displayName, contactId]);

  return (
    <>
      {/* Status Bar Configuration */}
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.primary}
        translucent={false}
      />
      
      {/* Header Container */}
      <View style={[
        styles.container, 
        { 
          backgroundColor: theme.primary,
          paddingTop: Platform.OS === 'ios' ? insets.top : 0,
        }
      ]}>
        <View style={styles.content}>
          {/* Left Section */}
          <View style={styles.leftSection}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons 
                name="arrow-back" 
                size={24} 
                color={theme.textOnPrimary} 
              />
            </TouchableOpacity>
            
            {/* Avatar */}
            <View style={[
              styles.avatar, 
              { 
                backgroundColor: theme.primaryLight || theme.primaryDark,
                borderWidth: 2,
                borderColor: theme.textOnPrimary + '20', // 20% opacity
              }
            ]}>
              <Text style={[
                styles.avatarText, 
                { color: theme.textOnPrimary }
              ]}>
                {avatarText}
              </Text>
            </View>
            
            {/* User Info */}
            <View style={styles.userInfo}>
              <Text 
                style={[
                  styles.displayName,
                  { color: theme.textOnPrimary },
                  typography.h3,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName || contactId || 'Unknown User'}
              </Text>
              
              <View style={styles.statusContainer}>
                {/* Online indicator dot */}
                {isOnline && (
                  <View style={[
                    styles.onlineDot, 
                    { backgroundColor: theme.success || '#4CAF50' }
                  ]} />
                )}
                
                <Text style={[
                  styles.status,
                  { color: theme.textOnPrimary },
                  typography.caption,
                ]}>
                  {statusText}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Section - Action Buttons */}
          {showCallButtons && (
            <View style={styles.rightSection}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={onVideoCall}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons 
                  name="videocam" 
                  size={24} 
                  color={theme.textOnPrimary} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={onVoiceCall}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons 
                  name="call" 
                  size={24} 
                  color={theme.textOnPrimary} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={onMoreOptions}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons 
                  name="more-vert" 
                  size={24} 
                  color={theme.textOnPrimary} 
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    minHeight: 64,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  displayName: {
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  status: {
    opacity: 0.9,
    fontSize: 13,
    lineHeight: 16,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 10,
    marginLeft: 2,
    borderRadius: 20,
  },
});
