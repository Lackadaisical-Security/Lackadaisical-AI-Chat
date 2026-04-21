import axios, { AxiosInstance } from 'axios';
import { 
  ApiResponse, 
  Message, 
  ChatSession, 
  PersonalityState, 
  JournalEntry, 
  PluginState, 
  PluginResult,
  MemoryStats,
  UserMemoryPreferences,
  SessionSummary,
  EnhancedContextWindow,
  MemorySearchResult
} from '../types';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth tokens — accounts are optional so don't redirect
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          // Notify other components (e.g. Layout sidebar) via storage event
          window.dispatchEvent(new Event('storage'));
        }
        return Promise.reject(error);
      }
    );
  }

  // Chat endpoints
  async sendMessage(message: string, sessionId?: string, stream = false): Promise<ApiResponse<Message>> {
    if (stream) {
      // For streaming, we'll return a promise that resolves when streaming is complete
      return this.streamMessage(message, sessionId);
    } else {
      // Regular API call
      const response = await this.api.post('/api/v1/chat', {
        message,
        session_id: sessionId || 'default',
        stream: false
      });
      return response.data;
    }
  }

  // Streaming chat method
  streamMessage(
    message: string, 
    sessionId?: string,
    onChunk?: (chunk: any) => void
  ): Promise<ApiResponse<Message>> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseURL}/api/v1/chat/stream?message=${encodeURIComponent(message)}&session_id=${sessionId || 'default'}`;
      const eventSource = new EventSource(url);
      
      let fullResponse = '';
      let metadata: any = {};
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'content' && data.content) {
            fullResponse += data.content;
            onChunk?.(data);
          } else if (data.type === 'metadata') {
            metadata = data;
          } else if (data.type === 'end') {
            eventSource.close();
            resolve({
              success: true,
              data: {
                id: metadata.conversationId?.toString() || Date.now().toString(),
                role: 'assistant' as const,
                content: fullResponse,
                timestamp: new Date().toISOString(),
                tokens: metadata.tokens,
                model: metadata.model
              }
            });
          } else if (data.type === 'error') {
            eventSource.close();
            reject(new Error(data.error || 'Streaming failed'));
          }
        } catch (error) {
          console.error('Error parsing stream data:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        eventSource.close();
        reject(new Error('EventSource failed'));
      };
      
      // Cleanup after 5 minutes
      setTimeout(() => {
        eventSource.close();
        reject(new Error('Streaming timeout'));
      }, 300000);
    });
  }

  async getSessions(): Promise<ApiResponse<ChatSession[]>> {
    const response = await this.api.get('/api/sessions');
    return response.data;
  }

  async createSession(name: string): Promise<ApiResponse<ChatSession>> {
    const response = await this.api.post('/api/sessions', { name });
    return response.data;
  }

  async updateSession(id: string, updates: Partial<ChatSession>): Promise<ApiResponse<ChatSession>> {
    const response = await this.api.put(`/api/sessions/${id}`, updates);
    return response.data;
  }

  async deleteSession(id: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/api/sessions/${id}`);
    return response.data;
  }

  async getConversationHistory(sessionId: string): Promise<ApiResponse<Message[]>> {
    const response = await this.api.get(`/api/sessions/${sessionId}/messages`);
    return response.data;
  }

  async deleteConversationHistory(sessionId: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/api/v1/chat/history/${sessionId}`);
    return response.data;
  }

  // Personality endpoints
  async getPersonality(): Promise<ApiResponse<PersonalityState>> {
    const response = await this.api.get('/api/personality');
    return response.data;
  }

  async updatePersonality(updates: Partial<PersonalityState>): Promise<ApiResponse<PersonalityState>> {
    const response = await this.api.put('/api/personality', updates);
    return response.data;
  }

  async resetPersonality(): Promise<ApiResponse<PersonalityState>> {
    const response = await this.api.post('/api/personality/reset');
    return response.data;
  }

  // Context/Memory endpoints
  async getSessionContext(sessionId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/api/sessions/${sessionId}/context`);
    return response.data;
  }

  async updateSessionContext(sessionId: string, context: any): Promise<ApiResponse<void>> {
    const response = await this.api.post(`/api/sessions/${sessionId}/context`, { context });
    return response.data;
  }

  async clearSessionContext(sessionId: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/api/sessions/${sessionId}/context`);
    return response.data;
  }

  async getContextWindow(sessionId: string, maxTokens?: number): Promise<ApiResponse<{ contextWindow: string }>> {
    const params = maxTokens ? { maxTokens: maxTokens.toString() } : {};
    const response = await this.api.get(`/api/sessions/${sessionId}/context/window`, { params });
    return response.data;
  }

  async getMemoryStats(sessionId: string): Promise<ApiResponse<MemoryStats>> {
    const response = await this.api.get(`/api/sessions/${sessionId}/memory/stats`);
    return response.data;
  }

  // Enhanced Memory endpoints for cross-session support
  async getMemoryPreferences(userId?: string): Promise<ApiResponse<UserMemoryPreferences>> {
    const response = await this.api.get('/api/v1/chat/preferences', {
      params: userId ? { userId } : {}
    });
    return response.data;
  }

  async updateMemoryPreferences(
    preferences: Partial<UserMemoryPreferences>,
    userId?: string
  ): Promise<ApiResponse<UserMemoryPreferences>> {
    const response = await this.api.put('/api/v1/chat/preferences', {
      ...preferences,
      userId: userId || 'default'
    });
    return response.data;
  }

  async toggleCrossSessionMemory(enabled: boolean, userId?: string): Promise<ApiResponse<{ crossSessionEnabled: boolean }>> {
    const response = await this.api.post('/api/v1/chat/preferences/toggle-cross-session', {
      enabled,
      userId: userId || 'default'
    });
    return response.data;
  }

  async getSessionSummaries(excludeSessionId?: string, limit?: number): Promise<ApiResponse<{ summaries: SessionSummary[]; count: number }>> {
    const response = await this.api.get('/api/v1/chat/sessions/summaries', {
      params: {
        ...(excludeSessionId && { excludeSessionId }),
        ...(limit && { limit })
      }
    });
    return response.data;
  }

  async searchAllSessions(
    query: string,
    options?: { excludeSessionId?: string; limit?: number; minRelevance?: number }
  ): Promise<ApiResponse<MemorySearchResult>> {
    const response = await this.api.get('/api/v1/chat/search/all', {
      params: {
        q: query,
        ...options
      }
    });
    return response.data;
  }

  async getEnhancedContextWindow(
    sessionId: string,
    options?: {
      crossSession?: boolean;
      userId?: string;
      maxTokens?: number;
      query?: string;
    }
  ): Promise<ApiResponse<{ sessionId: string; contextWindow: EnhancedContextWindow; crossSessionIncluded: boolean }>> {
    const response = await this.api.get(`/api/v1/chat/context/full/${sessionId}`, {
      params: {
        crossSession: options?.crossSession !== false,
        userId: options?.userId || 'default',
        ...(options?.maxTokens && { maxTokens: options.maxTokens }),
        ...(options?.query && { query: options.query })
      }
    });
    return response.data;
  }

  async getSessionAnalytics(sessionId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/api/v1/chat/analytics/${sessionId}`);
    return response.data;
  }

  async getGlobalAnalytics(days?: number): Promise<ApiResponse<any>> {
    const response = await this.api.get('/api/v1/chat/analytics/global', {
      params: days ? { days } : {}
    });
    return response.data;
  }

  async getActiveSessions(): Promise<ApiResponse<{ sessions: any[]; count: number }>> {
    const response = await this.api.get('/api/v1/chat/sessions/active');
    return response.data;
  }

  async getResourceStatus(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/api/v1/chat/resources');
    return response.data;
  }

  async flushPendingData(): Promise<ApiResponse<{ message: string }>> {
    const response = await this.api.post('/api/v1/chat/flush');
    return response.data;
  }

  // Journal endpoints
  async getJournalEntries(filters?: {
    sessionId?: string;
    mood?: string;
    tags?: string[];
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<JournalEntry[]>> {
    const response = await this.api.get('/api/journal', { params: filters });
    return response.data;
  }

  async createJournalEntry(entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<JournalEntry>> {
    const response = await this.api.post('/api/journal', entry);
    return response.data;
  }

  async updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<ApiResponse<JournalEntry>> {
    const response = await this.api.put(`/api/journal/${id}`, updates);
    return response.data;
  }

  async deleteJournalEntry(id: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/api/journal/${id}`);
    return response.data;
  }

  async getJournalEntry(id: string): Promise<ApiResponse<JournalEntry>> {
    const response = await this.api.get(`/api/journal/${id}`);
    return response.data;
  }

  async exportJournal(format: 'json' | 'csv' | 'txt' | 'markdown', filters?: {
    sessionId?: string;
    dateRange?: { from: string; to: string };
  }): Promise<Blob> {
    const response = await this.api.get(`/api/journal/export/${format}`, {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  }

  async getJournalAnalytics(sessionId?: string, days: number = 30): Promise<ApiResponse<any>> {
    const response = await this.api.get('/api/journal/analytics', {
      params: { sessionId, days },
    });
    return response.data;
  }

  // Plugin endpoints
  async getPlugins(): Promise<ApiResponse<PluginState[]>> {
    const response = await this.api.get('/api/plugins');
    return response.data;
  }

  async getPlugin(name: string): Promise<ApiResponse<PluginState>> {
    const response = await this.api.get(`/api/plugins/${name}`);
    return response.data;
  }

  async enablePlugin(name: string): Promise<ApiResponse<void>> {
    const response = await this.api.post(`/api/plugins/${name}/enable`);
    return response.data;
  }

  async disablePlugin(name: string): Promise<ApiResponse<void>> {
    const response = await this.api.post(`/api/plugins/${name}/disable`);
    return response.data;
  }

  async updatePluginConfig(name: string, config: Record<string, any>): Promise<ApiResponse<void>> {
    const response = await this.api.put(`/api/plugins/${name}/config`, { config });
    return response.data;
  }

  async executePlugin(name: string, input: any, context: any): Promise<ApiResponse<PluginResult>> {
    const response = await this.api.post(`/api/plugins/${name}/execute`, {
      input,
      context,
    });
    return response.data;
  }

  async getPluginStats(name: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/api/plugins/${name}/stats`);
    return response.data;
  }

  async reloadPlugins(): Promise<ApiResponse<PluginState[]>> {
    const response = await this.api.post('/api/plugins/reload');
    return response.data;
  }

  // Health check (mounted at /health, outside /api prefix)
  async healthCheck(): Promise<any> {
    const response = await this.api.get('/health');
    return response.data;
  }

  // Auth endpoints
  async register(email: string, password: string, name?: string): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/auth/register', { email, password, name });
    return response.data;
  }

  async login(email: string, password: string): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/auth/login', { email, password });
    return response.data;
  }

  async logout(): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/auth/logout');
    return response.data;
  }

  async getProfile(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/api/v1/auth/me');
    return response.data;
  }

  async updateProfile(updates: { name?: string; email?: string }): Promise<ApiResponse<any>> {
    const response = await this.api.put('/api/v1/auth/profile', updates);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/auth/change-password', { currentPassword, newPassword });
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/auth/refresh', { refreshToken });
    return response.data;
  }

  // WebSocket connection
  getWebSocketURL(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    return `${protocol}//${host}/ws`;
  }

  // SSE connection for streaming
  getSSEURL(): string {
    return `${this.baseURL}/api/chat/stream`;
  }

  // Utility methods
  async uploadFile(file: File, endpoint: string): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // File upload for chat
  async uploadChatFile(file: File, sessionId: string = 'default'): Promise<ApiResponse<{
    id: string;
    name: string;
    size: number;
    category: string;
    mimeType: string;
    hasExtractedText: boolean;
    downloadUrl: string;
  }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);

    const response = await this.api.post('/api/v1/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  }

  // Web search
  async webSearch(query: string, options?: {
    maxResults?: number;
    timeRange?: string;
  }): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/search', {
      query,
      ...options,
    });
    return response.data;
  }

  // Deep research
  async deepResearch(query: string, options?: {
    steeringPrompt?: string;
    focusAreas?: string[];
    maxDepth?: number;
    maxSources?: number;
  }): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/search/deep-research', {
      query,
      ...options,
    });
    return response.data;
  }

  // Get available tools
  async getTools(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/api/v1/search/tools');
    return response.data;
  }

  // Execute tool
  async executeTool(name: string, params: Record<string, any>): Promise<ApiResponse<any>> {
    const response = await this.api.post('/api/v1/search/tool', { name, params });
    return response.data;
  }

  // Get session files
  async getSessionFiles(sessionId: string): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/api/v1/files/session/${sessionId}`);
    return response.data;
  }

  // Get message logs
  async getMessageLogs(sessionId: string, limit?: number): Promise<ApiResponse<any>> {
    const response = await this.api.get(`/api/v1/logs/session/${sessionId}`, {
      params: limit ? { limit } : {},
    });
    return response.data;
  }

  // Get log stats
  async getLogStats(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/api/v1/logs/stats');
    return response.data;
  }

  async downloadFile(url: string, filename?: string): Promise<void> {
    const response = await this.api.get(url, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const apiService = new ApiService();
export default apiService; 