import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function ChatInput({
  onSendMessage,
  placeholder = 'Type a message...',
}) {
  const { theme } = useTheme();
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.inputContainer}>
        <View style={[
          styles.textInputContainer,
          { backgroundColor: theme.chatInputBackground }
        ]}>
          <TextInput
            style={[
              styles.textInput,
              { color: theme.text },
              typography.body1,
            ]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity style={styles.attachButton}>
            <Icon name="attach-file" size={24} color={theme.iconSecondary} />
          </TouchableOpacity>
          
          {!message.trim() && (
            <TouchableOpacity style={styles.cameraButton}>
              <Icon name="camera-alt" size={24} color={theme.iconSecondary} />
            </TouchableOpacity>
          )}
        </View>
      
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: theme.primary }
          ]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Icon 
            name="send" 
            size={20} 
            color={theme.textOnPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingVertical: 8,
    textAlignVertical: 'center',
  },
  attachButton: {
    padding: 4,
    marginLeft: 4,
  },
  cameraButton: {
    padding: 4,
    marginLeft: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
