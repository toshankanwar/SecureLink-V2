import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';
import Button from './Button';

export default function Modal({
  visible,
  onClose,
  title,
  children,
  actions,
  dismissable = true,
  size = 'medium',
}) {
  const { theme } = useTheme();

  const getModalSize = () => {
    switch (size) {
      case 'small':
        return { maxWidth: 300 };
      case 'large':
        return { maxWidth: 500 };
      default:
        return { maxWidth: 400 };
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissable ? onClose : undefined}
    >
      <TouchableWithoutFeedback onPress={dismissable ? onClose : undefined}>
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.modal,
              { backgroundColor: theme.surface },
              getModalSize(),
            ]}>
              {/* Header */}
              {title && (
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                  <Text style={[
                    styles.title,
                    { color: theme.text },
                    typography.h2,
                  ]}>
                    {title}
                  </Text>
                  {dismissable && (
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                      <Icon name="close" size={24} color={theme.iconPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Content */}
              <View style={styles.content}>
                {children}
              </View>

              {/* Actions */}
              {actions && (
                <View style={[styles.actions, { borderTopColor: theme.border }]}>
                  {actions}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    borderRadius: 16,
    minWidth: 280,
    maxHeight: '80%',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: 16,
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
});
