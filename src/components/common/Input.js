// components/common/Input.js
import React, { useState, forwardRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

const Input = forwardRef(({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  containerStyle,
  multiline = false,
  numberOfLines = 1,
  disabled = false,
  required = false,
  maxLength,
  autoFocus = false,
  ...props
}, ref) => {
  const { theme, isDark } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  // Toggle password visibility with useCallback for performance
  const togglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible(prev => !prev);
  }, []);

  // Handle right icon press
  const handleRightIconPress = useCallback(() => {
    if (onRightIconPress) {
      onRightIconPress();
    }
  }, [onRightIconPress]);

  // Dynamic styles based on state
  const getBorderColor = () => {
    if (disabled) return theme.border + '60'; // 60% opacity
    if (error) return theme.error;
    if (isFocused) return theme.primary;
    return theme.border;
  };

  const getBackgroundColor = () => {
    if (disabled) return theme.surface + '50'; // 50% opacity
    return theme.surface;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[
            styles.label, 
            { color: theme.text }, 
            typography.body2
          ]}>
            {label}
            {required && (
              <Text style={[styles.required, { color: theme.error }]}>
                {' *'}
              </Text>
            )}
          </Text>
          
          {maxLength && value && (
            <Text style={[
              styles.charCount, 
              { color: theme.textSecondary },
              typography.caption
            ]}>
              {value.length}/{maxLength}
            </Text>
          )}
        </View>
      )}
      
      {/* Input Container */}
      <View style={[
        styles.inputContainer,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
          opacity: disabled ? 0.7 : 1,
        },
        style
      ]}>
        {/* Left Icon */}
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {React.isValidElement(leftIcon) ? (
              leftIcon
            ) : (
              <MaterialIcons 
                name={leftIcon} 
                size={20} 
                color={disabled ? theme.iconDisabled : theme.iconSecondary} 
              />
            )}
          </View>
        )}
        
        {/* Text Input */}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: disabled ? theme.textDisabled : theme.text,
              flex: 1,
            },
            typography.body1,
            multiline && { 
              minHeight: numberOfLines * 20,
              textAlignVertical: 'top',
            },
            inputStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary + '80'} // 80% opacity
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={!disabled}
          maxLength={maxLength}
          autoFocus={autoFocus}
          selectionColor={theme.primary}
          underlineColorAndroid="transparent"
          {...props}
        />
        
        {/* Password Toggle Icon */}
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={togglePasswordVisibility}
            disabled={disabled}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name={isPasswordVisible ? 'visibility' : 'visibility-off'}
              size={20}
              color={disabled ? theme.iconDisabled : theme.iconSecondary}
            />
          </TouchableOpacity>
        )}
        
        {/* Right Icon (when not password field) */}
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={handleRightIconPress}
            disabled={disabled || !onRightIconPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {React.isValidElement(rightIcon) ? (
              rightIcon
            ) : (
              <MaterialIcons 
                name={rightIcon} 
                size={20} 
                color={disabled ? theme.iconDisabled : theme.iconSecondary} 
              />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {/* Error Message */}
      {error && (
        <View style={styles.messageContainer}>
          <MaterialIcons 
            name="error-outline" 
            size={16} 
            color={theme.error} 
            style={styles.messageIcon}
          />
          <Text style={[
            styles.errorMessage, 
            { color: theme.error }, 
            typography.caption
          ]}>
            {error}
          </Text>
        </View>
      )}
      
      {/* Helper Text */}
      {helperText && !error && (
        <Text style={[
          styles.helperText, 
          { color: theme.textSecondary }, 
          typography.caption
        ]}>
          {helperText}
        </Text>
      )}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    flex: 1,
  },
  required: {
    fontWeight: '600',
  },
  charCount: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    fontSize: 16,
    lineHeight: 20,
  },
  leftIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    marginLeft: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
  },
  messageIcon: {
    marginRight: 6,
  },
  errorMessage: {
    flex: 1,
    fontSize: 12,
  },
  helperText: {
    marginTop: 4,
    marginLeft: 4,
    fontSize: 12,
  },
});

export default Input;
