import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'large',
  style,
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, style]}>
      <ActivityIndicator size={size} color={theme.primary} />
      <Text style={[
        styles.message,
        { color: theme.textSecondary },
        typography.body2,
      ]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 16,
    textAlign: 'center',
  },
});
