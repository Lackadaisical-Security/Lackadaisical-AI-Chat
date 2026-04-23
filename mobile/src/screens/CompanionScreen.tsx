import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';
import { useConnectionHealth } from '../hooks/useConnectionHealth';
import { api } from '../services/api';
import ConnectionStatus from '../components/ConnectionStatus';

const MOOD_ICONS: Record<string, string> = {
  energy: '⚡',
  empathy: '❤️',
  humor: '😄',
  curiosity: '🔍',
  patience: '🕊️',
};

const QUICK_MESSAGES = [
  "How are you feeling today?",
  "Tell me something interesting",
  "I need some motivation",
  "What should I focus on?",
  "Let's brainstorm ideas",
];

export default function CompanionScreen() {
  useConnectionHealth(30000);

  const { personality, settings, setPersonality, isConnected, ollamaAvailable } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPersonality();
  }, []);

  const fetchPersonality = async () => {
    setLoading(true);
    try {
      const res = await api.getPersonality();
      if (res.success && res.data) setPersonality(res.data);
    } catch {
      // silent - backend may not be reachable
    } finally {
      setLoading(false);
    }
  };

  const handleResetPersonality = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.resetPersonality();
      if (res.success && res.data) setPersonality(res.data);
    } catch {}
  };

  const moodValue = (key: string) => {
    const mood = personality?.current_mood;
    if (!mood) return 50;
    return (mood as Record<string, number>)[key] ?? 50;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{settings.companionName}</Text>
          <Text style={styles.headerSub}>AI Companion</Text>
        </View>
        <TouchableOpacity onPress={fetchPersonality} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#7c3aed" />
        </TouchableOpacity>
      </View>

      <ConnectionStatus />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status banner */}
        <View style={[styles.banner, isConnected ? styles.bannerConnected : styles.bannerDisconnected]}>
          <Ionicons
            name={isConnected ? (ollamaAvailable ? 'checkmark-circle' : 'warning') : 'close-circle'}
            size={18}
            color={isConnected ? (ollamaAvailable ? '#22c55e' : '#f59e0b') : '#ef4444'}
          />
          <Text style={styles.bannerText}>
            {isConnected
              ? ollamaAvailable
                ? 'Connected · Ollama ready'
                : 'Connected · Ollama offline'
              : 'Disconnected from backend'}
          </Text>
        </View>

        {/* Companion card */}
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {settings.companionName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.companionName}>{settings.companionName}</Text>
              <Text style={styles.companionSub}>
                {personality
                  ? `v${personality.personality_version} · ${personality.total_interactions} interactions`
                  : 'Not loaded'}
              </Text>
            </View>
          </View>

          {/* Mood bars */}
          {loading ? (
            <ActivityIndicator color="#7c3aed" style={{ marginTop: 16 }} />
          ) : personality ? (
            <View style={styles.moodSection}>
              <Text style={styles.sectionTitle}>Current Mood</Text>
              {Object.keys(MOOD_ICONS).map((key) => {
                const val = moodValue(key);
                return (
                  <View key={key} style={styles.moodRow}>
                    <Text style={styles.moodLabel}>
                      {MOOD_ICONS[key]} {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                    <View style={styles.moodBarBg}>
                      <View style={[styles.moodBarFill, { width: `${val}%` as any }]} />
                    </View>
                    <Text style={styles.moodVal}>{val}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>Start a conversation to see mood data</Text>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={handleResetPersonality}>
            <Ionicons name="refresh-circle-outline" size={16} color="#94a3b8" />
            <Text style={styles.resetBtnText}>Reset Personality</Text>
          </TouchableOpacity>
        </View>

        {/* Quick messages */}
        <Text style={styles.sectionTitle}>Quick Messages</Text>
        {QUICK_MESSAGES.map((msg) => (
          <TouchableOpacity
            key={msg}
            style={styles.quickMsgBtn}
            onPress={() => {
              // Navigate to Chat with pre-filled message — using global store
              useAppStore.setState({ messages: [] });
            }}
          >
            <Text style={styles.quickMsgText}>{msg}</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3148',
    backgroundColor: '#1a1d2e',
  },
  headerTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#64748b', fontSize: 12 },
  refreshBtn: { padding: 8 },
  content: { padding: 16, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  bannerConnected: { backgroundColor: '#0f2d1a' },
  bannerDisconnected: { backgroundColor: '#2d0f0f' },
  bannerText: { color: '#e2e8f0', fontSize: 13 },
  card: {
    backgroundColor: '#1a1d2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  companionName: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  companionSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  moodSection: { gap: 10 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moodLabel: { color: '#cbd5e1', fontSize: 13, width: 90 },
  moodBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#2d3148',
    borderRadius: 3,
    overflow: 'hidden',
  },
  moodBarFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 3 },
  moodVal: { color: '#64748b', fontSize: 12, width: 24, textAlign: 'right' },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 8 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  resetBtnText: { color: '#94a3b8', fontSize: 13 },
  quickMsgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1d2e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  quickMsgText: { color: '#cbd5e1', fontSize: 14, flex: 1 },
});
