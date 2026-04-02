import { DatabaseService } from './DatabaseService';
import { EnhancedMemoryService, ConversationEntry, ConversationContext, ContextWindow } from './EnhancedMemoryService';
import { ResourceOptimizer } from './ResourceOptimizer';
import { logger } from '../utils/logger';
import { Conversation } from '../types';

export interface ConversationSession {
  id: string;
  name: string;
  createdAt: Date;
  lastActive: Date;
  messageCount: number;
  totalTokens: number;
  averageSentiment: number;
  topics: string[];
  status: 'active' | 'archived' | 'deleted';
}

export interface ConversationTurn {
  userMessage: string;
  aiResponse: string;
  sentiment: {
    score: number;
    label: string;
  };
  context: ConversationContext;
  metadata: {
    tokensUsed: number;
    responseTimeMs: number;
    modelUsed: string;
    provider: string;
  };
}

export interface ConversationAnalytics {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  averageResponseTime: number;
  sentimentDistribution: Record<string, number>;
  topTopics: Array<{ topic: string; count: number }>;
  timeDistribution: Record<string, number>;
  modelUsage: Record<string, number>;
  providerUsage: Record<string, number>;
}

export class ConversationManager {
  private db: DatabaseService;
  private memoryService: EnhancedMemoryService;
  private resourceOptimizer: ResourceOptimizer;
  
  // Active conversation tracking
  private activeSessions: Map<string, ConversationSession> = new Map();
  private turnBuffer: Map<string, ConversationTurn[]> = new Map();
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private sessionRetryTimeout: NodeJS.Timeout | null = null;
  
  // Configuration
  private config = {
    maxBufferSize: 10,
    bufferFlushIntervalMs: 5000,
    autoArchiveAfterMs: 24 * 60 * 60 * 1000, // 24 hours
    maxSessionsInMemory: 100
  };

  constructor(db: DatabaseService) {
    this.db = db;
    this.memoryService = new EnhancedMemoryService(db);
    this.resourceOptimizer = ResourceOptimizer.getInstance();
    
    this.startBufferFlushTimer();
    this.loadActiveSessions();
    
    logger.info('ConversationManager initialized');
  }

