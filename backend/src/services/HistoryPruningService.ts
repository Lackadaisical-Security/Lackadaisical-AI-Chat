/**
 * HistoryPruningService — Configurable conversation history pruning
 *
 * Provides automatic and manual pruning of conversation history based on
 * user-defined retention policies. Users can choose:
 *   - Whether pruning is enabled at all
 *   - Maximum retention period (days)
 *   - Maximum number of messages per session
 *   - Whether archived sessions are also pruned
 *   - Auto-prune interval (or manual-only)
 *
 * Pruned messages are permanently deleted from the database.
 * A summary of pruned content is stored in the session metadata for context continuity.
 */

import { DatabaseService } from './DatabaseService';
import { EnhancedMemoryService, UserPreferences } from './EnhancedMemoryService';
import { logger } from '../utils/logger';

export interface PruneResult {
  sessionId: string;
  messagesDeleted: number;
  oldestDeleted: string | null;
  newestRetained: string | null;
  reason: 'retention_days' | 'max_messages' | 'manual';
}

export interface PruneSummary {
  totalSessionsPruned: number;
  totalMessagesDeleted: number;
  results: PruneResult[];
  durationMs: number;
  prunedAt: string;
}

export class HistoryPruningService {
  private db: DatabaseService;
  private enhancedMemory: EnhancedMemoryService;
  private pruneTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(db: DatabaseService, enhancedMemory: EnhancedMemoryService) {
    this.db = db;
    this.enhancedMemory = enhancedMemory;
    logger.info('HistoryPruningService initialized');
  }

  /**
   * Start automatic pruning schedule for a user based on their preferences
   */
  async startAutoSchedule(userId: string = 'default'): Promise<void> {
    const prefs = await this.enhancedMemory.getUserPreferences(userId);

    // Clear existing timer
    this.stopAutoSchedule(userId);

    if (!prefs.historyPruningEnabled || prefs.historyPruneIntervalHours <= 0) {
      logger.info(`Auto-pruning disabled for user ${userId}`);
      return;
    }

    const intervalMs = prefs.historyPruneIntervalHours * 60 * 60 * 1000;

    const timer = setInterval(async () => {
      try {
        logger.info(`Running scheduled history prune for user ${userId}`);
        await this.pruneHistory(userId);
      } catch (error) {
        logger.error(`Scheduled prune failed for user ${userId}:`, error);
      }
    }, intervalMs);

    // Prevent timer from keeping the process alive
    if (timer.unref) timer.unref();

    this.pruneTimers.set(userId, timer);
    logger.info(`Auto-prune scheduled for user ${userId} every ${prefs.historyPruneIntervalHours}h`);
  }

  /**
   * Stop automatic pruning schedule for a user
   */
  stopAutoSchedule(userId: string = 'default'): void {
    const existing = this.pruneTimers.get(userId);
    if (existing) {
      clearInterval(existing);
      this.pruneTimers.delete(userId);
      logger.info(`Auto-prune stopped for user ${userId}`);
    }
  }

  /**
   * Execute pruning based on user preferences
   */
  async pruneHistory(userId: string = 'default'): Promise<PruneSummary> {
    const startTime = Date.now();
    const prefs = await this.enhancedMemory.getUserPreferences(userId);
    const results: PruneResult[] = [];

    if (!prefs.historyPruningEnabled) {
      return {
        totalSessionsPruned: 0,
        totalMessagesDeleted: 0,
        results: [],
        durationMs: Date.now() - startTime,
        prunedAt: new Date().toISOString(),
      };
    }

    // Get all sessions to prune
    let sessionQuery = `SELECT id, name, message_count FROM sessions WHERE status = 'active'`;
    if (prefs.historyPruneArchived) {
      sessionQuery = `SELECT id, name, message_count FROM sessions WHERE status IN ('active', 'archived')`;
    }

    try {
      const sessionsResult = await this.db.executeQuery<{
        id: string; name: string; message_count: number;
      }>(sessionQuery);

      const sessions = Array.isArray(sessionsResult.data)
        ? sessionsResult.data
        : sessionsResult.data ? [sessionsResult.data] : [];

      for (const session of sessions) {
        // Prune by retention days
        if (prefs.historyRetentionDays > 0) {
          const result = await this.pruneByRetentionDays(
            session.id, prefs.historyRetentionDays
          );
          if (result.messagesDeleted > 0) {
            results.push(result);
          }
        }

        // Prune by max messages
        if (prefs.historyMaxMessages > 0) {
          const result = await this.pruneByMaxMessages(
            session.id, prefs.historyMaxMessages
          );
          if (result.messagesDeleted > 0) {
            results.push(result);
          }
        }
      }
    } catch (error) {
      logger.error('History pruning failed:', error);
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.messagesDeleted, 0);
    const uniqueSessions = new Set(results.map(r => r.sessionId)).size;

    const summary: PruneSummary = {
      totalSessionsPruned: uniqueSessions,
      totalMessagesDeleted: totalDeleted,
      results,
      durationMs: Date.now() - startTime,
      prunedAt: new Date().toISOString(),
    };

    if (totalDeleted > 0) {
      logger.info('History pruning completed', {
        userId,
        sessionsAffected: uniqueSessions,
        messagesDeleted: totalDeleted,
        durationMs: summary.durationMs,
      });
    }

    return summary;
  }

