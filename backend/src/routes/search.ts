/**
 * Web Search and Deep Research routes
 * Provides endpoints for web search, deep research with steering, and tool execution
 */

import { Router, Request, Response, NextFunction } from 'express';
import { webSearchService } from '../services/WebSearchService';
import { toolExecutionService } from '../services/ToolExecutionService';
import { aiLogger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/search
 * Perform a web search
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, maxResults, timeRange, language, safeSearch } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ success: false, error: 'query is required' });
      return;
    }

    const results = await webSearchService.search(query.trim(), {
      maxResults: Math.min(maxResults || 10, 20),
      timeRange: timeRange || 'all',
      language: language || 'en',
      safeSearch: safeSearch !== false,
    });

    res.json({
      success: true,
      data: {
        query: results.query,
        results: results.results,
        provider: results.provider,
        totalResults: results.totalResults,
        searchTimeMs: results.searchTimeMs,
        sourcesUsed: results.sourcesUsed,
      },
    });
  } catch (error) {
    aiLogger.error('Search endpoint failed:', error);
    next(error);
  }
});

/**
 * POST /api/v1/search/deep-research
 * Perform deep research with steering
 */
router.post('/deep-research', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      query,
      steeringPrompt,
      focusAreas,
      maxDepth,
      maxSources,
      excludeDomains,
      timeRange,
    } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ success: false, error: 'query is required' });
      return;
    }

    // For SSE streaming of progress
    const isStreaming = req.headers.accept === 'text/event-stream';

    if (isStreaming) {
      // Stream progress updates via SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const result = await webSearchService.deepResearch(
        query.trim(),
        {
          steeringPrompt,
          focusAreas,
          maxDepth: Math.min(maxDepth || 3, 5),
          maxSources: Math.min(maxSources || 10, 20),
          excludeDomains,
          timeRange: timeRange || 'all',
          synthesize: true,
        },
        (progress) => {
          res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`);
      res.end();
    } else {
      // Regular JSON response
      const result = await webSearchService.deepResearch(
        query.trim(),
        {
          steeringPrompt,
          focusAreas,
          maxDepth: Math.min(maxDepth || 3, 5),
          maxSources: Math.min(maxSources || 10, 20),
          excludeDomains,
          timeRange: timeRange || 'all',
          synthesize: true,
        }
      );

      res.json({
        success: true,
        data: {
          query: result.query,
          steeringPrompt: result.steeringPrompt,
          allSources: result.allSources,
          totalSourcesFetched: result.totalSourcesFetched,
          researchTimeMs: result.researchTimeMs,
          phases: result.phases.map(p => ({
            query: p.query,
            resultCount: p.results.length,
            fetchedCount: p.fetchedContent.length,
          })),
          synthesisContext: result.synthesisContext,
        },
      });
    }
  } catch (error) {
    aiLogger.error('Deep research endpoint failed:', error);
    next(error);
  }
});

/**
 * POST /api/v1/search/tool
 * Execute a tool directly
 */
router.post('/tool', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, params } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'tool name is required' });
      return;
    }

    const result = await toolExecutionService.executeTool(name, params || {});

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    aiLogger.error('Tool execution endpoint failed:', error);
    next(error);
  }
});

/**
 * GET /api/v1/search/tools
 * Get available tools
 */
router.get('/tools', (req: Request, res: Response) => {
  const tools = toolExecutionService.getToolDefinitions();

  res.json({
    success: true,
    data: {
      tools,
      total: tools.length,
    },
  });
});

export default router;
