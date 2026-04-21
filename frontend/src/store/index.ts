import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import api from '../services/api';
import { 
  AppState, 
  Message, 
  ChatSession, 
  PersonalityState, 
  JournalEntry, 
  PluginState, 
  Theme, 
  Toast, 
  Modal, 
  UserSettings,
  UserMemoryPreferences,
  SessionSummary
} from '../types';

interface AppStore extends AppState {
  // Context/Memory state
  contextWindow: any[] | null;
  contextLoading: boolean;
  contextError: string | null;
  // Enhanced Memory state
  memoryPreferences: UserMemoryPreferences | null;
  sessionSummaries: SessionSummary[];
  crossSessionEnabled: boolean;
  // Context/Memory actions
  fetchContext: (sessionId: string) => Promise<void>;
  updateContext: (sessionId: string, context: any[]) => Promise<void>;
  clearContext: (sessionId: string) => Promise<void>;
  fetchMemoryStats: (sessionId: string) => Promise<void>;
  clearMemoryStats: () => void;
  getContextWindow: (sessionId: string, maxTokens?: number) => Promise<string>;
  // Enhanced Memory actions
  fetchMemoryPreferences: (userId?: string) => Promise<void>;
  updateMemoryPreferences: (preferences: Partial<UserMemoryPreferences>, userId?: string) => Promise<void>;
  toggleCrossSession: (enabled: boolean, userId?: string) => Promise<void>;
  fetchSessionSummaries: (excludeSessionId?: string, limit?: number) => Promise<void>;
  searchAllSessions: (query: string, options?: { excludeSessionId?: string; limit?: number }) => Promise<any>;
  // Chat actions
  setCurrentSession: (session: ChatSession | null) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  updateAssistantMessage: (messageId: string, content: string) => void;
  setMessages: (messages: Message[]) => void;
  loadSessionMessages: (sessionId: string) => Promise<void>;
  setIsStreaming: (streaming: boolean) => void;
  
  // Personality actions
  setPersonality: (personality: PersonalityState | null) => void;
  updatePersonality: (updates: Partial<PersonalityState>) => void;
  
  // Journal actions
  setJournalEntries: (entries: JournalEntry[]) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
  setCurrentJournalEntry: (entry: JournalEntry | null) => void;
  
  // Plugin actions
  setPlugins: (plugins: PluginState[]) => void;
  updatePlugin: (name: string, updates: Partial<PluginState>) => void;
  setActivePlugins: (plugins: string[]) => void;
  
  // UI actions
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  addModal: (modal: Omit<Modal, 'id'>) => void;
  removeModal: (id: string) => void;
  
  // Settings actions
  updateSettings: (settings: Partial<UserSettings>) => void;
  
  // Connection actions
  setConnectionStatus: (connected: boolean, error?: string | null) => void;
  
  // Utility actions
  clearAll: () => void;
}

