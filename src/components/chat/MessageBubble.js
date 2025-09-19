import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function MessageBubble({
  message,
  isOwn = false,
  showAvatar = true,
  onPress,
  onLongPress,
}) {
  const { theme } = useTheme();

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
    });
  }; 

  const getBubbleStyle = () => {
    const baseStyle = [styles.bubble];
    
    if (isOwn) {
      baseStyle.push({
        backgroundColor: theme.chatBubbleSent,
        alignSelf: 'flex-end',
        marginLeft: 50,
        borderBottomRightRadius: 4,
      });
    } else {
      baseStyle.push({
        backgroundColor: theme.chatBubbleReceived,
        alignSelf: 'flex-start',
        marginRight: 50,
        borderBottomLeftRadius: 4,
      });
    }

    return baseStyle;
  };

  const getTextColor = () => {
    return isOwn ? theme.chatBubbleSentText : theme.chatBubbleReceivedText;
  };

  const getTimeColor = () => {
    return isOwn 
      ? 'rgba(255, 255, 255, 0.7)' 
      : theme.textSecondary;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={getBubbleStyle()}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
      >
        <Text style={[
          typography.chatMessage,
          { color: getTextColor() }
        ]}>
          {message.content}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={[
            typography.chatTime,
            { color: getTimeColor() }
          ]}>
            {formatTime(message.timestamp)}
          </Text>
          
          {isOwn && (
            <View style={styles.statusIcon}>
              <Icon
                name={message.status === 'delivered' ? 'done-all' : 'done'}
                size={16}
                color={message.status === 'read' ? theme.success : getTimeColor()}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  bubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
    minWidth: 80,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  statusIcon: {
    marginLeft: 4,
  },
});
