// navigation/ChatStack.js
import React, { useCallback } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screen imports
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import SettingsScreen from '../screens/chat/SettingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SecurityScreen from '../screens/profile/SecurityScreen';
import AddContactScreen from '../screens/contacts/AddContactScreen';

// Context and constants
import { useTheme } from '../context/ThemeContext';
import { ROUTES } from '../utils/constants';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Memoized Tab Navigator for better performance
const TabNavigator = React.memo(() => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          height: Platform.OS === 'ios' ? 80 + insets.bottom : 65,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.iconSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          
          switch (route.name) {
            case 'ChatsTab':
              iconName = focused ? 'chat' : 'chat-bubble-outline';
              break;
            case 'SettingsTab':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return (
            <MaterialIcons 
              name={iconName} 
              size={size} 
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="ChatsTab"
        component={ChatListScreen}
        options={{
          title: 'Chats',
          tabBarAccessibilityLabel: 'Chats tab',
          tabBarTestID: 'chats-tab',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarTestID: 'settings-tab',
        }}
      />
    </Tab.Navigator>
  );
});

TabNavigator.displayName = 'TabNavigator';

// Main Chat Stack Navigator
export default function ChatStack() {
  const { theme } = useTheme();

  // Memoized header right component for better performance
  const renderChatHeaderRight = useCallback((navigation, route) => {
    const handleOptionsPress = () => {
      // You can navigate to a options screen or show action sheet
      navigation.navigate('ChatOptions', {
        contactId: route.params?.contactId,
        contactName: route.params?.contactName,
      });
    };

    return (
      <TouchableOpacity
        onPress={handleOptionsPress}
        style={{
          marginRight: 15,
          padding: 8,
          borderRadius: 20,
        }}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Chat options"
        accessibilityHint="Opens chat settings and options"
        testID="chat-options-button"
      >
        <MaterialIcons 
          name="more-vert" 
          size={24} 
          color={theme.textOnPrimary} 
        />
      </TouchableOpacity>
    );
  }, [theme.textOnPrimary]);

  // Memoized screen options for better performance
  const stackScreenOptions = {
    headerStyle: {
      backgroundColor: theme.primary,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    headerTintColor: theme.textOnPrimary,
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 18,
    },
    headerBackTitleVisible: false,
    gestureEnabled: Platform.OS === 'ios',
    cardStyleInterpolator: Platform.OS === 'android' 
      ? ({ current, layouts }) => ({
          cardStyle: {
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [layouts.screen.width, 0],
                }),
              },
            ],
          },
        })
      : undefined,
  };

  return (
    <Stack.Navigator
      screenOptions={stackScreenOptions}
      initialRouteName="MainTabs"
    >
      {/* Main Tab Navigator */}
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{
          headerShown: false,
        }}
      />

      {/* Chat Room Screen */}
      <Stack.Screen
        name={ROUTES.CHAT_ROOM}
        component={ChatRoomScreen}
        options={({ navigation, route }) => ({
          title: route.params?.contactName || route.params?.displayName || 'Chat',
          headerRight: () => renderChatHeaderRight(navigation, route),
          headerBackTitle: 'Back',
          gestureResponseDistance: Platform.OS === 'ios' ? 100 : 50,
        })}
      />

      {/* Profile Screen */}
      <Stack.Screen
        name={ROUTES.PROFILE}
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerBackTitle: 'Back',
        }}
      />

      {/* Security Screen */}
      <Stack.Screen
        name="SecurityScreen"
        component={SecurityScreen}
        options={{
          title: 'Security',
          headerBackTitle: 'Back',
        }}
      />

      {/* Add Contact Screen */}
      <Stack.Screen
        name={ROUTES.CONTACT_ID_ENTRY || 'AddContact'}
        component={AddContactScreen}
        options={({ navigation }) => ({
          title: 'Add Contact',
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('ContactsHelp')}
              style={{
                marginRight: 15,
                padding: 8,
                borderRadius: 20,
              }}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Contact help"
              accessibilityHint="Shows help for adding contacts"
            >
              <MaterialIcons 
                name="help-outline" 
                size={22} 
                color={theme.textOnPrimary} 
              />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Chat Options Screen (Optional) */}
      <Stack.Screen
        name="ChatOptions"
        component={SettingsScreen} // Replace with actual ChatOptions component
        options={{
          title: 'Chat Options',
          headerBackTitle: 'Back',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
    </Stack.Navigator>
  );
}

// Export TabNavigator for reuse if needed
export { TabNavigator };
