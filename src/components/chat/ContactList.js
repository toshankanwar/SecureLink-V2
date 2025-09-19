import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function ContactList({
  contacts = [],
  onContactPress,
  loading = false,
}) {
  const { theme } = useTheme();

  const formatLastSeen = (timestamp) => {
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffInHours = (now - lastSeen) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Last seen recently';
    } else if (diffInHours < 24) {
      return `Last seen ${Math.floor(diffInHours)}h ago`;
    } else {
      return lastSeen.toLocaleDateString();
    }
  };

  const formatLastMessage = (message) => {
    if (!message) return 'No messages yet';
    if (message.length > 50) {
      return message.substring(0, 50) + '...';
    }
    return message;
  };

  const renderContact = ({ item }) => (
    <TouchableOpacity
      style={[styles.contactItem, { borderBottomColor: theme.divider }]}
      onPress={() => onContactPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        <Text style={[styles.avatarText, { color: theme.textOnPrimary }]}>
          {item.displayName?.charAt(0)?.toUpperCase() || 'U'}
        </Text>
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={[
            styles.contactName,
            { color: theme.text },
            typography.h3,
          ]}>
            {item.displayName || 'Unknown'}
          </Text>
          <Text style={[
            styles.lastMessageTime,
            { color: theme.textSecondary },
            typography.caption,
          ]}>
            {item.lastMessageTime ? formatLastSeen(item.lastMessageTime) : ''}
          </Text>
        </View>

        <View style={styles.contactFooter}>
          <Text style={[
            styles.lastMessage,
            { color: theme.textSecondary },
            typography.body2, 
          ]}>
            {formatLastMessage(item.lastMessage)}
          </Text>
          
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={[
                styles.unreadCount,
                { color: theme.textOnPrimary },
                typography.caption,
              ]}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.contactActions}>
        <Icon name="chevron-right" size={24} color={theme.iconSecondary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[{ color: theme.textSecondary }, typography.body1]}>
          Loading contacts...
        </Text>
      </View>
    );
  }

  if (contacts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <Icon name="chat" size={64} color={theme.iconSecondary} />
        <Text style={[
          styles.emptyTitle,
          { color: theme.text },
          typography.h2,
        ]}>
          No Chats Yet
        </Text>
        <Text style={[
          styles.emptySubtitle,
          { color: theme.textSecondary },
          typography.body1,
        ]}>
          Start a conversation by adding a contact ID
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={contacts}
      renderItem={renderContact}
      keyExtractor={(item) => item.id || item.contactId}
      style={[styles.list, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    flex: 1,
    fontWeight: '600',
  },
  lastMessageTime: {
    marginLeft: 8,
  },
  contactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  contactActions: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
});
