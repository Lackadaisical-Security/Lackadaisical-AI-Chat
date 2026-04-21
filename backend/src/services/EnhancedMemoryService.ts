import { DatabaseService } from './DatabaseService';
import { ResourceOptimizer, WriteOperation } from './ResourceOptimizer';
import { logger } from '../utils/logger';
import { Conversation } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

// Common English stop words for text processing
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'since', 'unless',
  'that', 'this', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
  'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves'
]);

export interface ConversationEntry {
  id?: number;
  sessionId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: Date;
  sentimentScore: number;
  sentimentLabel: string;
  contextTags: string[];
  tokensUsed: number;
  responseTimeMs: number;
  modelUsed: string;
  provider: string;
  context: ConversationContext;
}

export interface ConversationContext {
  previousTopics: string[];
  emotionalState: string;
  conversationPhase: 'greeting' | 'discussion' | 'deepening' | 'closing';
  userIntents: string[];
  aiObjectives: string[];
  relevantMemories: string[];
  importanceScore: number;
}

export interface ContextWindow {
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
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

export interface CrossSessionContext {
  includedSessions: string[];
  sessionSummaries: Array<{
    sessionId: string;
    sessionName: string;
    messageCount: number;
    topics: string[];
    lastActive: Date;
    summary: string;
  }>;
  totalCrossSessionMessages: number;
}

export interface MemorySearchResult {
  entries: ConversationEntry[];
  totalFound: number;
  relevanceScores: number[];
}

export interface UserPreferences {
  userId: string;
  crossSessionEnabled: boolean;
  maxCrossSessionHistory: number;
  contextTokenLimit: number;
  maxContextMessages: number;
  autoSummarize: boolean;
  privacyLevel: 'strict' | 'normal' | 'relaxed';
  summaryThreshold: number;
  // History pruning settings
  historyPruningEnabled: boolean;
  historyRetentionDays: number;        // 0 = keep forever
  historyMaxMessages: number;          // 0 = no limit
  historyPruneArchived: boolean;       // Whether to prune archived sessions too
  historyPruneIntervalHours: number;   // How often to auto-prune (0 = manual only)
}

export interface SessionSummary {
  sessionId: string;
  sessionName: string;
  messageCount: number;
  topics: string[];
  themes: string[];
  emotionalTrend: string;
  lastActive: Date;
  summary: string;
}

export class EnhancedMemoryService {
  private db: DatabaseService;
  private resourceOptimizer: ResourceOptimizer;
  private memoryPath: string;
  
  // In-memory caches for fast access
  private activeContexts: Map<string, ContextWindow> = new Map();
  private contextCache: Map<string, ConversationEntry[]> = new Map();
  private cacheMaxAge = 10 * 60 * 1000; // 10 minutes - increased for larger contexts
  private cacheTimestamps: Map<string, number> = new Map();
  
  // User preferences cache
  private userPreferences: Map<string, UserPreferences> = new Map();
  
  // Configuration with generous limits - let the AI gallop!
  private config = {
    maxContextMessages: 1000,        // Increased to 1000 messages for full conversation history
    maxContextTokens: 128000,        // 128K tokens - generous limit for modern models
    contextSummaryThreshold: 200,    // Start summarizing after 200 messages (range 100-500)
    contextSummaryMinMessages: 100,  // Minimum messages before any summarization
    contextSummaryMaxMessages: 500,  // Cap summary generation at 500 messages
    batchWriteEnabled: true,
    cacheEnabled: true,
    autoSummarize: true,
    crossSessionDefaultEnabled: true,
    maxCrossSessionHistory: 10,      // Include up to 10 past sessions
    crossSessionTokenLimit: 32000,   // 32K token budget for cross-session context
    maxSearchResults: 100,           // More search results
    longTermMemoryEnabled: true,
    // Token allocation ratios for context building
    currentSessionTokenRatio: 0.75,  // 75% of tokens for current session
    crossSessionTokenRatio: 0.25,    // 25% of tokens for cross-session context
    // Token estimation: average chars per token (GPT-style tokenization)
    charsPerToken: 4,
    // Relevance scoring thresholds
    minWordLengthForRelevance: 3,
    relevanceScorePerMatch: 0.2,
    minRelevanceThreshold: 0.1
  };

