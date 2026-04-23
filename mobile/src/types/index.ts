// ─── Core types matching the backend API contracts ───────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens?: number;
  model?: string;
  attachments?: Attachment[];
  thinking?: string;
  sentiment?: SentimentData;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  category: string;
  mimeType?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  metadata?: Record<string, unknown>;
}

export interface SentimentData {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  magnitude?: number;
}

export interface PersonalityState {
  id: number;
  name: string;
  current_mood: {
    energy: number;
    empathy: number;
    humor: number;
    curiosity: number;
    patience: number;
  };
  energy_level: number;
  empathy_level: number;
  humor_level: number;
  curiosity_level: number;
  patience_level: number;
  conversation_count: number;
  total_interactions: number;
  last_interaction: string | null;
  personality_version: string;
  created_at: string;
  last_updated: string;
}

export interface JournalEntry {
  id: string;
  session_id?: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    ai_providers: Record<string, 'up' | 'down'>;
    plugins?: Record<string, 'up' | 'down'>;
  };
  version: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── App state ───────────────────────────────────────────────────────────────

export interface UserSettings {
  apiUrl: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  streamingEnabled: boolean;
  companionName: string;
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;
  soundEnabled: boolean;
  useUncensored: boolean;
}

export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'xai';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

// ─── Stream types ─────────────────────────────────────────────────────────────

export interface StreamChunk {
  type:
    | 'start'
    | 'content'
    | 'end'
    | 'error'
    | 'metadata'
    | 'thinking_start'
    | 'thinking_content'
    | 'thinking_end';
  content?: string;
  error?: string;
  conversationId?: number;
  tokens?: number;
  responseTime?: number;
  model?: string;
  sentiment?: SentimentData;
  mood?: PersonalityState['current_mood'];
  thinking?: string;
}
