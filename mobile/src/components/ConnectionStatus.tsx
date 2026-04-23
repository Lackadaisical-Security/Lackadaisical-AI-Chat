import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';

/**
 * Compact connection status banner — shows at the top of screens.
 * Only visible when disconnected or when Ollama is unavailable.
 */
export default function ConnectionStatus() {
  const { isConnected, ollamaAvailable, latencyMs, connectionError } = useAppStore();

  // Hidden when everything is fine
  if (isConnected && ollamaAvailable) return null;

  const color = isConnected ? '#f59e0b' : '#ef4444';
  const bg = isConnected ? '#2d1f00' : '#2d0f0f';
  const icon = isConnected ? 'warning-outline' : 'cloud-offline-outline';
  const text = isConnected
    ? 'Ollama is offline — chat unavailable'
    : connectionError ?? 'Backend disconnected';

  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {text}
        {isConnected && latencyMs != null ? ` (${latencyMs}ms)` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  text: { fontSize: 12, flex: 1 },
});