  /**
   * Prune messages older than the retention period
   */
  private async pruneByRetentionDays(
    sessionId: string, retentionDays: number
  ): Promise<PruneResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    // Count messages to be deleted
    const countResult = await this.db.executeQuery<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM conversations
       WHERE session_id = ? AND timestamp < ?`,
      [sessionId, cutoffISO]
    );
    const row = Array.isArray(countResult.data) ? countResult.data[0] : countResult.data;
    const count = row?.cnt || 0;

    if (count === 0) {
      return { sessionId, messagesDeleted: 0, oldestDeleted: null, newestRetained: null, reason: 'retention_days' };
    }

    // Get the oldest message being deleted for logging
    const oldestResult = await this.db.executeQuery<{ timestamp: string }>(
      `SELECT MIN(timestamp) as timestamp FROM conversations
       WHERE session_id = ? AND timestamp < ?`,
      [sessionId, cutoffISO]
    );
    const oldestRow = Array.isArray(oldestResult.data) ? oldestResult.data[0] : oldestResult.data;

    // Store a summary of what's being pruned in session metadata
    await this.storePruneSummary(sessionId, count, 'retention_days', retentionDays);

    // Delete the old messages
    await this.db.executeStatement(
      `DELETE FROM conversations WHERE session_id = ? AND timestamp < ?`,
      [sessionId, cutoffISO]
    );

    // Update session message count
    const newCountResult = await this.db.executeQuery<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM conversations WHERE session_id = ?`, [sessionId]
    );
    const newCountRow = Array.isArray(newCountResult.data) ? newCountResult.data[0] : newCountResult.data;
    await this.db.executeStatement(
      `UPDATE sessions SET message_count = ? WHERE id = ?`,
      [newCountRow?.cnt || 0, sessionId]
    );

    return {
      sessionId,
      messagesDeleted: count,
      oldestDeleted: oldestRow?.timestamp || null,
      newestRetained: cutoffISO,
      reason: 'retention_days',
    };
  }

  /**
   * Prune messages when session exceeds max message count (keeps newest)
   */
  private async pruneByMaxMessages(
    sessionId: string, maxMessages: number
  ): Promise<PruneResult> {
    // Count total messages
    const countResult = await this.db.executeQuery<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM conversations WHERE session_id = ?`,
      [sessionId]
    );
    const row = Array.isArray(countResult.data) ? countResult.data[0] : countResult.data;
    const totalCount = row?.cnt || 0;

    if (totalCount <= maxMessages) {
      return { sessionId, messagesDeleted: 0, oldestDeleted: null, newestRetained: null, reason: 'max_messages' };
    }

    const toDelete = totalCount - maxMessages;

    // Get the oldest messages being deleted
    const oldestResult = await this.db.executeQuery<{ id: number; timestamp: string }>(
      `SELECT id, timestamp FROM conversations
       WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?`,
      [sessionId, toDelete]
    );
    const oldRows = Array.isArray(oldestResult.data) ? oldestResult.data : oldestResult.data ? [oldestResult.data] : [];

    if (oldRows.length === 0) {
      return { sessionId, messagesDeleted: 0, oldestDeleted: null, newestRetained: null, reason: 'max_messages' };
    }

    const oldestTimestamp = oldRows[0]?.timestamp || null;

    // Store summary before deletion
    await this.storePruneSummary(sessionId, toDelete, 'max_messages', maxMessages);

    // Delete the oldest messages by selecting their IDs
    const idsToDelete = oldRows.map(r => r.id);
    const placeholders = idsToDelete.map(() => '?').join(',');
    await this.db.executeStatement(
      `DELETE FROM conversations WHERE id IN (${placeholders})`,
      idsToDelete
    );

    // Update session message count
    await this.db.executeStatement(
      `UPDATE sessions SET message_count = ? WHERE id = ?`,
      [maxMessages, sessionId]
    );

    return {
      sessionId,
      messagesDeleted: toDelete,
      oldestDeleted: oldestTimestamp,
      newestRetained: null,
      reason: 'max_messages',
    };
  }

  /**
   * Store a summary of pruned content in the session metadata
   * This preserves context continuity even after pruning
   */
  private async storePruneSummary(
    sessionId: string, count: number, reason: string, threshold: number
  ): Promise<void> {
    try {
      // Get current session metadata
      const sessionResult = await this.db.executeQuery<{ metadata: string }>(
        `SELECT metadata FROM sessions WHERE id = ?`, [sessionId]
      );
      const sessionRow = Array.isArray(sessionResult.data)
        ? sessionResult.data[0]
        : sessionResult.data;

      let metadata: Record<string, unknown> = {};
      try {
        metadata = JSON.parse(sessionRow?.metadata || '{}');
      } catch {
        metadata = {};
      }

      // Append prune record
      const pruneHistory = (metadata.pruneHistory as Array<unknown>) || [];
      pruneHistory.push({
        prunedAt: new Date().toISOString(),
        messagesRemoved: count,
        reason,
        threshold,
      });

      // Keep only last 50 prune records
      if (pruneHistory.length > 50) {
        pruneHistory.splice(0, pruneHistory.length - 50);
      }

      metadata.pruneHistory = pruneHistory;
      metadata.totalMessagesPruned = ((metadata.totalMessagesPruned as number) || 0) + count;
      metadata.lastPrunedAt = new Date().toISOString();

      await this.db.executeStatement(
        `UPDATE sessions SET metadata = ? WHERE id = ?`,
        [JSON.stringify(metadata), sessionId]
      );
    } catch (error) {
      logger.warn('Failed to store prune summary:', error);
    }
  }

  /**
   * Manually prune a specific session
   */
  async pruneSession(
    sessionId: string, options: {
      olderThanDays?: number;
      keepNewest?: number;
    }
  ): Promise<PruneResult> {
    if (options.olderThanDays && options.olderThanDays > 0) {
      return this.pruneByRetentionDays(sessionId, options.olderThanDays);
    }
    if (options.keepNewest && options.keepNewest > 0) {
      return this.pruneByMaxMessages(sessionId, options.keepNewest);
    }
    return {
      sessionId, messagesDeleted: 0,
      oldestDeleted: null, newestRetained: null, reason: 'manual',
    };
  }

  /**
   * Get pruning statistics for a user
   */
  async getPruneStats(userId: string = 'default'): Promise<{
    preferences: UserPreferences;
    totalMessagesPruned: number;
    lastPrunedAt: string | null;
    sessionsWithPruneHistory: number;
  }> {
    const prefs = await this.enhancedMemory.getUserPreferences(userId);

    // Aggregate prune metadata across sessions
    let totalPruned = 0;
    let lastPrunedAt: string | null = null;
    let sessionsWithHistory = 0;

    try {
      const sessionsResult = await this.db.executeQuery<{ metadata: string }>(
        `SELECT metadata FROM sessions WHERE metadata LIKE '%pruneHistory%'`
      );
      const sessions = Array.isArray(sessionsResult.data)
        ? sessionsResult.data
        : sessionsResult.data ? [sessionsResult.data] : [];

      for (const s of sessions) {
        try {
          const meta = JSON.parse(s.metadata || '{}');
          if (meta.totalMessagesPruned) {
            totalPruned += meta.totalMessagesPruned;
            sessionsWithHistory++;
          }
          if (meta.lastPrunedAt) {
            if (!lastPrunedAt || meta.lastPrunedAt > lastPrunedAt) {
              lastPrunedAt = meta.lastPrunedAt;
            }
          }
        } catch {
          // Skip malformed metadata
        }
      }
    } catch (error) {
      logger.warn('Failed to get prune stats:', error);
    }

    return {
      preferences: prefs,
      totalMessagesPruned: totalPruned,
      lastPrunedAt,
      sessionsWithPruneHistory: sessionsWithHistory,
    };
  }

  /**
   * Clean up on shutdown
   */
  shutdown(): void {
    for (const [userId, timer] of this.pruneTimers) {
      clearInterval(timer);
      logger.info(`Stopped prune timer for user ${userId}`);
    }
    this.pruneTimers.clear();
  }
}
