import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../styles/typography';

export default function SecurityScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView>
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }, typography.h3]}>
            Encryption
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }, typography.body2]}>
            Your messages are secured with end-to-end encryption
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }, typography.h3]}>
            Security Settings
          </Text>
          
          <View style={styles.settingItem}>
            <Text style={[{ color: theme.text }, typography.body1]}>
              Two-Factor Authentication
            </Text>
            <Switch value={false} />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={[{ color: theme.text }, typography.body1]}>
              Biometric Lock
            </Text>
            <Switch value={false} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
});
