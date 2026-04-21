/**
 * Emulator Routes — REST API for the Traffic Emulator Service
 *
 * Provides endpoints to start/stop emulator sessions, run searches,
 * navigate to URLs, and monitor session status.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { trafficEmulatorService, ProxyConfig, SearchRequest } from '../services/TrafficEmulatorService';
import { aiLogger } from '../utils/logger';

const router = Router();
router.use(endpointRateLimiter('chat'));

/**
 * POST /api/v1/emulator/start — Start a new emulator session
 * Body: { proxy?: ProxyConfig, fingerprint?: Partial<Fingerprint> }
 */
router.post('/start', asyncHandler(async (req: Request, res: Response) => {
  const { proxy, fingerprint } = req.body;

  const session = await trafficEmulatorService.startSession({ proxy, fingerprint });

  res.status(201).json({
    success: true,
    data: session,
    message: 'Emulator session started',
  });
}));

/**
 * GET /api/v1/emulator/sessions — List all active sessions
 */
router.get('/sessions', asyncHandler(async (_req: Request, res: Response) => {
  const sessions = trafficEmulatorService.getAllSessions();

  res.json({
    success: true,
    data: {
      sessions,
      total: sessions.length,
    },
  });
}));

/**
 * GET /api/v1/emulator/sessions/:sessionId — Get session details
 */
router.get('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = trafficEmulatorService.getSession(sessionId);

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  res.json({ success: true, data: session });
}));

/**
 * POST /api/v1/emulator/sessions/:sessionId/stop — Stop an emulator session
 */
router.post('/sessions/:sessionId/stop', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = trafficEmulatorService.getSession(sessionId);

  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  await trafficEmulatorService.stopSession(sessionId);

  res.json({
    success: true,
    message: `Session ${sessionId} stopped`,
  });
}));

/**
 * POST /api/v1/emulator/search — Run a search across a search engine
 * Body: { sessionId: string, query: string, engine: string, maxResults?: number, extractContent?: boolean }
 */
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, query, engine, maxResults, extractContent } = req.body;

  if (!sessionId || !query || !engine) {
    res.status(400).json({
      success: false,
      error: 'sessionId, query, and engine are required',
    });
    return;
  }

  const validEngines = ['google', 'bing', 'yahoo', 'duckduckgo'];
  if (!validEngines.includes(engine)) {
    res.status(400).json({
      success: false,
      error: `Invalid engine. Use: ${validEngines.join(', ')}`,
    });
    return;
  }

  const searchRequest: SearchRequest = {
    query,
    engine,
    maxResults: maxResults || 10,
    extractContent: extractContent || false,
  };

  const results = await trafficEmulatorService.search(sessionId, searchRequest);

  res.json({
    success: true,
    data: {
      query,
      engine,
      results,
      resultCount: results.length,
    },
  });
}));

/**
 * POST /api/v1/emulator/navigate — Navigate to a specific URL
 * Body: { sessionId: string, url: string }
 */
router.post('/navigate', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, url } = req.body;

  if (!sessionId || !url) {
    res.status(400).json({
      success: false,
      error: 'sessionId and url are required',
    });
    return;
  }

  const content = await trafficEmulatorService.navigate(sessionId, url);

  res.json({
    success: true,
    data: {
      url,
      contentLength: content.length,
      content: content.substring(0, 20000), // Limit response size
    },
  });
}));

/**
 * POST /api/v1/emulator/stop-all — Stop all emulator sessions
 */
router.post('/stop-all', asyncHandler(async (_req: Request, res: Response) => {
  await trafficEmulatorService.shutdown();

  res.json({
    success: true,
    message: 'All emulator sessions stopped',
  });
}));

export default router;
