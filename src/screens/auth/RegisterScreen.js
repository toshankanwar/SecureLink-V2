// screens/auth/RegisterScreen.js
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
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Context and services
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import FirebaseService from '../../services/firebase';

// Styles and constants
import { typography } from '../../styles/typography';
import { ROUTES } from '../../utils/constants';

const { width } = Dimensions.get('window');

export default function RegisterScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { signUpWithEmail, signInWithEmail, loading: authLoading, error: authError } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Refs for input focus management
  const displayNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // Initialize animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  // Enhanced form validation
  const validateForm = useCallback(() => {
    const errors = {};

    // Display name validation
    if (!formData.displayName.trim()) {
      errors.displayName = 'Display name is required';
    } else if (formData.displayName.trim().length < 2) {
      errors.displayName = 'Display name must be at least 2 characters';
    } else if (formData.displayName.trim().length > 50) {
      errors.displayName = 'Display name must be less than 50 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.displayName.trim())) {
      errors.displayName = 'Display name can only contain letters and spaces';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Confirm password validation
    if (!formData.confirmPassword.trim()) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle registration with automatic login and session persistence
  const handleRegister = useCallback(async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      // Step 1: Register the user
      const registerResult = await signUpWithEmail(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.displayName.trim()
      );

      if (registerResult && registerResult.user) {
        console.log('✅ Registration successful:', registerResult.user.uid);

        // Step 2: Automatically sign in the user for session persistence
        try {
          const signInResult = await signInWithEmail(
            formData.email.trim().toLowerCase(),
            formData.password
          );

          if (signInResult && signInResult.user) {
            // Step 3: Store session data for persistence
            await AsyncStorage.setItem('user_logged_in', 'true');
            await AsyncStorage.setItem('registration_completed', 'true');
            await AsyncStorage.setItem('last_login', new Date().toISOString());
            
            console.log('✅ User automatically logged in after registration');

            // Step 4: Show success message and navigate
            Alert.alert(
              '🎉 Welcome to SecureLink!',
              `Hi ${formData.displayName.trim()}! Your account has been created successfully. ${registerResult.needsEmailVerification ? 'Please verify your email when convenient.' : ''}`,
              [
                registerResult.needsEmailVerification ? {
                  text: 'Send Verification Email',
                  onPress: async () => {
                    try {
                      await FirebaseService.sendEmailVerification();
                      Alert.alert('✅ Success', 'Verification email sent to your inbox!');
                    } catch (error) {
                      console.error('Error sending verification email:', error);
                    }
                  }
                } : null,
                {
                  text: 'Get Started',
                  style: 'default',
                  onPress: () => {
                    // Clear form
                    setFormData({
                      displayName: '',
                      email: '',
                      password: '',
                      confirmPassword: '',
                    });
                    
                    // User is automatically navigated by AuthContext
                    console.log('🚀 User ready to use the app');
                  }
                }
              ].filter(Boolean)
            );
          }
        } catch (autoSignInError) {
          console.log('⚠️ Auto sign-in failed, user can sign in manually:', autoSignInError.message);
          
          // If auto sign-in fails, show success and redirect to login
          Alert.alert(
            '✅ Registration Successful!',
            'Your account has been created successfully. Please sign in to continue.',
            [
              {
                text: 'Sign In Now',
                onPress: () => {
                  setFormData({
                    displayName: '',
                    email: formData.email, // Keep email for easy sign in
                    password: '',
                    confirmPassword: '',
                  });
                  navigation.navigate(ROUTES.LOGIN);
                }
              }
            ]
          );
        }
      }
    } catch (err) {
      console.error('❌ Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, signUpWithEmail, signInWithEmail, navigation]);

  // Handle input changes
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors when user types
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
    
    // Clear general error
    if (error) {
      setError('');
    }
  }, [formErrors, error]);

  // Focus management functions
  const focusEmail = useCallback(() => emailRef.current?.focus(), []);
  const focusPassword = useCallback(() => passwordRef.current?.focus(), []);
  const focusConfirmPassword = useCallback(() => confirmPasswordRef.current?.focus(), []);

  // Toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword(prev => !prev);
  }, []);

  // Navigation handlers
  const handleSignIn = useCallback(() => {
    navigation.navigate(ROUTES.LOGIN);
  }, [navigation]);

  // Check if form is ready for submission
  const isFormReady = formData.displayName.trim() && 
                     formData.email.trim() && 
                     formData.password.trim() && 
                     formData.confirmPassword.trim() &&
                     Object.keys(formErrors).length === 0;

  // Loading state
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
          <Animated.View 
            style={[
              styles.header, 
              keyboardVisible && styles.headerCompact,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Logo */}
            <View style={[styles.logoContainer, { backgroundColor: theme.primary }]}>
              <MaterialIcons name="person-add" size={56} color="#FFFFFF" />
            </View>
            
            {/* Welcome Text */}
            <Text style={[styles.welcomeTitle, { color: theme.text }]}>
              Create Account
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
              Join SecureLink for secure messaging
            </Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View 
            style={[
              styles.formCard,
              { 
                backgroundColor: theme.surface || theme.background,
                borderColor: theme.border,
              },
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Display Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Display Name
              </Text>
              <View style={[
                styles.inputContainer, 
                { 
                  borderColor: formErrors.displayName ? theme.error : theme.border,
                  backgroundColor: theme.inputBackground || 'rgba(0,0,0,0.02)'
                }
              ]}>
                <MaterialIcons 
                  name="person" 
                  size={20} 
                  color={formErrors.displayName ? theme.error : theme.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={displayNameRef}
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.displayName}
                  onChangeText={(value) => handleInputChange('displayName', value)}
                  autoCapitalize="words"
                  autoComplete="name"
                  autoCorrect={false}
                  maxLength={50}
                  returnKeyType="next"
                  onSubmitEditing={focusEmail}
                  editable={!isLoading}
                />
              </View>
              {formErrors.displayName && (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {formErrors.displayName}
                </Text>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Email Address
              </Text>
              <View style={[
                styles.inputContainer, 
                { 
                  borderColor: formErrors.email ? theme.error : theme.border,
                  backgroundColor: theme.inputBackground || 'rgba(0,0,0,0.02)'
                }
              ]}>
                <MaterialIcons 
                  name="email" 
                  size={20} 
                  color={formErrors.email ? theme.error : theme.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailRef}
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={focusPassword}
                  editable={!isLoading}
                />
              </View>
              {formErrors.email && (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {formErrors.email}
                </Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Password
              </Text>
              <View style={[
                styles.inputContainer, 
                { 
                  borderColor: formErrors.password ? theme.error : theme.border,
                  backgroundColor: theme.inputBackground || 'rgba(0,0,0,0.02)'
                }
              ]}>
                <MaterialIcons 
                  name="lock" 
                  size={20} 
                  color={formErrors.password ? theme.error : theme.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Create a strong password"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={focusConfirmPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={togglePasswordVisibility}
                  style={styles.passwordToggle}
                  disabled={isLoading}
                >
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {formErrors.password ? (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {formErrors.password}
                </Text>
              ) : (
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                  Must contain uppercase, lowercase, and number
                </Text>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Confirm Password
              </Text>
              <View style={[
                styles.inputContainer, 
                { 
                  borderColor: formErrors.confirmPassword ? theme.error : theme.border,
                  backgroundColor: theme.inputBackground || 'rgba(0,0,0,0.02)'
                }
              ]}>
                <MaterialIcons 
                  name="lock" 
                  size={20} 
                  color={formErrors.confirmPassword ? theme.error : theme.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={confirmPasswordRef}
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleInputChange('confirmPassword', value)}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={toggleConfirmPasswordVisibility}
                  style={styles.passwordToggle}
                  disabled={isLoading}
                >
                  <MaterialIcons
                    name={showConfirmPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {formErrors.confirmPassword && (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {formErrors.confirmPassword}
                </Text>
              )}
            </View>

            {/* Error Message */}
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: theme.error + '10' }]}>
                <MaterialIcons name="error-outline" size={18} color={theme.error} />
                <Text style={[styles.errorMessage, { color: theme.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Create Account Button */}
            <TouchableOpacity
              style={[
                styles.createAccountButton,
                { 
                  backgroundColor: isLoading || !isFormReady
                    ? theme.border 
                    : theme.primary 
                }
              ]}
              onPress={handleRegister}
              disabled={isLoading || !isFormReady}
            >
              <View style={styles.buttonContent}>
                {isLoading ? (
                  <>
                    <MaterialIcons name="hourglass-empty" size={20} color="#FFFFFF" />
                    <Text style={styles.createAccountButtonText}>Creating Account...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.createAccountButtonText}>Create Account</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer Section */}
          <Animated.View 
            style={[
              styles.footer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
                Already have an account?
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <TouchableOpacity
              style={[styles.signInButton, { borderColor: theme.primary }]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              <MaterialIcons name="login" size={20} color={theme.primary} />
              <Text style={[styles.signInButtonText, { color: theme.primary }]}>
                Sign In Instead
              </Text>
            </TouchableOpacity>

            {/* Terms and Privacy */}
            <View style={styles.termsContainer}>
              <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                By creating an account, you agree to our{'\n'}
                <Text style={{ color: theme.primary, fontWeight: '600' }}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={{ color: theme.primary, fontWeight: '600' }}>Privacy Policy</Text>
              </Text>
            </View>

            {/* Security Badge */}
            <View style={[styles.securityBadge, { borderTopColor: theme.border }]}>
              <MaterialIcons name="verified-user" size={16} color={theme.success || theme.primary} />
              <Text style={[styles.securityText, { color: theme.textSecondary }]}>
                Secured with Firebase Authentication
              </Text>
            </View>
          </Animated.View>
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
    marginBottom: 32,
  },
  headerCompact: {
    marginBottom: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  passwordToggle: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorMessage: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  createAccountButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  footer: {
    alignItems: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 24,
    width: '100%',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  termsContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  termsText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    width: '100%',
    justifyContent: 'center',
  },
  securityText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
});
