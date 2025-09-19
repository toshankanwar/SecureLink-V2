// screens/auth/LoginScreen.js
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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Context and services
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import FirebaseService from '../../services/firebase';

// Components
import Button from '../../components/common/Button';

// Styles and constants
import { typography } from '../../styles/typography';
import { ROUTES } from '../../utils/constants';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { 
    signInWithEmail, 
    loading: authLoading, 
    error: authError, 
    isAuthenticated,
    sessionRestored 
  } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Form state
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Refs for input focus management
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load saved email if remember me was enabled
  useEffect(() => {
    loadSavedCredentials();
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

  // Load saved credentials
  const loadSavedCredentials = useCallback(async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('remembered_email');
      const shouldRemember = await AsyncStorage.getItem('remember_me');
      
      if (savedEmail && shouldRemember === 'true') {
        setFormData(prev => ({ ...prev, email: savedEmail }));
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  }, []);

  // Save credentials if remember me is enabled
  const saveCredentials = useCallback(async () => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('remembered_email', formData.email.trim().toLowerCase());
        await AsyncStorage.setItem('remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('remembered_email');
        await AsyncStorage.removeItem('remember_me');
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  }, [formData.email, rememberMe]);

  // Form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle login with session persistence
  const handleLogin = useCallback(async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    Keyboard.dismiss();

    try {
      // Save credentials if remember me is enabled
      await saveCredentials();

      const result = await signInWithEmail(
        formData.email.trim().toLowerCase(),
        formData.password
      );

      if (result && result.user) {
        // Check email verification
        if (result.needsEmailVerification && !result.user.emailVerified) {
          Alert.alert(
            'Email Verification Required',
            'Please verify your email address to continue. Check your email for the verification link.',
            [
              {
                text: 'Resend Email',
                onPress: async () => {
                  try {
                    await FirebaseService.sendEmailVerification();
                    Alert.alert('Success', 'Verification email sent successfully!');
                  } catch (error) {
                    Alert.alert('Error', 'Failed to send verification email. Please try again.');
                  }
                }
              },
              { text: 'OK', style: 'default' }
            ]
          );
          setLoading(false);
          return;
        }

        console.log('✅ Login successful:', result.user.uid);
        
        // Store login session locally
        await AsyncStorage.setItem('user_logged_in', 'true');
        await AsyncStorage.setItem('last_login', new Date().toISOString());
        
        // Navigation is handled automatically by AuthContext
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, signInWithEmail, saveCredentials]);

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

  // Navigation handlers
  const handleForgotPassword = useCallback(() => {
    navigation.navigate(ROUTES.FORGOT_PASSWORD);
  }, [navigation]);

  const handleCreateAccount = useCallback(() => {
    navigation.navigate(ROUTES.REGISTER);
  }, [navigation]);

  // Focus next input
  const focusPasswordInput = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  // Toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // Toggle remember me
  const toggleRememberMe = useCallback(() => {
    setRememberMe(prev => !prev);
  }, []);

  // Loading state from auth context or local loading
  const isLoading = loading || authLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={isDark 
          ? ['#1a1a1a', '#2d2d2d', '#1a1a1a'] 
          : [theme.primary + '10', theme.background, theme.primary + '05']
        }
        style={styles.backgroundGradient}
      />

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
          {/* Animated Header Section */}
          <Animated.View 
            style={[
              styles.header, 
              keyboardVisible && styles.headerCompact,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            {/* Logo Container with Glow Effect */}
            <View style={styles.logoWrapper}>
              <BlurView intensity={20} style={styles.logoBlur}>
                <LinearGradient
                  colors={[theme.primary, theme.primary + '80', theme.primary]}
                  style={styles.logoContainer}
                >
                  <MaterialIcons 
                    name="security" 
                    size={56} 
                    color="#FFFFFF" 
                  />
                </LinearGradient>
              </BlurView>
              <View style={[styles.logoGlow, { backgroundColor: theme.primary + '30' }]} />
            </View>
            
            {/* Welcome Text */}
            <Text style={[styles.welcomeTitle, { color: theme.text }, typography.h1]}>
              Welcome Back
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }, typography.body1]}>
              Sign in to your SecureLink account
            </Text>

            {/* Session Restored Indicator */}
            {sessionRestored && (
              <View style={[styles.sessionIndicator, { backgroundColor: theme.success + '20' }]}>
                <MaterialIcons name="check-circle" size={16} color={theme.success} />
                <Text style={[styles.sessionText, { color: theme.success }]}>
                  Session restored automatically
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Form Section */}
          <Animated.View 
            style={[
              styles.formCard,
              { backgroundColor: theme.surface },
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Email Address
              </Text>
              <View style={[styles.inputContainer, { borderColor: formErrors.email ? theme.error : theme.border }]}>
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
                  onSubmitEditing={focusPasswordInput}
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
              <View style={[styles.inputContainer, { borderColor: formErrors.password ? theme.error : theme.border }]}>
                <MaterialIcons 
                  name="lock" 
                  size={20} 
                  color={formErrors.password ? theme.error : theme.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
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
              {formErrors.password && (
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {formErrors.password}
                </Text>
              )}
            </View>

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={toggleRememberMe}
                disabled={isLoading}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: theme.border },
                  rememberMe && { backgroundColor: theme.primary, borderColor: theme.primary }
                ]}>
                  {rememberMe && (
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.rememberMeText, { color: theme.textSecondary }]}>
                  Remember me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={isLoading}
                style={styles.forgotPasswordButton}
              >
                <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: theme.error + '10' }]}>
                <MaterialIcons 
                  name="error-outline" 
                  size={20} 
                  color={theme.error} 
                />
                <Text style={[styles.errorMessage, { color: theme.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.signInButton,
                { backgroundColor: isLoading ? theme.primary + '80' : theme.primary },
                (!formData.email.trim() || !formData.password.trim() || isLoading) && { backgroundColor: theme.border }
              ]}
              onPress={handleLogin}
              disabled={isLoading || !formData.email.trim() || !formData.password.trim()}
            >
              <LinearGradient
                colors={isLoading ? [theme.primary + '80', theme.primary + '60'] : [theme.primary, theme.primary + 'DD']}
                style={styles.signInButtonGradient}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <MaterialIcons name="hourglass-empty" size={20} color="#FFFFFF" />
                    <Text style={styles.signInButtonText}>Signing In...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.signInButtonText}>Sign In</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer Section */}
          <Animated.View 
            style={[
              styles.footer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
                New to SecureLink?
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              style={[styles.createAccountButton, { borderColor: theme.primary }]}
              onPress={handleCreateAccount}
              disabled={isLoading}
            >
              <Text style={[styles.createAccountText, { color: theme.primary }]}>
                Create New Account
              </Text>
              <MaterialIcons name="person-add" size={20} color={theme.primary} />
            </TouchableOpacity>

            {/* Security Badge */}
            <View style={styles.securityBadge}>
              <MaterialIcons 
                name="verified-user" 
                size={16} 
                color={theme.success || theme.primary} 
              />
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
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
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
  logoWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  logoBlur: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -10,
    left: -10,
    zIndex: -1,
    opacity: 0.3,
  },
  welcomeTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '800',
    fontSize: 32,
  },
  welcomeSubtitle: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.8,
  },
  sessionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  sessionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  formCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    elevation: 4,
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
    backgroundColor: 'rgba(0,0,0,0.02)',
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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberMeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPasswordButton: {
    padding: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
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
  signInButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  signInButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
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
  createAccountButton: {
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
  createAccountText: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    width: '100%',
    justifyContent: 'center',
  },
  securityText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
});
