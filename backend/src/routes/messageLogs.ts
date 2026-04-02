/**
 * Message log routes - Access the separate message log database
 * Provides endpoints for viewing message logs, thinking content, and search
 */

import { Router, Request, Response, NextFunction } from 'express';
import { messageLogService } from '../services/MessageLogService';
import { aiLogger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/logs/session/:sessionId
 * Get message log for a session
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const entries = messageLogService.getSessionLog(sessionId, limit, offset);

    res.json({
      success: true,
      data: {
        entries,
        total: entries.length,
        sessionId,
        limit,
        offset,
      },
    });
  } catch (error) {
    aiLogger.error('Failed to get session log:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve session log' });
  }
});

/**
 * GET /api/v1/logs/thinking
 * Get messages with thinking content
 */
router.get('/thinking', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const entries = messageLogService.getThinkingLog(sessionId, limit);

    res.json({
      success: true,
      data: {
        entries,
        total: entries.length,
      },
    });
  } catch (error) {
    aiLogger.error('Failed to get thinking log:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve thinking log' });
  }
});

/**
 * GET /api/v1/logs/search
 * Search across message logs
 */
router.get('/search', (req: Request, res: Response) => {
  const query = req.query.q as string;
  const sessionId = req.query.sessionId as string | undefined;
  const role = req.query.role as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  if (!query) {
    res.status(400).json({ success: false, error: 'Search query (q) is required' });
    return;
  }

  try {
    const entries = messageLogService.searchLogs(query, { sessionId, role, limit });

    res.json({
      success: true,
      data: {
        query,
        entries,
        total: entries.length,
      },
    });
  } catch (error) {
    aiLogger.error('Failed to search logs:', error);
    res.status(500).json({ success: false, error: 'Failed to search logs' });
  }
});

/**
 * GET /api/v1/logs/stats
 * Get message log statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = messageLogService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    aiLogger.error('Failed to get log stats:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve log statistics' });
  }
});

export default router;
