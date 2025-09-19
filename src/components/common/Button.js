// components/common/Button.js
import React, { useMemo, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left', // 'left' | 'right'
  accessibilityLabel,
  accessibilityHint,
  fullWidth = false,
  hapticFeedback = true,
  usePressable = false, // Use Pressable for better performance
  ...props
}) {
  const { theme, isDark } = useTheme();

  // Memoize button styles for performance
  const buttonStyles = useMemo(() => {
    const baseStyle = {
      ...styles.button,
      backgroundColor: theme.primary,
    };

    // Variant styles
    switch (variant) {
      case 'secondary':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 1.5;
        baseStyle.borderColor = theme.primary;
        break;
      case 'ghost':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 0;
        break;
      case 'danger':
        baseStyle.backgroundColor = theme.error;
        break;
      case 'success':
        baseStyle.backgroundColor = theme.success || '#4CAF50';
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 1.5;
        baseStyle.borderColor = theme.border;
        break;
      default:
        break;
    }

    // Size styles
    switch (size) {
      case 'small':
        Object.assign(baseStyle, styles.small);
        break;
      case 'large':
        Object.assign(baseStyle, styles.large);
        break;
      case 'xlarge':
        Object.assign(baseStyle, styles.xlarge);
        break;
      default:
        break;
    }

    // Full width
    if (fullWidth) {
      baseStyle.width = '100%';
    }

    // Disabled/loading state
    if (disabled || loading) {
      baseStyle.opacity = 0.6;
    }

    // Enhanced shadows for Expo
    if (variant === 'primary' || variant === 'danger' || variant === 'success') {
      baseStyle.shadowColor = isDark ? '#000' : baseStyle.backgroundColor;
      baseStyle.shadowOffset = { width: 0, height: 2 };
      baseStyle.shadowOpacity = isDark ? 0.3 : 0.2;
      baseStyle.shadowRadius = 4;
      baseStyle.elevation = 3;
    }

    return baseStyle;
  }, [variant, size, theme, isDark, fullWidth, disabled, loading]);

  // Memoize text styles for performance
  const textStyles = useMemo(() => {
    const baseStyle = {
      ...typography.button,
      color: theme.textOnPrimary,
    };

    // Text color based on variant
    switch (variant) {
      case 'secondary':
      case 'ghost':
        baseStyle.color = theme.primary;
        break;
      case 'outline':
        baseStyle.color = theme.text;
        break;
      default:
        break;
    }

    // Size-specific text styles
    switch (size) {
      case 'small':
        baseStyle.fontSize = 14;
        break;
      case 'large':
        baseStyle.fontSize = 18;
        break;
      case 'xlarge':
        baseStyle.fontSize = 20;
        break;
      default:
        break;
    }

    // Disabled text color
    if (disabled) {
      baseStyle.color = theme.textDisabled || theme.textSecondary;
    }

    return baseStyle;
  }, [variant, size, theme, disabled]);

  // Memoize loading indicator color
  const loadingColor = useMemo(() => {
    if (variant === 'secondary' || variant === 'ghost' || variant === 'outline') {
      return theme.primary;
    }
    return theme.textOnPrimary;
  }, [variant, theme]);

  // Handle press with haptic feedback (Expo)
  const handlePress = useCallback(async () => {
    if (disabled || loading || !onPress) return;

    // Haptic feedback for Expo
    if (hapticFeedback && Platform.OS !== 'web') {
      try {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        await impactAsync(ImpactFeedbackStyle.Light);
      } catch (error) {
        // Haptics not available, continue without error
      }
    }

    onPress();
  }, [disabled, loading, onPress, hapticFeedback]);

  // Render icon helper
  const renderIcon = () => {
    if (!icon) return null;

    const iconElement = React.isValidElement(icon) ? (
      icon
    ) : typeof icon === 'string' ? (
      <MaterialIcons 
        name={icon} 
        size={size === 'small' ? 16 : size === 'large' ? 22 : size === 'xlarge' ? 24 : 18} 
        color={textStyles.color}
      />
    ) : (
      icon
    );

    return (
      <View style={[
        styles.iconContainer,
        iconPosition === 'right' ? styles.iconRight : styles.iconLeft
      ]}>
        {iconElement}
      </View>
    );
  };

  // Use Pressable for better performance if requested
  const Component = usePressable ? Pressable : TouchableOpacity;

  const pressableProps = usePressable ? {
    android_ripple: {
      color: theme.primary + '20', // 20% opacity
      borderless: false,
    },
  } : {};

  return (
    <Component
      style={({ pressed }) => [
        buttonStyles,
        style,
        usePressable && pressed && { opacity: 0.8 }
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={usePressable ? 1 : Platform.OS === 'android' ? 0.8 : 0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ 
        disabled: disabled || loading,
        busy: loading 
      }}
      {...pressableProps}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator 
            size={size === 'small' ? 'small' : 'small'} 
            color={loadingColor}
            style={styles.loadingIndicator}
          />
        ) : (
          <>
            {iconPosition === 'left' && renderIcon()}
            
            <Text 
              style={[textStyles, textStyle]}
              numberOfLines={1}
              adjustsFontSizeToFit={size === 'small'}
            >
              {title}
            </Text>
            
            {iconPosition === 'right' && renderIcon()}
          </>
        )}
      </View>
    </Component>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    flexDirection: 'row',
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 8,
  },
  large: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    minHeight: 56,
    borderRadius: 14,
  },
  xlarge: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    minHeight: 64,
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  loadingIndicator: {
    // ActivityIndicator already has proper sizing
  },
});
