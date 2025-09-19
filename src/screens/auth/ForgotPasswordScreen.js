// screens/auth/ForgotPasswordScreen.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Context and services
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import FirebaseService from '../../services/firebase';

// Components
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

// Styles and constants
import { typography } from '../../styles/typography';
import { ROUTES } from '../../utils/constants';

export default function ForgotPasswordScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { sendPasswordReset, loading: authLoading, error: authError } = useAuth();
  const insets = useSafeAreaInsets();

  // Form state
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Refs for input management
  const emailRef = useRef(null);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Clear auth error when user starts typing
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Enhanced email validation
  const validateEmail = useCallback((email) => {
    if (!email.trim()) {
      setFieldError('Email address is required');
      return false;
    }
    
    if (email.trim().length > 254) {
      setFieldError('Email address is too long');
      return false;
    }
    
    // Enhanced email regex for better validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFieldError('Please enter a valid email address');
      return false;
    }
    
    setFieldError('');
    return true;
  }, []);

  // Handle password reset
  const handleReset = useCallback(async () => {
    if (!validateEmail(email)) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      // Use AuthContext method or direct Firebase service
      if (sendPasswordReset) {
        await sendPasswordReset(email.trim().toLowerCase());
      } else {
        await FirebaseService.sendPasswordReset(email.trim().toLowerCase());
      }

      setEmailSent(true);
      
      Alert.alert(
        'Password Reset Email Sent! 📧',
        `A password reset link has been sent to ${email.trim()}.\n\nPlease check your email inbox (and spam folder) and follow the instructions to reset your password.`,
        [
          {
            text: 'Resend Email',
            style: 'default',
            onPress: () => {
              setEmailSent(false);
              handleReset();
            }
          },
          {
            text: 'Back to Login',
            style: 'default',
            onPress: () => {
              setEmail('');
              setEmailSent(false);
              navigation.goBack();
            }
          }
        ]
      );

    } catch (err) {
      console.error('❌ Password reset error:', err);
      
      // Enhanced error handling with specific Firebase error codes
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      if (err.message || err.code) {
        const errorCode = err.code || err.message;
        
        if (errorCode.includes('user-not-found')) {
          errorMessage = 'No account found with this email address. Please check your email or create a new account.';
        } else if (errorCode.includes('invalid-email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (errorCode.includes('too-many-requests')) {
          errorMessage = 'Too many password reset attempts. Please try again in a few minutes.';
        } else if (errorCode.includes('network-request-failed')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorCode.includes('internal-error')) {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [email, validateEmail, sendPasswordReset, navigation]);

  // Handle email input changes
  const handleEmailChange = useCallback((value) => {
    setEmail(value);
    
    // Clear errors when user starts typing
    if (fieldError) {
      setFieldError('');
    }
    if (error) {
      setError('');
    }
    if (emailSent) {
      setEmailSent(false);
    }
  }, [fieldError, error, emailSent]);

  // Handle back navigation
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Loading state from auth context or local loading
  const isLoading = loading || authLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && styles.scrollContentKeyboard
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Section */}
          <View style={[styles.header, keyboardVisible && styles.headerCompact]}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
              <MaterialIcons 
                name="lock-reset" 
                size={48} 
                color={theme.primary} 
              />
            </View>
            
            <Text style={[styles.title, { color: theme.text }, typography.h1]}>
              Reset Password
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }, typography.body1]}>
              Enter your registered email address and we'll send you a secure link to reset your password.
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            <Input
              ref={emailRef}
              label="Email Address"
              placeholder="Enter your registered email"
              value={email}
              onChangeText={handleEmailChange}
              error={fieldError}
              leftIcon="email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={handleReset}
              maxLength={254}
              testID="forgot-password-email-input"
            />

            <Button
              title={emailSent ? "Resend Reset Link" : "Send Reset Link"}
              onPress={handleReset}
              loading={isLoading}
              disabled={isLoading || !email.trim()}
              style={styles.resetButton}
              accessibilityLabel={emailSent ? "Resend password reset email" : "Send password reset email"}
              testID="send-reset-button"
            />

            {/* Success Message */}
            {emailSent && !error && (
              <View style={styles.successContainer}>
                <MaterialIcons 
                  name="check-circle" 
                  size={20} 
                  color={theme.success || theme.primary} 
                  style={styles.successIcon}
                />
                <Text style={[styles.successText, { color: theme.success || theme.primary }, typography.body2]}>
                  Reset email sent successfully! Please check your inbox.
                </Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <MaterialIcons 
                  name="error-outline" 
                  size={20} 
                  color={theme.error} 
                  style={styles.errorIcon}
                />
                <Text style={[styles.errorText, { color: theme.error }, typography.body2]}>
                  {error}
                </Text>
              </View>
            )}
          </View>

          {/* Help Section */}
          <View style={styles.helpSection}>
            <View style={styles.helpItem}>
              <MaterialIcons 
                name="info-outline" 
                size={18} 
                color={theme.primary} 
                style={styles.helpIcon}
              />
              <Text style={[styles.helpText, { color: theme.textSecondary }, typography.caption]}>
                Check your spam folder if you don't see the email
              </Text>
            </View>
            
            <View style={styles.helpItem}>
              <MaterialIcons 
                name="schedule" 
                size={18} 
                color={theme.primary} 
                style={styles.helpIcon}
              />
              <Text style={[styles.helpText, { color: theme.textSecondary }, typography.caption]}>
                The reset link will expire in 24 hours
              </Text>
            </View>
          </View>

          {/* Footer Section */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }, typography.body2]}>
              Remember your password?
            </Text>
            <Button
              title="Back to Sign In"
              variant="ghost"
              onPress={handleGoBack}
              disabled={isLoading}
              style={styles.backButton}
              accessibilityLabel="Go back to sign in screen"
              testID="back-to-signin-button"
            />
          </View>

          {/* Security Info */}
          <View style={styles.securityInfo}>
            <MaterialIcons 
              name="verified-user" 
              size={16} 
              color={theme.success || theme.primary} 
              style={styles.securityIcon}
            />
            <Text style={[styles.securityText, { color: theme.textSecondary }, typography.caption]}>
              Password reset secured by Firebase Authentication
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  scrollContentKeyboard: {
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerCompact: {
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: 32,
  },
  resetButton: {
    marginTop: 24,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // Light green background
  },
  successIcon: {
    marginRight: 8,
  },
  successText: {
    flex: 1,
    textAlign: 'left',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.1)', // Light red background
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    textAlign: 'left',
    lineHeight: 20,
  },
  helpSection: {
    marginBottom: 32,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpIcon: {
    marginRight: 12,
  },
  helpText: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  securityIcon: {
    marginRight: 6,
  },
  securityText: {
    textAlign: 'center',
  },
});
