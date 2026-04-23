import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';
import { api } from '../services/api';
import { ChatSession } from '../types';

export default function SessionsScreen() {
  const { sessions, currentSession, setCurrentSession, setSessions, addSession, removeSession, clearMessages, settings } =
    useAppStore();
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.getSessions();
      if (res.success && res.data) setSessions(res.data);
    } catch {}
    setLoading(false);
  };

  const handleCreateSession = async () => {
    const name = `Chat ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    try {
      const res = await api.createSession(name);
      if (res.success && res.data) {
        addSession(res.data);
        setCurrentSession(res.data);
        clearMessages();
        if (settings.hapticFeedback) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const handleSelectSession = useCallback(
    async (session: ChatSession) => {
      setCurrentSession(session);
      clearMessages();
      // Load history
      try {
        const res = await api.getConversationHistory(session.id, 50);
        if (res.success && res.data) {
          useAppStore.getState().setMessages(res.data);
        }
      } catch {}
      if (settings.hapticFeedback) Haptics.selectionAsync();
    },
    [settings.hapticFeedback]
  );

  const handleDeleteSession = useCallback(
    (session: ChatSession) => {
      Alert.alert('Delete Session', `Delete "${session.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteSession(session.id);
              removeSession(session.id);
              if (settings.hapticFeedback)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]);
    },
    [settings.hapticFeedback]
  );

  const renderSession = useCallback(
    ({ item }: { item: ChatSession }) => {
      const isActive = item.id === currentSession?.id;
      return (
        <TouchableOpacity
          style={[styles.sessionItem, isActive && styles.sessionItemActive]}
          onPress={() => handleSelectSession(item)}
          onLongPress={() => handleDeleteSession(item)}
        >
          <View style={styles.sessionIcon}>
            <Ionicons
              name={isActive ? 'chatbubbles' : 'chatbubbles-outline'}
              size={20}
              color={isActive ? '#7c3aed' : '#64748b'}
            />
          </View>
          <View style={styles.sessionInfo}>
            <Text style={[styles.sessionName, isActive && styles.sessionNameActive]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.sessionDate}>
              {new Date(item.updated_at ?? item.created_at).toLocaleDateString()}
            </Text>
          </View>
          {isActive && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [currentSession, handleSelectSession, handleDeleteSession]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sessions</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={fetchSessions} style={styles.headerBtn}>
            <Ionicons name="refresh" size={20} color="#7c3aed" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCreateSession} style={styles.newBtn}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#7c3aed" style={{ marginTop: 32 }} />
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="albums-outline" size={48} color="#2d3148" />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>Tap "New" to start your first conversation</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
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
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerBtn: { padding: 8 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  list: { padding: 12, gap: 8 },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1d2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  sessionItemActive: { borderColor: '#7c3aed', backgroundColor: '#1e1230' },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: { flex: 1 },
  sessionName: { color: '#cbd5e1', fontSize: 14, fontWeight: '500' },
  sessionNameActive: { color: '#e2e8f0', fontWeight: '600' },
  sessionDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  activeBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  emptyText: { color: '#475569', fontSize: 13, textAlign: 'center' },
});
