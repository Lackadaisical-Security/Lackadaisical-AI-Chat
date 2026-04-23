import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';
import { api } from '../services/api';
import { JournalEntry } from '../types';

const MOODS = ['😊', '😐', '😔', '😤', '😰', '🥰', '🤔', '🎉'];

export default function JournalScreen() {
  const { journalEntries, settings, setJournalEntries, addJournalEntry, updateJournalEntry, removeJournalEntry } =
    useAppStore();

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState('😊');

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await api.getJournalEntries({ limit: 50 });
      if (res.success && res.data) setJournalEntries(res.data);
    } catch {}
    setLoading(false);
  };

  const openNewEntry = () => {
    setEditingEntry(null);
    setTitle('');
    setContent('');
    setSelectedMood('😊');
    setModalVisible(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setTitle(entry.title);
    setContent(entry.content);
    setSelectedMood(entry.mood ?? '😊');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Validation', 'Title and content are required');
      return;
    }

    try {
      if (editingEntry) {
        const res = await api.updateJournalEntry(editingEntry.id, {
          title: title.trim(),
          content: content.trim(),
          mood: selectedMood,
        });
        if (res.success && res.data) updateJournalEntry(editingEntry.id, res.data);
      } else {
        const res = await api.createJournalEntry({
          title: title.trim(),
          content: content.trim(),
          mood: selectedMood,
        });
        if (res.success && res.data) addJournalEntry(res.data);
      }
      setModalVisible(false);
      if (settings.hapticFeedback) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to save entry');
    }
  };

  const handleDelete = useCallback(
    (entry: JournalEntry) => {
      Alert.alert('Delete Entry', `Delete "${entry.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteJournalEntry(entry.id);
              removeJournalEntry(entry.id);
            } catch {
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]);
    },
    []
  );

  const renderEntry = useCallback(
    ({ item }: { item: JournalEntry }) => (
      <TouchableOpacity style={styles.entryCard} onPress={() => openEditEntry(item)}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryMood}>{item.mood ?? '📝'}</Text>
          <View style={styles.entryMeta}>
            <Text style={styles.entryTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.entryDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <Text style={styles.entryPreview} numberOfLines={2}>
          {item.content}
        </Text>
      </TouchableOpacity>
    ),
    [handleDelete]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={fetchEntries} style={styles.headerBtn}>
            <Ionicons name="refresh" size={20} color="#7c3aed" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openNewEntry} style={styles.newBtn}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#7c3aed" style={{ marginTop: 32 }} />
      ) : journalEntries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="journal-outline" size={48} color="#2d3148" />
          <Text style={styles.emptyTitle}>No journal entries yet</Text>
          <Text style={styles.emptyText}>Record your thoughts and feelings</Text>
        </View>
      ) : (
        <FlatList
          data={journalEntries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {/* New/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingEntry ? 'Edit Entry' : 'New Entry'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalContent}>
              {/* Mood selector */}
              <Text style={styles.label}>Mood</Text>
              <View style={styles.moodRow}>
                {MOODS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.moodBtn, selectedMood === m && styles.moodBtnActive]}
                    onPress={() => setSelectedMood(m)}
                  >
                    <Text style={styles.moodEmoji}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Entry title…"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Content</Text>
              <TextInput
                style={styles.contentInput}
                value={content}
                onChangeText={setContent}
                placeholder="Write your thoughts…"
                placeholderTextColor="#64748b"
                multiline
                textAlignVertical="top"
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  list: { padding: 12, gap: 10 },
  entryCard: {
    backgroundColor: '#1a1d2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2d3148',
    gap: 6,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryMood: { fontSize: 20 },
  entryMeta: { flex: 1 },
  entryTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  entryDate: { color: '#64748b', fontSize: 12 },
  deleteBtn: { padding: 4 },
  entryPreview: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  emptyText: { color: '#475569', fontSize: 13 },
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#0f1117' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3148',
  },
  modalCancel: { color: '#94a3b8', fontSize: 15 },
  modalTitle: { color: '#e2e8f0', fontSize: 17, fontWeight: '600' },
  modalSave: { color: '#7c3aed', fontSize: 15, fontWeight: '600' },
  modalContent: { flex: 1, padding: 16, gap: 12 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  moodBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1d2e',
    borderWidth: 2,
    borderColor: '#2d3148',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodBtnActive: { borderColor: '#7c3aed', backgroundColor: '#1e1230' },
  moodEmoji: { fontSize: 20 },
  titleInput: {
    backgroundColor: '#1a1d2e',
    borderRadius: 10,
    padding: 12,
    color: '#e2e8f0',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2d3148',
    marginBottom: 8,
  },
  contentInput: {
    backgroundColor: '#1a1d2e',
    borderRadius: 10,
    padding: 12,
    color: '#e2e8f0',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2d3148',
    flex: 1,
    minHeight: 200,
  },
});
