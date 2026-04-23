import axios, { AxiosInstance } from 'axios';
import { storage } from './storage';
import {
  ApiResponse,
  Message,
  ChatSession,
  PersonalityState,
  JournalEntry,
  HealthStatus,
  StreamChunk,
  UserSettings,
} from '../types';

// ─── API Service ─────────────────────────────────────────────────────────────

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach auth token to every request
    this.client.interceptors.request.use(async (config) => {
      const token = await storage.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 — optional accounts, just clear tokens
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        if (error.response?.status === 401) {
          await storage.removeAuthToken();
          await storage.removeRefreshToken();
        }
        return Promise.reject(error);
      }
    );
  }

  updateBaseURL(url: string): void {
    this.baseURL = url;
    this.client.defaults.baseURL = url;
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ health: HealthStatus; response_time_ms: number }> {
    const res = await this.client.get('/health');
    return res.data;
  }

  // ─── Chat ────────────────────────────────────────────────────────────────

  /**
   * Send a non-streaming chat message.
   */
  async sendMessage(
    message: string,
    sessionId: string = 'default',
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useUncensored?: boolean;
      attachmentIds?: string[];
    }
  ): Promise<ApiResponse<Message>> {
    const res = await this.client.post('/api/v1/chat', {
      message,
      session_id: sessionId,
      stream: false,
      ...(options?.model && { model: options.model }),
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
      ...(options?.useUncensored !== undefined && { useUncensored: options.useUncensored }),
      ...(options?.attachmentIds?.length && { attachment_ids: options.attachmentIds }),
    });

    const body = res.data;
    return {
      success: true,
      data: {
        id: body.conversation_id?.toString() ?? Date.now().toString(),
        role: 'assistant',
        content: body.response ?? '',
        timestamp: new Date().toISOString(),
        tokens: body.tokens_used,
        model: body.model_used,
        sentiment: body.sentiment,
      },
    };
  }

  /**
   * Stream a chat message via SSE (POST body streaming).
   * Falls back to sendMessage if streaming is unsupported or disabled.
   */
  async streamMessage(
    message: string,
    sessionId: string = 'default',
    onChunk: (chunk: StreamChunk) => void,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      useUncensored?: boolean;
      attachmentIds?: string[];
    },
    signal?: AbortSignal
  ): Promise<ApiResponse<Message>> {
    const token = await storage.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseURL}/api/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        session_id: sessionId,
        stream: true,
        ...(options?.model && { model: options.model }),
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.maxTokens && { max_tokens: options.maxTokens }),
        ...(options?.useUncensored !== undefined && { useUncensored: options.useUncensored }),
        ...(options?.attachmentIds?.length && { attachment_ids: options.attachmentIds }),
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Fallback: non-streaming JSON response
    if (!contentType.includes('text/event-stream')) {
      const json = await response.json();
      return {
        success: true,
        data: {
          id: json.conversation_id?.toString() ?? Date.now().toString(),
          role: 'assistant',
          content: json.response ?? '',
          timestamp: new Date().toISOString(),
          tokens: json.tokens_used,
          model: json.model_used,
        },
      };
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Unable to read response stream');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let metadata: Partial<StreamChunk> = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6)) as StreamChunk;
            onChunk(chunk);

            if (chunk.type === 'content' && chunk.content) {
              fullResponse += chunk.content;
            } else if (chunk.type === 'metadata') {
              metadata = chunk;
            } else if (chunk.type === 'end') {
              return {
                success: true,
                data: {
                  id: metadata.conversationId?.toString() ?? Date.now().toString(),
                  role: 'assistant',
                  content: fullResponse,
                  timestamp: new Date().toISOString(),
                  tokens: metadata.tokens,
                  model: metadata.model,
                  sentiment: metadata.sentiment,
                },
              };
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error ?? 'Streaming failed');
            }
          } catch (parseErr) {
            // Skip malformed SSE frames
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      success: true,
      data: {
        id: metadata.conversationId?.toString() ?? Date.now().toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
        tokens: metadata.tokens,
        model: metadata.model,
      },
    };
  }

  // ─── Sessions ────────────────────────────────────────────────────────────

  async getSessions(): Promise<ApiResponse<ChatSession[]>> {
    const res = await this.client.get('/api/v1/sessions');
    return res.data;
  }

  async createSession(name: string): Promise<ApiResponse<ChatSession>> {
    const res = await this.client.post('/api/v1/sessions', { name });
    return res.data;
  }

  async updateSession(id: string, updates: Partial<ChatSession>): Promise<ApiResponse<ChatSession>> {
    const res = await this.client.put(`/api/v1/sessions/${id}`, updates);
    return res.data;
  }

  async deleteSession(id: string): Promise<ApiResponse<void>> {
    const res = await this.client.delete(`/api/v1/sessions/${id}`);
    return res.data;
  }

  async getConversationHistory(sessionId: string, limit = 50): Promise<ApiResponse<Message[]>> {
    const res = await this.client.get(`/api/v1/chat/history/${sessionId}`, { params: { limit } });
    // Map backend conversation format to Message[]
    const data = res.data;
    const conversations: Array<{ id: number; user_message: string; ai_response: string; timestamp: string; tokens_used?: number; model_used?: string }> =
      data.conversations ?? [];
    const messages: Message[] = [];
    for (const c of conversations) {
      if (c.user_message) {
        messages.push({
          id: `u-${c.id}`,
          role: 'user',
          content: c.user_message,
          timestamp: c.timestamp,
        });
      }
      if (c.ai_response) {
        messages.push({
          id: `a-${c.id}`,
          role: 'assistant',
          content: c.ai_response,
          timestamp: c.timestamp,
          tokens: c.tokens_used,
          model: c.model_used ?? undefined,
        });
      }
    }
    return { success: true, data: messages };
  }

  async deleteConversationHistory(sessionId: string): Promise<ApiResponse<void>> {
    const res = await this.client.delete(`/api/v1/chat/history/${sessionId}`);
    return res.data;
  }

  // ─── Personality ──────────────────────────────────────────────────────────

  async getPersonality(): Promise<ApiResponse<PersonalityState>> {
    const res = await this.client.get('/api/v1/personality');
    return res.data;
  }

  async updatePersonality(updates: Partial<PersonalityState>): Promise<ApiResponse<PersonalityState>> {
    const res = await this.client.put('/api/v1/personality', updates);
    return res.data;
  }

  async resetPersonality(): Promise<ApiResponse<PersonalityState>> {
    const res = await this.client.post('/api/v1/personality/reset');
    return res.data;
  }

  // ─── Journal ─────────────────────────────────────────────────────────────

  async getJournalEntries(filters?: {
    limit?: number;
    offset?: number;
    search?: string;
    mood?: string;
  }): Promise<ApiResponse<JournalEntry[]>> {
    const res = await this.client.get('/api/v1/journal', { params: filters });
    return res.data;
  }

  async createJournalEntry(
    entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<JournalEntry>> {
    const res = await this.client.post('/api/v1/journal', entry);
    return res.data;
  }

  async updateJournalEntry(
    id: string,
    updates: Partial<JournalEntry>
  ): Promise<ApiResponse<JournalEntry>> {
    const res = await this.client.put(`/api/v1/journal/${id}`, updates);
    return res.data;
  }

  async deleteJournalEntry(id: string): Promise<ApiResponse<void>> {
    const res = await this.client.delete(`/api/v1/journal/${id}`);
    return res.data;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<ApiResponse<{ token: string; refreshToken: string; user: unknown }>> {
    const res = await this.client.post('/api/v1/auth/register', { email, password, name });
    return res.data;
  }

  async login(
    email: string,
    password: string
  ): Promise<ApiResponse<{ token: string; refreshToken: string; user: unknown }>> {
    const res = await this.client.post('/api/v1/auth/login', { email, password });
    return res.data;
  }

  async logout(): Promise<ApiResponse<void>> {
    const res = await this.client.post('/api/v1/auth/logout');
    return res.data;
  }

  async getProfile(): Promise<ApiResponse<unknown>> {
    const res = await this.client.get('/api/v1/auth/me');
    return res.data;
  }

  // ─── Models ───────────────────────────────────────────────────────────────

  async getAvailableModels(): Promise<ApiResponse<{ models: Array<{ name: string; size: number; family: string }> }>> {
    const res = await this.client.get('/api/v1/models');
    return res.data;
  }
}

// Singleton — will be re-initialized when user changes the API URL in settings
let _instance: ApiService | null = null;

export function getApiService(baseURL?: string): ApiService {
  if (!_instance || baseURL) {
    _instance = new ApiService(baseURL ?? 'http://localhost:3001');
  }
  return _instance;
}

export const api = getApiService();
export default api;
