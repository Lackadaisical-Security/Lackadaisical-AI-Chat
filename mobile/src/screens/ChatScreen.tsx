import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { useConnectionHealth } from '../hooks/useConnectionHealth';
import { api } from '../services/api';
import { Message } from '../types';
import MessageBubble from '../components/MessageBubble';
import ConnectionStatus from '../components/ConnectionStatus';

const AVAILABLE_MODELS = [
  { id: 'gemma3:4b', label: 'Gemma 3 4B' },
  { id: 'gemma4:e4b', label: 'Gemma 4 E4B' },
  { id: 'gpt-oss:20b', label: 'GPT-OSS 20B' },
  { id: 'llama3.3:latest', label: 'Llama 3.3' },
  { id: 'mistral:latest', label: 'Mistral 7B' },
  { id: 'codellama:latest', label: 'Code Llama' },
  { id: 'phi4:latest', label: 'Phi-4' },
];

export default function ChatScreen() {
  useConnectionHealth(30000);

  const {
    messages,
    currentSession,
    isStreaming,
    isLoading,
    settings,
    addMessage,
    updateAssistantMessage,
    setCurrentSession,
    setIsLoading,
    setIsStreaming,
  } = useAppStore();

  const [inputText, setInputText] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const { startStreaming, stopStreaming } = useStreamingResponse({
    onError: (err) => {
      Alert.alert('Error', err);
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Ensure we have a session on mount
  useEffect(() => {
    if (!currentSession) {
      api
        .createSession('Chat ' + new Date().toLocaleDateString())
        .then((res) => {
          if (res.success && res.data) setCurrentSession(res.data);
        })
        .catch(() => {});
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading || isStreaming) return;

    setInputText('');
    if (settings.hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const sessionId = currentSession?.id ?? 'default';

    // Add user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);

    // Placeholder assistant message
    const assistantId = `a-${Date.now() + 1}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    addMessage(assistantMsg);
    setIsLoading(true);

    if (settings.streamingEnabled) {
      setIsStreaming(true);
      try {
        await startStreaming(text, sessionId, {
          model: settings.selectedModel,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          useUncensored: settings.useUncensored,
        });
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
      }
    } else {
      try {
        const result = await api.sendMessage(text, sessionId, {
          model: settings.selectedModel,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          useUncensored: settings.useUncensored,
        });
        if (result.success && result.data) {
          updateAssistantMessage(assistantId, result.data.content);
        }
      } catch (err) {
        updateAssistantMessage(assistantId, '⚠️ Failed to get a response. Check connection.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [inputText, isLoading, isStreaming, settings, currentSession]);

  const handleCopyMessage = useCallback(async (content: string) => {
    await Clipboard.setStringAsync(content);
    if (settings.hapticFeedback) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [settings.hapticFeedback]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Clear Chat', 'Delete all messages in this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          if (currentSession?.id) {
            await api.deleteConversationHistory(currentSession.id).catch(() => {});
          }
          useAppStore.getState().clearMessages();
        },
      },
    ]);
  }, [currentSession]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} onCopy={handleCopyMessage} />
    ),
    [handleCopyMessage]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{currentSession?.name ?? 'Chat'}</Text>
          <Text style={styles.headerSub}>
            {messages.length} messages · {settings.selectedModel}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowModelPicker((v) => !v)}
          >
            <Ionicons name="hardware-chip-outline" size={20} color="#7c3aed" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleClearChat}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Model picker */}
      {showModelPicker && (
        <View style={styles.modelPicker}>
          {AVAILABLE_MODELS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.modelItem,
                settings.selectedModel === m.id && styles.modelItemActive,
              ]}
              onPress={() => {
                useAppStore.getState().updateSettings({ selectedModel: m.id });
                setShowModelPicker(false);
              }}
            >
              <Text
                style={[
                  styles.modelItemText,
                  settings.selectedModel === m.id && styles.modelItemTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ConnectionStatus />

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Loading indicator */}
      {isLoading && !isStreaming && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      )}

      {/* Input area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Message ${settings.companionName}…`}
            placeholderTextColor="#64748b"
            multiline
            maxLength={10000}
            returnKeyType="default"
          />
          {isStreaming ? (
            <TouchableOpacity style={styles.stopBtn} onPress={stopStreaming}>
              <Ionicons name="stop-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 8 },
  modelPicker: {
    backgroundColor: '#1a1d2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3148',
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modelItem: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#2d3148',
  },
  modelItemActive: { backgroundColor: '#7c3aed' },
  modelItemText: { color: '#94a3b8', fontSize: 12 },
  modelItemTextActive: { color: '#ffffff' },
  messageList: { padding: 12, gap: 8, paddingBottom: 8 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: { color: '#64748b', fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#2d3148',
    backgroundColor: '#1a1d2e',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f1117',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#e2e8f0',
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#3d2e72', opacity: 0.5 },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