  constructor(db: DatabaseService, memoryPath: string = './memory') {
    this.db = db;
    this.memoryPath = memoryPath;
    this.resourceOptimizer = ResourceOptimizer.getInstance();
    
    // Set up batch write callback
    this.resourceOptimizer.setBatchCallback(this.processBatchWrites.bind(this));
    
    this.initializeMemoryStorage();
    logger.info('EnhancedMemoryService initialized with generous context limits (1000 msgs, 128K tokens)');
  }

  /**
   * Initialize memory storage directory
   */
  private async initializeMemoryStorage(): Promise<void> {
    try {
      await fs.mkdir(this.memoryPath, { recursive: true });
      logger.info('Memory storage initialized at:', this.memoryPath);
    } catch (error) {
      logger.error('Failed to initialize memory storage:', error);
    }
  }

  /**
   * Save a complete conversation entry with full context
   */
  async saveConversation(entry: Omit<ConversationEntry, 'id'>): Promise<number> {
    const writeOp = {
      type: 'conversation' as const,
      data: entry,
      priority: 'high' as const
    };

    // Queue for batched write if enabled
    if (this.config.batchWriteEnabled) {
      const metrics = this.resourceOptimizer.getResourceMetrics();
      
      if (metrics.optimization.shouldBatchWrites) {
        this.resourceOptimizer.queueWrite(writeOp);
        
        // Update cache immediately for fast reads
        this.updateContextCache(entry.sessionId, entry as ConversationEntry);
        
        return -1; // Indicate queued write
      }
    }

    // Direct write if batching not needed
    return await this.writeConversationToDB(entry);
  }

