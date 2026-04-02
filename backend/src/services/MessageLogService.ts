/**
 * MessageLogService - Separate SQLite database for comprehensive message logging
 * Stores every user message and every model thinking + response with WAL mode
 * for high-performance concurrent access.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { dbLogger } from '../utils/logger';
import { config } from '../config/settings';
import { initializeMessageLogDatabase } from '../utils/initDatabase';

export interface MessageLogEntry {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string | null;
  thinking_duration_ms?: number | null;
  model_used?: string | null;
  provider?: string | null;
  tokens_input?: number;
  tokens_output?: number;
  tokens_thinking?: number;
  finish_reason?: string | null;
  tool_calls?: string | null;
  tool_results?: string | null;
  attachments?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export class MessageLogService {
  private db: Database.Database | null = null;
  private insertStmt: Database.Statement | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const projectRoot = path.resolve(__dirname, '../../../..');
      const dbDir = path.dirname(path.resolve(projectRoot, config.database.path));

      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = initializeMessageLogDatabase(dbDir);

      // Prepare the insert statement for performance
      this.insertStmt = this.db.prepare(`
        INSERT INTO message_log (
          session_id, role, content, thinking, thinking_duration_ms,
          model_used, provider, tokens_input, tokens_output, tokens_thinking,
          finish_reason, tool_calls, tool_results, attachments, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.isInitialized = true;
      dbLogger.info('MessageLogService initialized with WAL mode');
    } catch (error) {
      dbLogger.error('Failed to initialize MessageLogService:', error);
      throw error;
    }
  }

  /**
   * Log a user message
   */
  logUserMessage(entry: {
    sessionId: string;
    content: string;
    attachments?: Array<{ name: string; type: string; size: number }>;
  }): number {
    if (!this.insertStmt) throw new Error('MessageLogService not initialized');

    const result = this.insertStmt.run(
      entry.sessionId,
      'user',
      entry.content,
      null, // no thinking for user
      null,
      null,
      null,
      0,
      0,
      0,
      null,
      null,
      null,
      entry.attachments ? JSON.stringify(entry.attachments) : null,
      '{}'
    );

    return Number(result.lastInsertRowid);
  }

  /**
   * Log an assistant response with optional thinking
   */
  logAssistantResponse(entry: {
    sessionId: string;
    content: string;
    thinking?: string | null;
    thinkingDurationMs?: number;
    modelUsed: string;
    provider: string;
    tokensInput?: number;
    tokensOutput?: number;
    tokensThinking?: number;
    finishReason?: string;
    toolCalls?: Array<{ name: string; arguments: Record<string, unknown>; result?: unknown }>;
    metadata?: Record<string, unknown>;
  }): number {
    if (!this.insertStmt) throw new Error('MessageLogService not initialized');

    const result = this.insertStmt.run(
      entry.sessionId,
      'assistant',
      entry.content,
      entry.thinking || null,
      entry.thinkingDurationMs || null,
      entry.modelUsed,
      entry.provider,
      entry.tokensInput || 0,
      entry.tokensOutput || 0,
      entry.tokensThinking || 0,
      entry.finishReason || null,
      entry.toolCalls ? JSON.stringify(entry.toolCalls) : null,
      null,
      null,
      JSON.stringify(entry.metadata || {})
    );

    return Number(result.lastInsertRowid);
  }

  /**
   * Log a tool execution
   */
  logToolExecution(entry: {
    sessionId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    toolOutput: unknown;
    modelUsed?: string;
    provider?: string;
  }): number {
    if (!this.insertStmt) throw new Error('MessageLogService not initialized');

    const result = this.insertStmt.run(
      entry.sessionId,
      'tool',
      `Tool: ${entry.toolName}`,
      null,
      null,
      entry.modelUsed || null,
      entry.provider || null,
      0, 0, 0,
      null,
      JSON.stringify({ name: entry.toolName, input: entry.toolInput }),
      JSON.stringify(entry.toolOutput),
      null,
      '{}'
    );

    return Number(result.lastInsertRowid);
  }

  /**
   * Get message log entries for a session
   */
  getSessionLog(sessionId: string, limit: number = 100, offset: number = 0): MessageLogEntry[] {
    if (!this.db) throw new Error('MessageLogService not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM message_log
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(sessionId, limit, offset) as MessageLogEntry[];
  }

  /**
   * Get all messages with thinking content (for debugging/analysis)
   */
  getThinkingLog(sessionId?: string, limit: number = 50): MessageLogEntry[] {
    if (!this.db) throw new Error('MessageLogService not initialized');

    let query = `
      SELECT * FROM message_log
      WHERE thinking IS NOT NULL AND thinking != ''
    `;
    const params: (string | number)[] = [];

    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params) as MessageLogEntry[];
  }

  /**
   * Search across all message logs
   */
  searchLogs(query: string, options?: {
    sessionId?: string;
    role?: string;
    limit?: number;
  }): MessageLogEntry[] {
    if (!this.db) throw new Error('MessageLogService not initialized');

    let sql = `
      SELECT * FROM message_log
      WHERE (content LIKE ? OR thinking LIKE ?)
    `;
    const params: (string | number)[] = [`%${query}%`, `%${query}%`];

    if (options?.sessionId) {
      sql += ' AND session_id = ?';
      params.push(options.sessionId);
    }

    if (options?.role) {
      sql += ' AND role = ?';
      params.push(options.role);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(options?.limit || 50);

    return this.db.prepare(sql).all(...params) as MessageLogEntry[];
  }

  /**
   * Get statistics for the message log
   */
  getStats(): {
    totalMessages: number;
    byRole: Record<string, number>;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalThinkingMessages: number;
    uniqueSessions: number;
  } {
    if (!this.db) throw new Error('MessageLogService not initialized');

    const total = this.db.prepare('SELECT COUNT(*) as count FROM message_log').get() as { count: number };
    const byRole = this.db.prepare(
      'SELECT role, COUNT(*) as count FROM message_log GROUP BY role'
    ).all() as Array<{ role: string; count: number }>;
    const tokens = this.db.prepare(
      'SELECT COALESCE(SUM(tokens_input), 0) as input, COALESCE(SUM(tokens_output), 0) as output FROM message_log'
    ).get() as { input: number; output: number };
    const thinking = this.db.prepare(
      "SELECT COUNT(*) as count FROM message_log WHERE thinking IS NOT NULL AND thinking != ''"
    ).get() as { count: number };
    const sessions = this.db.prepare(
      'SELECT COUNT(DISTINCT session_id) as count FROM message_log'
    ).get() as { count: number };

    return {
      totalMessages: total.count,
      byRole: byRole.reduce((acc, r) => ({ ...acc, [r.role]: r.count }), {}),
      totalTokensInput: tokens.input,
      totalTokensOutput: tokens.output,
      totalThinkingMessages: thinking.count,
      uniqueSessions: sessions.count,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      // Checkpoint WAL before closing
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      this.db.close();
      this.db = null;
      this.insertStmt = null;
      this.isInitialized = false;
      dbLogger.info('MessageLogService closed');
    }
  }
}

// Singleton instance
export const messageLogService = new MessageLogService();
export default messageLogService;