const initialState: AppState & {
  contextWindow: any[] | null;
  contextLoading: boolean;
  contextError: string | null;
  memoryStats: {
    totalMessages: number;
    contextLength: number;
    lastUpdated: Date | null;
    messageTypes: Record<string, number>;
    averageSentiment: number;
  } | null;
  memoryStatsLoading: boolean;
  memoryPreferences: UserMemoryPreferences | null;
  sessionSummaries: SessionSummary[];
  crossSessionEnabled: boolean;
} = {
  // Chat
  currentSession: null,
  sessions: [],
  messages: [],
  isStreaming: false,
  
  // Personality
  personality: null,
  
  // Journal
  journalEntries: [],
  currentJournalEntry: null,
  
  // Plugins
  plugins: [],
  activePlugins: [],
  
  // UI
  theme: 'light',
  sidebarOpen: false,
  toasts: [],
  modals: [],
  
  // Settings
  settings: {
    theme: 'light',
    autoSave: true,
    notifications: true,
    soundEnabled: false,
    fontSize: 'medium',
    compactMode: false,
    language: 'en',
    companionName: 'Lacky',
  },
  
  // Connection
  isConnected: false,
  connectionError: null,

  // Context/Memory
  contextWindow: null,
  contextLoading: false,
  contextError: null,
  memoryStats: null,
  memoryStatsLoading: false,
  
  // Enhanced Memory - crossSessionEnabled starts as null/false until preferences are fetched from server
  // The UI shows a loading state until memoryPreferences is populated
  memoryPreferences: null,
  sessionSummaries: [],
  crossSessionEnabled: false, // Will be updated when server preferences are fetched
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        
        // Chat actions
        setCurrentSession: (session) => set({ currentSession: session }),
        
        addSession: (session) => set((state) => ({
          sessions: [...state.sessions, session]
        })),
        
        updateSession: (id, updates) => set((state) => ({
          sessions: state.sessions.map(session =>
            session.id === id ? { ...session, ...updates } : session
          )
        })),
        
        deleteSession: (id) => set((state) => ({
          sessions: state.sessions.filter(session => session.id !== id),
          currentSession: state.currentSession?.id === id ? null : state.currentSession
        })),
        
        addMessage: (message) => set((state) => ({
          messages: [...state.messages, message]
        })),
        
        updateMessage: (id, updates) => set((state) => ({
          messages: state.messages.map(message =>
            message.id === id ? { ...message, ...updates } : message
          )
        })),
        
        setMessages: (messages) => set({ messages }),

        loadSessionMessages: async (sessionId) => {
          try {
            const response = await api.getConversationHistory(sessionId);
            if (response.success && response.data) {
              set({ messages: response.data });
            }
          } catch (error) {
            console.error('Failed to load session messages:', error);
          }
        },

        updateAssistantMessage: (messageId, content) => set((state) => ({
          messages: state.messages.map(message =>
            message.id === messageId ? { ...message, content } : message
          )
        })),
        
        setIsStreaming: (streaming) => set({ isStreaming: streaming }),
        
        // Personality actions
        setPersonality: (personality) => set({ personality }),
        
        updatePersonality: (updates) => set((state) => ({
          personality: state.personality ? { ...state.personality, ...updates } : null
        })),
        
        // Journal actions
        setJournalEntries: (entries) => set({ journalEntries: entries }),
        
        addJournalEntry: (entry) => set((state) => ({
          journalEntries: [...state.journalEntries, entry]
        })),
        
        updateJournalEntry: (id, updates) => set((state) => ({
          journalEntries: state.journalEntries.map(entry =>
            entry.id === id ? { ...entry, ...updates } : entry
          )
        })),
        
        deleteJournalEntry: (id) => set((state) => ({
          journalEntries: state.journalEntries.filter(entry => entry.id !== id),
          currentJournalEntry: state.currentJournalEntry?.id === id ? null : state.currentJournalEntry
        })),
        
        setCurrentJournalEntry: (entry) => set({ currentJournalEntry: entry }),
        
        // Plugin actions
        setPlugins: (plugins) => set({ plugins }),
        
        updatePlugin: (name, updates) => set((state) => ({
          plugins: state.plugins.map(plugin =>
            plugin.plugin_name === name ? { ...plugin, ...updates } : plugin
          )
        })),
        
        setActivePlugins: (plugins) => set({ activePlugins: plugins }),
        
        // UI actions
        setTheme: (theme) => set({ theme }),
        
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        
        addToast: (toast) => set((state) => ({
          toasts: [...state.toasts, { ...toast, id: Date.now().toString() }]
        })),
        
        removeToast: (id) => set((state) => ({
          toasts: state.toasts.filter(toast => toast.id !== id)
        })),
        
        addModal: (modal) => set((state) => ({
          modals: [...state.modals, { ...modal, id: Date.now().toString() }]
        })),
        
        removeModal: (id) => set((state) => ({
          modals: state.modals.filter(modal => modal.id !== id)
        })),
        
        // Settings actions
        updateSettings: (settings) => set((state) => ({
          settings: { ...state.settings, ...settings }
        })),
        
        // Connection actions
        setConnectionStatus: (connected, error = null) => set({
          isConnected: connected,
          connectionError: error
        }),
        
        // Context/Memory actions
        fetchContext: async (sessionId: string) => {
          set({ contextLoading: true, contextError: null });
          try {
            const response = await api.getSessionContext(sessionId);
            set({ contextWindow: response.data.context, contextLoading: false });
          } catch (err: any) {
            set({ contextError: err.message || 'Failed to fetch context', contextLoading: false });
          }
        },
        updateContext: async (sessionId: string, context: any[]) => {
          set({ contextLoading: true, contextError: null });
          try {
            await api.updateSessionContext(sessionId, context);
            set({ contextWindow: context, contextLoading: false });
          } catch (err: any) {
            set({ contextError: err.message || 'Failed to update context', contextLoading: false });
          }
        },
        clearContext: async (sessionId: string) => {
          set({ contextLoading: true, contextError: null });
          try {
            await api.clearSessionContext(sessionId);
            set({ contextWindow: [], contextLoading: false });
          } catch (err: any) {
            set({ contextError: err.message || 'Failed to clear context', contextLoading: false });
          }
        },
        fetchMemoryStats: async (sessionId: string) => {
          set({ memoryStatsLoading: true });
          try {
            const response = await api.getMemoryStats(sessionId);
            if (response.data) {
              set({ memoryStats: response.data, memoryStatsLoading: false });
            } else {
              set({ memoryStatsLoading: false });
            }
          } catch (err: any) {
            console.error('Failed to fetch memory stats:', err);
            set({ memoryStatsLoading: false });
          }
        },
        clearMemoryStats: () => {
          set({ memoryStats: null, memoryStatsLoading: false });
        },
        getContextWindow: async (sessionId: string, maxTokens?: number) => {
          try {
            const response = await api.getContextWindow(sessionId, maxTokens);
            return response.data?.contextWindow || '';
          } catch (err: any) {
            console.error('Failed to get context window:', err);
            return '';
          }
        },

        // Enhanced Memory actions
        fetchMemoryPreferences: async (userId?: string) => {
          try {
            const response = await api.getMemoryPreferences(userId);
            if (response.data) {
              set({ 
                memoryPreferences: response.data,
                crossSessionEnabled: response.data.crossSessionEnabled
              });
            }
          } catch (err: any) {
            console.error('Failed to fetch memory preferences:', err);
          }
        },
        updateMemoryPreferences: async (preferences: Partial<UserMemoryPreferences>, userId?: string) => {
          try {
            const response = await api.updateMemoryPreferences(preferences, userId);
            if (response.data) {
              set({ 
                memoryPreferences: response.data,
                crossSessionEnabled: response.data.crossSessionEnabled
              });
            }
          } catch (err: any) {
            console.error('Failed to update memory preferences:', err);
          }
        },
        toggleCrossSession: async (enabled: boolean, userId?: string) => {
          try {
            const response = await api.toggleCrossSessionMemory(enabled, userId);
            if (response.data && typeof response.data.crossSessionEnabled === 'boolean') {
              const newCrossSessionEnabled = response.data.crossSessionEnabled;
              set((state) => ({ 
                // Update memoryPreferences if it exists, otherwise just update crossSessionEnabled
                memoryPreferences: state.memoryPreferences 
                  ? { ...state.memoryPreferences, crossSessionEnabled: newCrossSessionEnabled }
                  : null,
                crossSessionEnabled: newCrossSessionEnabled
              }));
            }
          } catch (err: any) {
            console.error('Failed to toggle cross-session:', err);
          }
        },
        fetchSessionSummaries: async (excludeSessionId?: string, limit?: number) => {
          try {
            const response = await api.getSessionSummaries(excludeSessionId, limit);
            if (response.data) {
              set({ sessionSummaries: response.data.summaries });
            }
          } catch (err: any) {
            console.error('Failed to fetch session summaries:', err);
          }
        },
        searchAllSessions: async (query: string, options?: { excludeSessionId?: string; limit?: number }) => {
          try {
            const response = await api.searchAllSessions(query, options);
            return response.data;
          } catch (err: any) {
            console.error('Failed to search all sessions:', err);
            return null;
          }
        },

        // Utility actions
        clearAll: () => set(initialState),
      }),
      {
        name: 'lackadaisical-ai-chat-storage',
        partialize: (state) => ({
          theme: state.theme,
          settings: state.settings,
          sessions: state.sessions,
          messages: state.messages,
          currentSession: state.currentSession,
          contextWindow: state.contextWindow,
          journalEntries: state.journalEntries,
          plugins: state.plugins,
          crossSessionEnabled: state.crossSessionEnabled,
          memoryPreferences: state.memoryPreferences,
        }),
      }
    ),
    {
      name: 'lackadaisical-ai-chat-store',
    }
  )
); 