  /**
   * Write conversation directly to database
   */
  private async writeConversationToDB(entry: Omit<ConversationEntry, 'id'>): Promise<number> {
    try {
      const result = await this.db.insertConversation({
        session_id: entry.sessionId,
        user_message: entry.userMessage,
        ai_response: entry.aiResponse,
        timestamp: entry.timestamp.toISOString(),
        sentiment_score: entry.sentimentScore,
        sentiment_label: entry.sentimentLabel,
        context_tags: entry.contextTags,
        message_type: 'chat',
        tokens_used: entry.tokensUsed,
        response_time_ms: entry.responseTimeMs,
        model_used: entry.modelUsed
      });

      // Save extended context to memory_contexts table
      await this.saveExtendedContext(entry.sessionId, entry.context, result);

      // Update cache
      this.updateContextCache(entry.sessionId, { ...entry, id: result } as ConversationEntry);

      logger.debug(`Saved conversation ${result} for session ${entry.sessionId}`);
      return result;
    } catch (error) {
      logger.error('Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * Save extended context data
   */
  private async saveExtendedContext(
    sessionId: string, 
    context: ConversationContext, 
    conversationId: number
  ): Promise<void> {
    try {
      await this.db.executeStatement(`
        INSERT INTO memory_contexts (
          session_id, context_type, content, importance_score, created_at, accessed_at
        ) VALUES (?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        sessionId,
        JSON.stringify({
          conversationId,
          ...context
        }),
        context.importanceScore
      ]);
    } catch (error) {
      logger.error('Failed to save extended context:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Process batch writes from ResourceOptimizer
   */
  private async processBatchWrites(operations: WriteOperation[]): Promise<void> {
    const conversationOps = operations.filter(op => op.type === 'conversation');
    const contextOps = operations.filter(op => op.type === 'context');
    const memoryOps = operations.filter(op => op.type === 'memory');

    // Process conversations in parallel groups
    const batchSize = 10;
    for (let i = 0; i < conversationOps.length; i += batchSize) {
      const batch = conversationOps.slice(i, i + batchSize);
      await Promise.all(batch.map(op => this.writeConversationToDB(op.data)));
    }

    // Process context updates
    for (const op of contextOps) {
      await this.saveExtendedContext(op.data.sessionId, op.data.context, op.data.conversationId);
    }

    // Process memory operations
    for (const op of memoryOps) {
      await this.archiveToLongTermMemory(op.data.sessionId, op.data.memories);
    }

    logger.debug(`Processed batch: ${conversationOps.length} conversations, ${contextOps.length} contexts, ${memoryOps.length} memories`);
  }

  /**
   * Get or set user preferences for cross-session memory
   */
  async getUserPreferences(userId: string = 'default'): Promise<UserPreferences> {
    // Check cache
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId)!;
    }

    // Try to load from database
    try {
      const result = await this.db.executeQuery(
        `SELECT value_data FROM learning_data WHERE user_id = ? AND data_type = 'preference' AND key_name = 'memory_settings'`,
        [userId]
      );

      if (result.data && result.data.length > 0) {
        const prefs = JSON.parse(result.data[0].value_data);
        this.userPreferences.set(userId, prefs);
        return prefs;
      }
    } catch (error) {
      logger.debug('No stored preferences found, using generous defaults');
    }

    // Return generous default preferences - let the AI gallop!
    const defaultPrefs: UserPreferences = {
      userId,
      crossSessionEnabled: this.config.crossSessionDefaultEnabled,
      maxCrossSessionHistory: this.config.maxCrossSessionHistory,
      contextTokenLimit: this.config.maxContextTokens,           // 128K tokens
      maxContextMessages: this.config.maxContextMessages,        // 1000 messages
      autoSummarize: this.config.autoSummarize,
      privacyLevel: 'normal',
      summaryThreshold: this.config.contextSummaryThreshold,     // 200 messages
      // History pruning defaults — disabled by default (keep everything)
      historyPruningEnabled: false,
      historyRetentionDays: 0,           // 0 = keep forever
      historyMaxMessages: 0,             // 0 = no limit
      historyPruneArchived: false,
      historyPruneIntervalHours: 0,      // 0 = manual only
    };

    this.userPreferences.set(userId, defaultPrefs);
    return defaultPrefs;
  }

  /**
   * Update user preferences for cross-session memory
   */
  async setUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...preferences, userId };
    
    // Save to database
    try {
      await this.db.executeStatement(`
        INSERT OR REPLACE INTO learning_data (user_id, data_type, key_name, value_data, confidence_score, source)
        VALUES (?, 'preference', 'memory_settings', ?, 1.0, 'user_explicit')
      `, [userId, JSON.stringify(updated)]);
    } catch (error) {
      logger.error('Failed to save user preferences:', error);
    }

    // Update cache
    this.userPreferences.set(userId, updated);
    
    logger.info(`Updated user preferences for ${userId}:`, { 
      crossSessionEnabled: updated.crossSessionEnabled,
      maxContextMessages: updated.maxContextMessages,
      contextTokenLimit: updated.contextTokenLimit
    });
    return updated;
  }

  /**
   * Get context window for AI prompts with cross-session support
   */
  async getContextWindow(sessionId: string, maxTokens?: number, options?: {
    includeCrossSession?: boolean;
    userId?: string;
    query?: string;
  }): Promise<ContextWindow> {
    const userId = options?.userId || 'default';
    const prefs = await this.getUserPreferences(userId);
    
    // Check cache first
    const cacheKey = `${sessionId}_${options?.includeCrossSession ?? prefs.crossSessionEnabled}`;
    if (this.config.cacheEnabled && this.activeContexts.has(cacheKey)) {
      const cached = this.activeContexts.get(cacheKey)!;
      const cacheTime = this.cacheTimestamps.get(`context_${cacheKey}`);
      
      if (cacheTime && Date.now() - cacheTime < this.cacheMaxAge) {
        return cached;
      }
    }

    // Build context from database
    const tokenLimit = maxTokens || prefs.contextTokenLimit;
    const includeCrossSession = options?.includeCrossSession ?? prefs.crossSessionEnabled;
    
    const context = await this.buildContextWindow(sessionId, tokenLimit, {
      includeCrossSession,
      maxCrossSessionHistory: prefs.maxCrossSessionHistory,
      query: options?.query
    });
    
    // Cache the result
    this.activeContexts.set(cacheKey, context);
    this.cacheTimestamps.set(`context_${cacheKey}`, Date.now());
    
    return context;
  }

  /**
   * Get all sessions with their summaries for cross-session reference
   */
  async getSessionSummaries(excludeSessionId?: string, limit: number = 10): Promise<SessionSummary[]> {
    try {
      const result = await this.db.executeQuery(`
        SELECT 
          s.id as session_id,
          s.name as session_name,
          s.message_count,
          s.last_activity,
          GROUP_CONCAT(DISTINCT c.context_tags) as all_tags
        FROM sessions s
        LEFT JOIN conversations c ON s.id = c.session_id
        WHERE s.status = 'active' ${excludeSessionId ? 'AND s.id != ?' : ''}
        GROUP BY s.id
        ORDER BY s.last_activity DESC
        LIMIT ?
      `, excludeSessionId ? [excludeSessionId, limit] : [limit]);

      const summaries: SessionSummary[] = [];
      
      for (const row of result.data) {
        // Extract topics from concatenated tags
        const allTagsStr = row.all_tags || '[]';
        const topics = new Set<string>();
        
        try {
          const tagArrays = allTagsStr.split(',').map((t: string) => {
            try { 
              return JSON.parse(t); 
            } catch (innerError) { 
              logger.debug('Failed to parse individual tag JSON:', { tag: t, error: innerError });
              return []; 
            }
          });
          tagArrays.flat().forEach((tag: string) => topics.add(tag));
        } catch (outerError) {
          logger.debug('Failed to process tags string:', { allTagsStr, error: outerError });
        }

        // Get session summary from recent conversations
        const convResult = await this.db.executeQuery(`
          SELECT user_message, ai_response, sentiment_score
          FROM conversations
          WHERE session_id = ?
          ORDER BY timestamp DESC
          LIMIT 5
        `, [row.session_id]);

        const recentMsgs = convResult.data.map((c: any) => ({
          role: 'user' as const,
          content: c.user_message,
          timestamp: new Date()
        }));

        const summary = await this.generateContextSummary(recentMsgs);
        
        // Calculate emotional trend
        const sentiments = convResult.data.map((c: any) => c.sentiment_score || 0);
        const avgSentiment = sentiments.reduce((a: number, b: number) => a + b, 0) / Math.max(1, sentiments.length);
        const emotionalTrend = avgSentiment > 0.5 ? 'positive' : avgSentiment < -0.5 ? 'negative' : 'neutral';

        summaries.push({
          sessionId: row.session_id,
          sessionName: row.session_name || `Session ${row.session_id.slice(0, 8)}`,
          messageCount: row.message_count || 0,
          topics: Array.from(topics).slice(0, 10),
          themes: [],
          emotionalTrend,
          lastActive: new Date(row.last_activity || Date.now()),
          summary
        });
      }

      return summaries;
    } catch (error) {
      logger.error('Failed to get session summaries:', error);
      return [];
    }
  }

  /**
   * Search across all sessions for relevant context
   */
  async searchAllSessions(query: string, options?: {
    excludeSessionId?: string;
    limit?: number;
    minRelevance?: number;
  }): Promise<{
    results: Array<{
      sessionId: string;
      sessionName: string;
      userMessage: string;
      aiResponse: string;
      relevanceScore: number;
      timestamp: Date;
    }>;
    totalFound: number;
  }> {
    try {
      const limit = options?.limit || 20;
      const result = await this.db.executeQuery(`
        SELECT 
          c.session_id,
          s.name as session_name,
          c.user_message,
          c.ai_response,
          c.timestamp,
          c.context_tags
        FROM conversations c
        LEFT JOIN sessions s ON c.session_id = s.id
        WHERE (c.user_message LIKE ? OR c.ai_response LIKE ? OR c.context_tags LIKE ?)
        ${options?.excludeSessionId ? 'AND c.session_id != ?' : ''}
        ORDER BY c.timestamp DESC
        LIMIT ?
      `, options?.excludeSessionId 
        ? [`%${query}%`, `%${query}%`, `%${query}%`, options.excludeSessionId, limit]
        : [`%${query}%`, `%${query}%`, `%${query}%`, limit]
      );

      const queryWords = query.toLowerCase().split(/\s+/);
      const results = result.data.map((row: any) => {
        // Calculate relevance score using configurable thresholds
        const text = `${row.user_message || ''} ${row.ai_response || ''}`.toLowerCase();
        let relevanceScore = 0;
        
        for (const word of queryWords) {
          if (word.length > this.config.minWordLengthForRelevance && text.includes(word)) {
            relevanceScore += this.config.relevanceScorePerMatch;
          }
        }
        
        return {
          sessionId: row.session_id,
          sessionName: row.session_name || `Session ${row.session_id?.slice(0, 8)}`,
          userMessage: row.user_message,
          aiResponse: row.ai_response,
          relevanceScore: Math.min(1, relevanceScore),
          timestamp: new Date(row.timestamp)
        };
      }).filter((r: any) => r.relevanceScore >= (options?.minRelevance || this.config.minRelevanceThreshold));

      return {
        results: results.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore),
        totalFound: results.length
      };
    } catch (error) {
      logger.error('Failed to search all sessions:', error);
      return { results: [], totalFound: 0 };
    }
  }

  /**
   * Build context window from database with cross-session support
   */
  public async buildContextWindow(sessionId: string, maxTokens: number, options?: {
    includeCrossSession?: boolean;
    maxCrossSessionHistory?: number;
    query?: string;
  }): Promise<ContextWindow> {
    try {
      // Allocate token budget using configurable ratios
      const currentSessionTokens = options?.includeCrossSession 
        ? Math.floor(maxTokens * this.config.currentSessionTokenRatio) 
        : maxTokens;
      const crossSessionTokens = options?.includeCrossSession 
        ? Math.floor(maxTokens * this.config.crossSessionTokenRatio) 
        : 0;

      const result = await this.db.executeQuery(`
        SELECT 
          user_message, ai_response, timestamp, sentiment_score, 
          sentiment_label, context_tags, tokens_used
        FROM conversations 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [sessionId, this.config.maxContextMessages]);

      const rows = result.data;
      const messages: ContextWindow['recentMessages'] = [];
      const allTopics = new Set<string>();
      const sentiments: number[] = [];
      let totalTokens = 0;

      // Process in reverse to maintain chronological order
      for (let i = rows.length - 1; i >= 0 && totalTokens < currentSessionTokens; i--) {
        const row = rows[i];
        // Use stored tokens or estimate based on character count
        const messageTokens = row.tokens_used || this.estimateTokens(
          (row.user_message || '') + (row.ai_response || '')
        );
        
        if (totalTokens + messageTokens > currentSessionTokens) break;

        if (row.user_message) {
          messages.push({
            role: 'user',
            content: row.user_message,
            timestamp: new Date(row.timestamp),
            sentiment: row.sentiment_score,
            sessionId
          });
          sentiments.push(row.sentiment_score || 0);
        }

        if (row.ai_response) {
          messages.push({
            role: 'assistant',
            content: row.ai_response,
            timestamp: new Date(row.timestamp),
            sessionId
          });
        }

        // Extract topics from context tags
        try {
          const tags = JSON.parse(row.context_tags || '[]');
          tags.forEach((tag: string) => allTopics.add(tag));
        } catch (parseError) {
          logger.debug('Failed to parse context tags JSON:', { error: parseError, sessionId, rowId: row.id });
        }

        totalTokens += messageTokens;
      }

      // Calculate emotional trend
      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
        : 0;
      const recentSentiment = sentiments.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(1, sentiments.slice(0, 5).length);
      const emotionalTrend = recentSentiment > avgSentiment + 0.1 ? 'improving' :
                            recentSentiment < avgSentiment - 0.1 ? 'declining' : 'stable';

      // Generate summary if needed (with generous threshold 100-500)
      let summary = '';
      if (messages.length > this.config.contextSummaryMinMessages && this.config.autoSummarize) {
        const msgsToSummarize = messages.slice(0, Math.min(messages.length - 20, this.config.contextSummaryMaxMessages));
        summary = await this.generateContextSummary(msgsToSummarize);
      }

      // Build cross-session context if enabled
      let crossSessionContext: CrossSessionContext | undefined;
      if (options?.includeCrossSession && crossSessionTokens > 0) {
        crossSessionContext = await this.buildCrossSessionContext(
          sessionId, 
          crossSessionTokens, 
          options.maxCrossSessionHistory || this.config.maxCrossSessionHistory,
          options.query
        );
        // Estimate tokens for cross-session context using proper calculation
        const crossSessionTokenEstimate = crossSessionContext.sessionSummaries.reduce((sum, s) => {
          return sum + this.estimateTokens(s.summary);
        }, 0);
        totalTokens += crossSessionTokenEstimate;
      }

      return {
        recentMessages: messages,
        summary,
        topics: Array.from(allTopics),
        emotionalTrend,
        conversationDepth: messages.length,
        totalTokens,
        crossSessionContext
      };
    } catch (error) {
      logger.error('Failed to build context window:', error);
      return {
        recentMessages: [],
        summary: '',
        topics: [],
        emotionalTrend: 'stable',
        conversationDepth: 0,
        totalTokens: 0
      };
    }
  }

  /**
   * Estimate token count from text using configurable chars-per-token ratio
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.config.charsPerToken);
  }

  /**
   * Build cross-session context for AI to reference past conversations
   */
  private async buildCrossSessionContext(
    currentSessionId: string,
    tokenBudget: number,
    maxSessions: number,
    query?: string
  ): Promise<CrossSessionContext> {
    try {
      // Get summaries of past sessions
      const sessionSummaries = await this.getSessionSummaries(currentSessionId, maxSessions);
      
      // If there's a query, search for relevant content across sessions
      let relevantMessages: Array<{
        sessionId: string;
        sessionName: string;
        content: string;
        timestamp: Date;
      }> = [];

      if (query) {
        const searchResults = await this.searchAllSessions(query, {
          excludeSessionId: currentSessionId,
          limit: 50,
          minRelevance: 0.2
        });
        
        relevantMessages = searchResults.results.map(r => ({
          sessionId: r.sessionId,
          sessionName: r.sessionName,
          content: `User: ${r.userMessage}\nAssistant: ${r.aiResponse}`,
          timestamp: r.timestamp
        }));
      }

      return {
        includedSessions: sessionSummaries.map(s => s.sessionId),
        sessionSummaries: sessionSummaries.map(s => ({
          sessionId: s.sessionId,
          sessionName: s.sessionName,
          messageCount: s.messageCount,
          topics: s.topics,
          lastActive: s.lastActive,
          summary: s.summary
        })),
        totalCrossSessionMessages: relevantMessages.length
      };
    } catch (error) {
      logger.error('Failed to build cross-session context:', error);
      return {
        includedSessions: [],
        sessionSummaries: [],
        totalCrossSessionMessages: 0
      };
    }
  }

  /**
   * Generate context summary with generous limits
   */
  private async generateContextSummary(messages: ContextWindow['recentMessages']): Promise<string> {
    // Simple keyword extraction - could be enhanced with AI summarization
    const keywords = new Map<string, number>();

    for (const msg of messages) {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        const cleanWord = word.replace(/[^a-z]/g, '');
        if (cleanWord.length > 3 && !STOP_WORDS.has(cleanWord)) {
          keywords.set(cleanWord, (keywords.get(cleanWord) || 0) + 1);
        }
      }
    }

    // Get top keywords - more generous (up to 30)
    const topKeywords = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word]) => word);

