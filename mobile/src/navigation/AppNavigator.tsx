import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store';

import ChatScreen from '../screens/ChatScreen';
import CompanionScreen from '../screens/CompanionScreen';
import SessionsScreen from '../screens/SessionsScreen';
import JournalScreen from '../screens/JournalScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Companion: undefined;
  Chat: undefined;
  Sessions: undefined;
  Journal: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const DARK_THEME = {
  dark: true,
  colors: {
    primary: '#7c3aed',
    background: '#0f1117',
    card: '#1a1d2e',
    text: '#e2e8f0',
    border: '#2d3148',
    notification: '#7c3aed',
  },
};

const LIGHT_THEME = {
  dark: false,
  colors: {
    primary: '#7c3aed',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#1e293b',
    border: '#e2e8f0',
    notification: '#7c3aed',
  },
};

export default function AppNavigator() {
  const colorScheme = useColorScheme();
  const theme = useAppStore((s) => s.settings.theme);
  const isDark =
    theme === 'dark' ? true : theme === 'light' ? false : colorScheme === 'dark';

  const navTheme = isDark ? DARK_THEME : LIGHT_THEME;
  const tabBarBg = isDark ? '#1a1d2e' : '#ffffff';
  const tabBarBorder = isDark ? '#2d3148' : '#e2e8f0';
  const inactiveColor = isDark ? '#64748b' : '#94a3b8';

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: tabBarBg,
            borderTopColor: tabBarBorder,
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 60,
          },
          tabBarActiveTintColor: '#7c3aed',
          tabBarInactiveTintColor: inactiveColor,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
          tabBarIcon: ({ focused, color, size }) => {
            const icons: Record<string, [string, string]> = {
              Companion: ['heart', 'heart-outline'],
              Chat: ['chatbubbles', 'chatbubbles-outline'],
              Sessions: ['albums', 'albums-outline'],
              Journal: ['journal', 'journal-outline'],
              Settings: ['settings', 'settings-outline'],
            };
            const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
            return (
              <Ionicons
                name={(focused ? active : inactive) as any}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen name="Companion" component={CompanionScreen} />
        <Tab.Screen name="Chat" component={ChatScreen} />
        <Tab.Screen name="Sessions" component={SessionsScreen} />
        <Tab.Screen name="Journal" component={JournalScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
