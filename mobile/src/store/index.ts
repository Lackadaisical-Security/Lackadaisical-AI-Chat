import { create } from 'zustand';
import { Message, ChatSession, PersonalityState, JournalEntry, UserSettings } from '../types';
import { storage } from '../services/storage';
import { getApiService } from '../services/api';

// ─── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: UserSettings = {
  apiUrl: 'http://localhost:3001',
  selectedModel: 'gemma3:4b',
  temperature: 0.7,
  maxTokens: 4096,
  streamingEnabled: true,
  companionName: 'Lacky',
  theme: 'system',
  hapticFeedback: true,
  soundEnabled: true,
  useUncensored: false,
};

// ─── Store interface ──────────────────────────────────────────────────────────

interface AppStore {
  // Chat
  messages: Message[];
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  isStreaming: boolean;
  isLoading: boolean;

  // Personality
  personality: PersonalityState | null;

  // Journal
  journalEntries: JournalEntry[];

  // Connection
  isConnected: boolean;
  ollamaAvailable: boolean;
  latencyMs: number | null;
  connectionError: string | null;

  // Settings
  settings: UserSettings;

  // ─── Chat actions ──────────────────────────────────────────────────────────
  addMessage: (msg: Message) => void;
  updateAssistantMessage: (id: string, content: string) => void;
  setMessages: (msgs: Message[]) => void;
  clearMessages: () => void;
  setCurrentSession: (session: ChatSession | null) => void;
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  removeSession: (id: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsLoading: (loading: boolean) => void;

  // ─── Personality actions ──────────────────────────────────────────────────
  setPersonality: (p: PersonalityState | null) => void;

  // ─── Journal actions ──────────────────────────────────────────────────────
  setJournalEntries: (entries: JournalEntry[]) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  removeJournalEntry: (id: string) => void;

  // ─── Connection actions ───────────────────────────────────────────────────
  setConnectionStatus: (connected: boolean, ollamaAvailable: boolean, latencyMs: number | null, error?: string | null) => void;

  // ─── Settings actions ─────────────────────────────────────────────────────
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  // ─── Initial state ──────────────────────────────────────────────────────────
  messages: [],
  sessions: [],
  currentSession: null,
  isStreaming: false,
  isLoading: false,
  personality: null,
  journalEntries: [],
  isConnected: false,
  ollamaAvailable: false,
  latencyMs: null,
  connectionError: null,
  settings: DEFAULT_SETTINGS,

  // ─── Chat actions ───────────────────────────────────────────────────────────
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  updateAssistantMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })),

  setMessages: (msgs) => set({ messages: msgs }),
  clearMessages: () => set({ messages: [] }),

  setCurrentSession: (session) => {
    set({ currentSession: session, messages: [] });
    if (session) {
      storage.setCurrentSessionId(session.id).catch(() => {});
    }
  },

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSession: state.currentSession?.id === id ? null : state.currentSession,
    })),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  // ─── Personality actions ────────────────────────────────────────────────────
  setPersonality: (p) => set({ personality: p }),

  // ─── Journal actions ────────────────────────────────────────────────────────
  setJournalEntries: (entries) => set({ journalEntries: entries }),
  addJournalEntry: (entry) =>
    set((state) => ({ journalEntries: [entry, ...state.journalEntries] })),
  updateJournalEntry: (id, updates) =>
    set((state) => ({
      journalEntries: state.journalEntries.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),
  removeJournalEntry: (id) =>
    set((state) => ({
      journalEntries: state.journalEntries.filter((e) => e.id !== id),
    })),

  // ─── Connection actions ─────────────────────────────────────────────────────
  setConnectionStatus: (connected, ollamaAvailable, latencyMs, error = null) =>
    set({ isConnected: connected, ollamaAvailable, latencyMs, connectionError: error }),

  // ─── Settings actions ───────────────────────────────────────────────────────
  updateSettings: async (updates) => {
    const current = get().settings;
    const next = { ...current, ...updates };
    set({ settings: next });
    await storage.setSettings(next as unknown as Record<string, unknown>);
    // Re-initialize API service if URL changed
    if (updates.apiUrl && updates.apiUrl !== current.apiUrl) {
      getApiService(updates.apiUrl);
    }
  },

  loadSettings: async () => {
    const saved = await storage.getSettings();
    if (saved) {
      const merged: UserSettings = { ...DEFAULT_SETTINGS, ...(saved as Partial<UserSettings>) };
      set({ settings: merged });
      getApiService(merged.apiUrl);
    }
  },
}));