    // Build a more comprehensive summary
    const uniqueSessions = new Set(messages.map(m => m.sessionId).filter(Boolean));
    const sessionInfo = uniqueSessions.size > 1 ? ` across ${uniqueSessions.size} sessions` : '';
    
    return `Conversation summary${sessionInfo}: ${messages.length} exchanges covering topics: ${topKeywords.join(', ')}.`;
  }

  /**
   * Extract context from user message and AI response
   */
  extractContext(
    userMessage: string,
    aiResponse: string,
    previousContext?: ConversationContext
  ): ConversationContext {
    // Extract topics using simple keyword extraction
    const combinedText = `${userMessage} ${aiResponse}`.toLowerCase();
    const words = combinedText.split(/\s+/);
    const topics = words
      .filter(word => word.length > 4)
      .slice(0, 10);

    // Detect emotional state from message
    const positiveWords = ['happy', 'great', 'good', 'love', 'thanks', 'appreciate', 'wonderful', 'amazing', 'excellent'];
    const negativeWords = ['sad', 'bad', 'hate', 'angry', 'frustrated', 'disappointed', 'terrible', 'awful'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
    }
    
    const emotionalState = positiveCount > negativeCount ? 'positive' :
                          negativeCount > positiveCount ? 'negative' : 'neutral';

    // Detect conversation phase
    const isGreeting = /^(hi|hello|hey|good morning|good evening)/i.test(userMessage);
    const isClosing = /^(bye|goodbye|thanks|thank you|see you)/i.test(userMessage);
    
    let conversationPhase: ConversationContext['conversationPhase'] = 'discussion';
    if (isGreeting && !previousContext) {
      conversationPhase = 'greeting';
    } else if (isClosing) {
      conversationPhase = 'closing';
    } else if (previousContext && previousContext.conversationPhase !== 'greeting') {
      conversationPhase = 'deepening';
    }

    // Detect user intents
    const intents: string[] = [];
    if (/\?/.test(userMessage)) intents.push('asking_question');
    if (/help|assist|support/i.test(userMessage)) intents.push('seeking_help');
    if (/tell me|explain|what is/i.test(userMessage)) intents.push('seeking_information');
    if (/feel|feeling|emotion/i.test(userMessage)) intents.push('expressing_emotion');
    if (/think|opinion|believe/i.test(userMessage)) intents.push('sharing_opinion');

    // Calculate importance score
    const importanceScore = Math.min(1, 
      (intents.length * 0.2) + 
      (topics.length * 0.05) +
      (userMessage.length > 100 ? 0.2 : 0) +
      (aiResponse.length > 200 ? 0.2 : 0)
    );

    return {
      previousTopics: previousContext?.previousTopics.slice(-5) || [],
      emotionalState,
      conversationPhase,
      userIntents: intents,
      aiObjectives: ['provide_helpful_response', 'maintain_engagement'],
      relevantMemories: [],
      importanceScore
    };
  }