  /**
   * Start periodic buffer flush timer
   */
  private startBufferFlushTimer(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushAllBuffers();
    }, this.config.bufferFlushIntervalMs);
  }

  /**
   * Load active sessions from database
   * Handles the case where database may not be initialized yet at construction time.
   * Retries once after a short delay if the initial load fails.
   */
  private async loadActiveSessions(retryCount: number = 0): Promise<void> {
    try {
      const sessions = await this.db.getSessions();
      
      for (const session of sessions.slice(0, this.config.maxSessionsInMemory)) {
        this.activeSessions.set(session.id, {
          id: session.id,
          name: session.name || 'Unnamed Session',
          createdAt: new Date(session.created_at || Date.now()),
          lastActive: new Date(session.last_active || Date.now()),
          messageCount: session.message_count || 0,
          totalTokens: 0,
          averageSentiment: 0,
          topics: [],
          status: 'active'
        });
      }
      
      logger.info(`Loaded ${this.activeSessions.size} active sessions`);
    } catch (error) {
      if (retryCount < 3) {
        const delayMs = (retryCount + 1) * 2000;
        logger.warn(`Failed to load sessions (attempt ${retryCount + 1}/3), retrying in ${delayMs}ms...`);
        this.sessionRetryTimeout = setTimeout(() => this.loadActiveSessions(retryCount + 1), delayMs);
      } else {
        logger.error('Failed to load active sessions after 3 attempts:', error);
      }
    }
  }

  /**
   * Start or get a conversation session
   */
  async getOrCreateSession(sessionId: string, name?: string): Promise<ConversationSession> {
    // Check memory first
    if (this.activeSessions.has(sessionId)) {
      const session = this.activeSessions.get(sessionId)!;
      session.lastActive = new Date();
      return session;
    }

    // Check database
    const existingSession = await this.db.getSession(sessionId);
    
    if (existingSession) {
      const session: ConversationSession = {
        id: existingSession.id,
        name: existingSession.name || 'Unnamed Session',
        createdAt: new Date(existingSession.created_at || Date.now()),
        lastActive: new Date(),
        messageCount: existingSession.message_count || 0,
        totalTokens: 0,
        averageSentiment: 0,
        topics: [],
        status: 'active'
      };
      
      this.activeSessions.set(sessionId, session);
      return session;
    }

    // Create new session
    await this.db.createSession(name || `Session ${sessionId.slice(0, 8)}`, '');
    
    const newSession: ConversationSession = {
      id: sessionId,
      name: name || `Session ${sessionId.slice(0, 8)}`,
      createdAt: new Date(),
      lastActive: new Date(),
      messageCount: 0,
      totalTokens: 0,
      averageSentiment: 0,
      topics: [],
      status: 'active'
    };
    
    this.activeSessions.set(sessionId, newSession);
    this.turnBuffer.set(sessionId, []);
    
    logger.info(`Created new session: ${sessionId}`);
    return newSession;
  }

  /**
   * Record a complete conversation turn (user message + AI response)
   */
  async recordTurn(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    metadata: {
      sentimentScore: number;
      sentimentLabel: string;
      tokensUsed: number;
      responseTimeMs: number;
      modelUsed: string;
      provider: string;
      contextTags?: string[];
    }
  ): Promise<void> {
    // Get or create session
    const session = await this.getOrCreateSession(sessionId);
    
    // Extract context
    const previousContext = this.turnBuffer.get(sessionId)?.slice(-1)[0]?.context;
    const context = this.memoryService.extractContext(userMessage, aiResponse, previousContext);
    
    // Create turn record
    const turn: ConversationTurn = {
      userMessage,
      aiResponse,
      sentiment: {
        score: metadata.sentimentScore,
        label: metadata.sentimentLabel
      },
      context,
      metadata: {
        tokensUsed: metadata.tokensUsed,
        responseTimeMs: metadata.responseTimeMs,
        modelUsed: metadata.modelUsed,
        provider: metadata.provider
      }
    };
    
    // Add to buffer
    let buffer = this.turnBuffer.get(sessionId) || [];
    buffer.push(turn);
    this.turnBuffer.set(sessionId, buffer);
    
    // Update session stats
    session.messageCount++;
    session.totalTokens += metadata.tokensUsed;
    session.lastActive = new Date();
    
    // Update average sentiment
    const allSentiments = buffer.map(t => t.sentiment.score);
    session.averageSentiment = allSentiments.reduce((a, b) => a + b, 0) / allSentiments.length;
    
    // Update topics
    const newTopics = new Set([...session.topics, ...context.previousTopics]);
    session.topics = Array.from(newTopics).slice(-20);
    
    // Check if buffer needs flushing
    if (buffer.length >= this.config.maxBufferSize) {
      await this.flushSessionBuffer(sessionId);
    }

    // Save to enhanced memory service
    await this.memoryService.saveConversation({
      sessionId,
      userMessage,
      aiResponse,
      timestamp: new Date(),
      sentimentScore: metadata.sentimentScore,
      sentimentLabel: metadata.sentimentLabel,
      contextTags: metadata.contextTags || [],
      tokensUsed: metadata.tokensUsed,
      responseTimeMs: metadata.responseTimeMs,
      modelUsed: metadata.modelUsed,
      provider: metadata.provider,
      context
    });

    logger.debug(`Recorded turn for session ${sessionId}, buffer size: ${buffer.length}`);
  }

  /**
   * Flush session buffer to database
   */
  private async flushSessionBuffer(sessionId: string): Promise<void> {
    const buffer = this.turnBuffer.get(sessionId);
    if (!buffer || buffer.length === 0) return;

    const metrics = this.resourceOptimizer.getResourceMetrics();
    
    // If system is under load, let ResourceOptimizer handle batching
    if (metrics.optimization.shouldBatchWrites) {
      logger.debug(`Deferring buffer flush for ${sessionId} due to system load`);
      return;
    }

    try {
      // Update session activity in database
      await this.db.updateSessionActivity(sessionId);
      
      // Clear buffer
      this.turnBuffer.set(sessionId, []);
      
      logger.debug(`Flushed buffer for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to flush buffer for session ${sessionId}:`, error);
    }
  }

  /**
   * Flush all session buffers
   */
  private async flushAllBuffers(): Promise<void> {
    for (const sessionId of this.turnBuffer.keys()) {
      await this.flushSessionBuffer(sessionId);
    }
  }

  /**
   * Get conversation context for AI
   */
  async getConversationContext(sessionId: string, maxTokens?: number): Promise<ContextWindow> {
    return await this.memoryService.getContextWindow(sessionId, maxTokens);
  }

  /**
   * Get recent conversations for a session
   */
  async getRecentConversations(sessionId: string, limit: number = 20): Promise<Conversation[]> {
    return await this.db.getConversationsBySession(sessionId, limit);
  }

  /**
   * Search conversations
   */
  async searchConversations(
    sessionId: string,
    query: string,
    options?: {
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    return await this.memoryService.searchConversations(sessionId, query, options);
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<{
    session: ConversationSession | null;
    contextWindow: ContextWindow;
    memoryStats: any;
    recentTurns: ConversationTurn[];
  }> {
    const session = this.activeSessions.get(sessionId) || null;
    const contextWindow = await this.memoryService.getContextWindow(sessionId);
    const memoryStats = await this.memoryService.getMemoryStats(sessionId);
    const recentTurns = this.turnBuffer.get(sessionId) || [];

    return {
      session,
      contextWindow,
      memoryStats,
      recentTurns
    };
  }

  /**
   * Get global analytics across all sessions
   */
  async getGlobalAnalytics(days: number = 30): Promise<ConversationAnalytics> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Get conversation stats
      const statsResult = await this.db.executeQuery(`
        SELECT 
          COUNT(*) as total_conversations,
          SUM(tokens_used) as total_tokens,
          AVG(response_time_ms) as avg_response_time,
          sentiment_label,
          model_used,
          strftime('%H', timestamp) as hour
        FROM conversations 
        WHERE timestamp >= ?
        GROUP BY sentiment_label, model_used, hour
      `, [cutoffDate.toISOString()]);

      const rows = statsResult.data;
      
      // Process results
      const sentimentDistribution: Record<string, number> = {};
      const modelUsage: Record<string, number> = {};
      const timeDistribution: Record<string, number> = {};
      let totalConversations = 0;
      let totalTokens = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const row of rows) {
        totalConversations += row.total_conversations || 0;
        totalTokens += row.total_tokens || 0;
        
        if (row.avg_response_time) {
          totalResponseTime += row.avg_response_time * row.total_conversations;
          responseTimeCount += row.total_conversations;
        }

        if (row.sentiment_label) {
          sentimentDistribution[row.sentiment_label] = 
            (sentimentDistribution[row.sentiment_label] || 0) + row.total_conversations;
        }

        if (row.model_used) {
          modelUsage[row.model_used] = 
            (modelUsage[row.model_used] || 0) + row.total_conversations;
        }

        if (row.hour) {
          timeDistribution[row.hour] = 
            (timeDistribution[row.hour] || 0) + row.total_conversations;
        }
      }

      // Get top topics from context tags
      const topicsResult = await this.db.executeQuery(`
        SELECT context_tags FROM conversations 
        WHERE timestamp >= ?
      `, [cutoffDate.toISOString()]);

      const topicCounts = new Map<string, number>();
      for (const row of topicsResult.data) {
        const tags = JSON.parse(row.context_tags || '[]');
        for (const tag of tags) {
          topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
        }
      }

      const topTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      return {
        totalConversations,
        totalMessages: totalConversations * 2, // user + ai messages
        totalTokens,
        averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
        sentimentDistribution,
        topTopics,
        timeDistribution,
        modelUsage,
        providerUsage: {} // Would need to track provider in DB
      };
    } catch (error) {
      logger.error('Failed to get global analytics:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        totalTokens: 0,
        averageResponseTime: 0,
        sentimentDistribution: {},
        topTopics: [],
        timeDistribution: {},
        modelUsage: {},
        providerUsage: {}
      };
    }
  }

  /**
   * Archive old sessions
   */
  async archiveOldSessions(): Promise<number> {
    const cutoffTime = Date.now() - this.config.autoArchiveAfterMs;
    let archivedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.lastActive.getTime() < cutoffTime) {
        session.status = 'archived';
        
        // Flush any pending data
        await this.flushSessionBuffer(sessionId);
        
        // Remove from active memory
        this.activeSessions.delete(sessionId);
        this.turnBuffer.delete(sessionId);
        
        archivedCount++;
      }
    }

    if (archivedCount > 0) {
      logger.info(`Archived ${archivedCount} inactive sessions`);
    }

    return archivedCount;
  }

  /**
   * Delete a session and all its data
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Remove from memory
    this.activeSessions.delete(sessionId);
    this.turnBuffer.delete(sessionId);
    
    // Clear memory service data
    await this.memoryService.clearSessionMemory(sessionId);
    
    // Delete from database
    await this.db.deleteSession(sessionId);
    
    logger.info(`Deleted session: ${sessionId}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ConversationSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get resource status
   */
  getResourceStatus(): any {
    return {
      activeSessions: this.activeSessions.size,
      bufferedTurns: Array.from(this.turnBuffer.values()).reduce((sum, buf) => sum + buf.length, 0),
      resourceMetrics: this.resourceOptimizer.getResourceMetrics(),
      queueStatus: this.resourceOptimizer.getQueueStatus()
    };
  }

  /**
   * Force flush all pending data
   */
  async forceFlush(): Promise<void> {
    await this.flushAllBuffers();
    await this.memoryService.flush();
    logger.info('Force flush completed');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }

    if (this.sessionRetryTimeout) {
      clearTimeout(this.sessionRetryTimeout);
      this.sessionRetryTimeout = null;
    }

    await this.forceFlush();
    
    this.activeSessions.clear();
    this.turnBuffer.clear();
    
    logger.info('ConversationManager cleaned up');
  }
}

export default ConversationManager;
