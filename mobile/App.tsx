import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppStore } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const loadSettings = useAppStore((s) => s.loadSettings);
  const theme = useAppStore((s) => s.settings.theme);

  // Load persisted settings on startup
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        <AppNavigator />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