  /**
   * Search conversations by content or context
   */
  async searchConversations(
    sessionId: string,
    query: string,
    options: {
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
      minImportance?: number;
    } = {}
  ): Promise<MemorySearchResult> {
    try {
      let sql = `
        SELECT * FROM conversations 
        WHERE session_id = ?
        AND (user_message LIKE ? OR ai_response LIKE ? OR context_tags LIKE ?)
      `;
      const params: any[] = [sessionId, `%${query}%`, `%${query}%`, `%${query}%`];

      if (options.dateFrom) {
        sql += ` AND timestamp >= ?`;
        params.push(options.dateFrom.toISOString());
      }

      if (options.dateTo) {
        sql += ` AND timestamp <= ?`;
        params.push(options.dateTo.toISOString());
      }

      sql += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(options.limit || 20);

      const result = await this.db.executeQuery(sql, params);
      
      const entries: ConversationEntry[] = result.data.map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        userMessage: row.user_message,
        aiResponse: row.ai_response,
        timestamp: new Date(row.timestamp),
        sentimentScore: row.sentiment_score,
        sentimentLabel: row.sentiment_label,
        contextTags: JSON.parse(row.context_tags || '[]'),
        tokensUsed: row.tokens_used,
        responseTimeMs: row.response_time_ms,
        modelUsed: row.model_used,
        provider: row.provider || 'unknown',
        context: {
          previousTopics: [],
          emotionalState: row.sentiment_label,
          conversationPhase: 'discussion',
          userIntents: [],
          aiObjectives: [],
          relevantMemories: [],
          importanceScore: 0.5
        }
      }));

      // Calculate relevance scores based on query match
      const relevanceScores = entries.map(entry => {
        let score = 0;
        const searchText = `${entry.userMessage} ${entry.aiResponse}`.toLowerCase();
        const queryWords = query.toLowerCase().split(/\s+/);
        
        for (const word of queryWords) {
          if (searchText.includes(word)) {
            score += 0.2;
          }
        }
        
        return Math.min(1, score);
      });

      return {
        entries,
        totalFound: entries.length,
        relevanceScores
      };
    } catch (error) {
      logger.error('Failed to search conversations:', error);
      return { entries: [], totalFound: 0, relevanceScores: [] };
    }
  }

  /**
   * Archive old messages to long-term memory
   */
  private async archiveToLongTermMemory(sessionId: string, memories: any[]): Promise<void> {
    try {
      for (const memory of memories) {
        await this.db.executeStatement(`
          INSERT INTO memory_contexts (
            session_id, context_type, content, importance_score, created_at, accessed_at
          ) VALUES (?, 'long_term', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [sessionId, JSON.stringify(memory), memory.importanceScore || 0.5]);
      }
      logger.debug(`Archived ${memories.length} memories for session ${sessionId}`);
    } catch (error) {
      logger.error('Failed to archive memories:', error);
    }
  }

  /**
   * Update context cache
   */
  private updateContextCache(sessionId: string, entry: ConversationEntry): void {
    if (!this.config.cacheEnabled) return;

    let cache = this.contextCache.get(sessionId) || [];
    cache.push(entry);

    // Keep cache size manageable
    if (cache.length > this.config.maxContextMessages) {
      cache = cache.slice(-this.config.maxContextMessages);
    }

    this.contextCache.set(sessionId, cache);
    this.cacheTimestamps.set(`cache_${sessionId}`, Date.now());

    // Invalidate context window cache to force rebuild
    this.activeContexts.delete(sessionId);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(sessionId: string): Promise<{
    activeMessages: number;
    archivedMessages: number;
    totalTokens: number;
    cacheStatus: string;
    resourceMetrics: any;
  }> {
    try {
      const contextWindow = await this.getContextWindow(sessionId);
      
      const archivedResult = await this.db.executeQuery(
        `SELECT COUNT(*) as count FROM memory_contexts WHERE session_id = ?`,
        [sessionId]
      );

      const cacheHit = this.activeContexts.has(sessionId);

      return {
        activeMessages: contextWindow.recentMessages.length,
        archivedMessages: archivedResult.data[0]?.count || 0,
        totalTokens: contextWindow.totalTokens,
        cacheStatus: cacheHit ? 'hit' : 'miss',
        resourceMetrics: this.resourceOptimizer.getResourceMetrics()
      };
    } catch (error) {
      logger.error('Failed to get memory stats:', error);
      return {
        activeMessages: 0,
        archivedMessages: 0,
        totalTokens: 0,
        cacheStatus: 'error',
        resourceMetrics: null
      };
    }
  }

  /**
   * Clear session memory
   */
  async clearSessionMemory(sessionId: string): Promise<void> {
    // Clear caches
    this.activeContexts.delete(sessionId);
    this.contextCache.delete(sessionId);
    this.cacheTimestamps.delete(`context_${sessionId}`);
    this.cacheTimestamps.delete(`cache_${sessionId}`);

    // Clear from database
    await this.db.executeStatement(
      'DELETE FROM memory_contexts WHERE session_id = ?',
      [sessionId]
    );

    logger.info(`Cleared memory for session ${sessionId}`);
  }

  /**
   * Cleanup old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.cacheMaxAge) {
        if (key.startsWith('context_')) {
          this.activeContexts.delete(key.replace('context_', ''));
        } else if (key.startsWith('cache_')) {
          this.contextCache.delete(key.replace('cache_', ''));
        }
        this.cacheTimestamps.delete(key);
      }
    }

    logger.debug('Cache cleanup completed');
  }

  /**
   * Flush pending writes
   */
  async flush(): Promise<void> {
    await this.resourceOptimizer.flushQueue();
  }
}

export default EnhancedMemoryService;
