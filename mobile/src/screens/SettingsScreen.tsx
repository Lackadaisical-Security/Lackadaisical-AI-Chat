import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store';
import { getApiService } from '../services/api';
import { UserSettings } from '../types';

const AI_MODELS = [
  { id: 'gemma3:4b', label: 'Gemma 3 4B', provider: 'ollama' },
  { id: 'gemma4:e4b', label: 'Gemma 4 E4B', provider: 'ollama' },
  { id: 'gpt-oss:20b', label: 'GPT-OSS 20B', provider: 'ollama' },
  { id: 'llama3.3:latest', label: 'Llama 3.3', provider: 'ollama' },
  { id: 'mistral:latest', label: 'Mistral 7B', provider: 'ollama' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google' },
];

type SettingSection = {
  title: string;
  items: Array<{
    key: keyof UserSettings;
    label: string;
    type: 'text' | 'toggle' | 'select' | 'slider';
    options?: Array<{ id: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
  }>;
};

export default function SettingsScreen() {
  const { settings, updateSettings, isConnected, ollamaAvailable, latencyMs } = useAppStore();
  const [apiUrlDraft, setApiUrlDraft] = useState(settings.apiUrl);
  const [companionNameDraft, setCompanionNameDraft] = useState(settings.companionName);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (key: keyof UserSettings, value: boolean) => {
    if (settings.hapticFeedback) Haptics.selectionAsync();
    await updateSettings({ [key]: value });
  };

  const handleSaveApiUrl = async () => {
    const trimmed = apiUrlDraft.trim().replace(/\/$/, '');
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL');
      return;
    }
    setSaving(true);
    await updateSettings({ apiUrl: trimmed });
    getApiService(trimmed);
    setSaving(false);
    Alert.alert('Saved', 'Backend URL updated. Testing connection…');
  };

  const handleSaveCompanionName = async () => {
    const trimmed = companionNameDraft.trim();
    if (!trimmed) return;
    await updateSettings({ companionName: trimmed });
    if (settings.hapticFeedback) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const statusColor = isConnected
    ? ollamaAvailable
      ? '#22c55e'
      : '#f59e0b'
    : '#ef4444';

  const statusText = isConnected
    ? ollamaAvailable
      ? `Connected (${latencyMs ?? '?'}ms)`
      : 'Backend OK, Ollama offline'
    : 'Disconnected';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Connection status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            <Text style={styles.label}>Backend URL</Text>
            <View style={styles.urlRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={apiUrlDraft}
                onChangeText={setApiUrlDraft}
                placeholder="http://192.168.1.x:3001"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveApiUrl}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Set to your Windows PC's local IP when using from a phone (e.g. http://192.168.1.100:3001)
            </Text>
          </View>
        </View>

        {/* Companion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Companion</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Companion Name</Text>
            <View style={styles.urlRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={companionNameDraft}
                onChangeText={setCompanionNameDraft}
                placeholder="Lacky"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCompanionName}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* AI Model */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Model</Text>
          <View style={styles.card}>
            {AI_MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.modelItem}
                onPress={() => updateSettings({ selectedModel: m.id })}
              >
                <View style={styles.modelLeft}>
                  <Text style={styles.modelLabel}>{m.label}</Text>
                  <Text style={styles.modelProvider}>{m.provider}</Text>
                </View>
                {settings.selectedModel === m.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#7c3aed" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generation settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generation</Text>
          <View style={styles.card}>
            <View style={styles.sliderRow}>
              <Text style={styles.label}>Temperature</Text>
              <Text style={styles.sliderValue}>{settings.temperature.toFixed(1)}</Text>
            </View>
            <View style={styles.sliderBtns}>
              {[0.1, 0.3, 0.5, 0.7, 0.9, 1.0].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.sliderBtn, settings.temperature === v && styles.sliderBtnActive]}
                  onPress={() => updateSettings({ temperature: v })}
                >
                  <Text
                    style={[styles.sliderBtnText, settings.temperature === v && styles.sliderBtnTextActive]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.sliderRow, { marginTop: 12 }]}>
              <Text style={styles.label}>Max Tokens</Text>
              <Text style={styles.sliderValue}>{settings.maxTokens}</Text>
            </View>
            <View style={styles.sliderBtns}>
              {[512, 1024, 2048, 4096].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.sliderBtn, settings.maxTokens === v && styles.sliderBtnActive]}
                  onPress={() => updateSettings({ maxTokens: v })}
                >
                  <Text
                    style={[styles.sliderBtnText, settings.maxTokens === v && styles.sliderBtnTextActive]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Options</Text>
          <View style={styles.card}>
            {(
              [
                { key: 'streamingEnabled', label: 'Streaming Responses' },
                { key: 'useUncensored', label: 'Uncensored Mode' },
                { key: 'hapticFeedback', label: 'Haptic Feedback' },
                { key: 'soundEnabled', label: 'Sound Effects' },
              ] as Array<{ key: keyof UserSettings; label: string }>
            ).map(({ key, label }) => (
              <View key={key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Switch
                  value={Boolean(settings[key])}
                  onValueChange={(v) => handleToggle(key, v)}
                  trackColor={{ false: '#2d3148', true: '#7c3aed' }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.card}>
            <View style={styles.themeRow}>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.themeBtn, settings.theme === t && styles.themeBtnActive]}
                  onPress={() => updateSettings({ theme: t })}
                >
                  <Ionicons
                    name={t === 'light' ? 'sunny' : t === 'dark' ? 'moon' : 'phone-portrait'}
                    size={18}
                    color={settings.theme === t ? '#7c3aed' : '#64748b'}
                  />
                  <Text style={[styles.themeBtnText, settings.theme === t && styles.themeBtnTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <View style={styles.about}>
            <Text style={styles.aboutTitle}>Lackadaisical AI Chat</Text>
            <Text style={styles.aboutVersion}>Mobile v2.0.0-rc1</Text>
            <Text style={styles.aboutText}>
              Privacy-first, local AI companion. All your data stays on your own server.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3148',
    backgroundColor: '#1a1d2e',
  },
  headerTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 4, paddingBottom: 32 },
  section: { gap: 6, marginBottom: 8 },
  sectionTitle: { color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: {
    backgroundColor: '#1a1d2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2d3148',
    gap: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: '#e2e8f0', fontSize: 14 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  urlRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    backgroundColor: '#0f1117',
    borderRadius: 8,
    padding: 10,
    color: '#e2e8f0',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  saveBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  hint: { color: '#475569', fontSize: 11, lineHeight: 16 },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3148',
  },
  modelLeft: { gap: 2 },
  modelLabel: { color: '#e2e8f0', fontSize: 14 },
  modelProvider: { color: '#64748b', fontSize: 11 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderValue: { color: '#7c3aed', fontSize: 14, fontWeight: '600' },
  sliderBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sliderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#0f1117',
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  sliderBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  sliderBtnText: { color: '#94a3b8', fontSize: 13 },
  sliderBtnTextActive: { color: '#ffffff' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  toggleLabel: { color: '#e2e8f0', fontSize: 14 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f1117',
    borderWidth: 1,
    borderColor: '#2d3148',
  },
  themeBtnActive: { borderColor: '#7c3aed', backgroundColor: '#1e1230' },
  themeBtnText: { color: '#64748b', fontSize: 13 },
  themeBtnTextActive: { color: '#7c3aed' },
  about: { alignItems: 'center', padding: 16, gap: 4 },
  aboutTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  aboutVersion: { color: '#7c3aed', fontSize: 12 },
  aboutText: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
