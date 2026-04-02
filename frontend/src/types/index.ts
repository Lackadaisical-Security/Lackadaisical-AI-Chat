// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Chat types
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  model?: string;
  tokens?: number;
  responseTime?: number;
  sentiment?: SentimentAnalysis;
  thinking?: string;
  thinkingDurationMs?: number;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    category: string;
    downloadUrl?: string;
  }>;
  servedFiles?: Array<{
    id: string;
    filename: string;
    downloadUrl: string;
    language: string;
    size: number;
  }>;
  webSearchUsed?: boolean;
  toolsUsed?: string[];
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  totalTokens: number;
}

export interface SentimentAnalysis {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

// Personality types
export interface PersonalityState {
  id: number;
  name: string;
  static_traits: string[];
  current_mood: MoodState;
  energy_level: number;
  empathy_level: number;
  humor_level: number;
  curiosity_level: number;
  patience_level: number;
  conversation_count: number;
  total_interactions: number;
  last_interaction: string | null;
  mood_history: MoodSnapshot[];
  learning_data: Record<string, any>;
  personality_version: string;
  created_at: string;
  last_updated: string;
}

export interface MoodState {
  energy: number;
  empathy: number;
  humor: number;
  curiosity: number;
  patience: number;
  factors?: Record<string, number>;
}

export interface MoodSnapshot {
  timestamp: string;
  mood: MoodState;
  trigger?: string;
  context?: string;
}

// Journal types
export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  mood: string;
  session_id: string;
  privacy_level: 'private' | 'shared' | 'public' | 'deleted';
  word_count?: number;
  reading_time_minutes?: number;
  themes?: string[];
  emotions?: string[];
  created_at: string;
  updated_at: string;
}

// Plugin types
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: string[];
  enabled: boolean;
  config: Record<string, any>;
}

export interface PluginState {
  plugin_name: string;
  enabled: boolean;
  config: Record<string, any>;
  state_data: Record<string, any>;
  last_used: string | null;
  usage_count: number;
  version: string;
  author: string | null;
  description: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

// Theme types
export type Theme = 'light' | 'dark' | 'retro' | 'terminal' | 'matrix';

// UI types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface Modal {
  id: string;
  title: string;
  content: React.ReactNode;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

// Settings types
export interface UserSettings {
  theme: Theme;
  autoSave: boolean;
  notifications: boolean;
  soundEnabled: boolean;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  language: string;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'chat' | 'stream_chunk' | 'mood_update' | 'session_update' | 'error';
  data: any;
  timestamp: string;
}

export interface StreamChunk {
  type: 'start' | 'content' | 'end' | 'error';
  content?: string;
  metadata?: Record<string, any>;
  error?: string;
}

// Form types
export interface ChatFormData {
  message: string;
  sessionId?: string;
}

export interface JournalFormData {
  title: string;
  content: string;
  tags: string[];
  mood: string;
  privacy_level: 'private' | 'shared' | 'public';
}

export interface PluginFormData {
  name: string;
  config: Record<string, any>;
}

// Navigation types
export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  badge?: number;
  disabled?: boolean;
}

// Component props types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

// Store types
export interface AppState {
  // Chat
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  messages: Message[];
  isStreaming: boolean;
  
  // Memory/Context
  memoryStats: MemoryStats | null;
  memoryStatsLoading: boolean;
  
  // Personality
  personality: PersonalityState | null;
  
  // Journal
  journalEntries: JournalEntry[];
  currentJournalEntry: JournalEntry | null;
  
  // Plugins
  plugins: PluginState[];
  activePlugins: string[];
  
  // UI
  theme: Theme;
  sidebarOpen: boolean;
  toasts: Toast[];
  modals: Modal[];
  
  // Settings
  settings: UserSettings;
  
  // Connection
  isConnected: boolean;
  connectionError: string | null;
}

// Memory types
export interface MemoryStats {
  activeMessages: number;
  archivedMessages: number;
  totalContext: number;
  averageSentiment: number;
}

// Enhanced Memory types for cross-session support
export interface UserMemoryPreferences {
  userId: string;
  crossSessionEnabled: boolean;
  maxCrossSessionHistory: number;
  contextTokenLimit: number;
  maxContextMessages: number;
  autoSummarize: boolean;
  privacyLevel: 'strict' | 'normal' | 'relaxed';
  summaryThreshold: number;
}

export interface SessionSummary {
  sessionId: string;
  sessionName: string;
  messageCount: number;
  topics: string[];
  themes: string[];
  emotionalTrend: string;
  lastActive: string;
  summary: string;
}

// Summary shape used specifically for cross-session context responses,
// which omit certain fields like `themes` and `emotionalTrend`.
export interface CrossSessionSummary {
  sessionId: string;
  sessionName: string;
  messageCount: number;
  topics: string[];
  lastActive: string;
  summary: string;
}

export interface CrossSessionContext {
  includedSessions: string[];
  sessionSummaries: CrossSessionSummary[];
  totalCrossSessionMessages: number;
}

export interface EnhancedContextWindow {
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    sentiment?: number;
    sessionId?: string;
  }>;
  summary: string;
  topics: string[];
  emotionalTrend: string;
  conversationDepth: number;
  totalTokens: number;
  crossSessionContext?: CrossSessionContext;
}

export interface MemorySearchResult {
  entries: Array<{
    sessionId: string;
    userMessage: string;
    aiResponse: string;
    timestamp: string;
    sentimentLabel: string;
    relevanceScore: number;
  }>;
  totalFound: number;
  relevanceScores: number[];
}

// API Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>; 