import { Router, Request, Response } from 'express';
import { DatabaseService, databaseService } from '../services/DatabaseService';
import { HealthStatus } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { apiLogger } from '../utils/logger';
import { config } from '../config/settings';

const router = Router();

// Use the singleton database service instead of creating duplicate instances
const db = databaseService;

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<'up' | 'down'> {
  try {
    await db.getDatabaseStats();
    return 'up';
  } catch (error) {
    apiLogger.error('Database health check failed:', error);
    return 'down';
  }
}

/**
 * Check AI providers health
 */
async function checkAIProvidersHealth(): Promise<Record<string, 'up' | 'down'>> {
  const providers: Record<string, 'up' | 'down'> = {};
  
  // Check Ollama if it's the primary provider
  if (config.ai.primaryProvider === 'ollama') {
    try {
      // Simple HTTP check to Ollama endpoint
      const response = await fetch(`${config.ai.ollamaHost}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      providers.ollama = response.ok ? 'up' : 'down';
    } catch (error) {
      providers.ollama = 'down';
    }
  }
  
  // Check external API providers based on configuration
  const externalProviders = ['openai', 'anthropic', 'google', 'xai'];
  for (const provider of externalProviders) {
    const apiKey = config.ai.apiKeys[provider as keyof typeof config.ai.apiKeys];
    if (apiKey && apiKey !== '') {
      // For now, just mark as up if API key is configured
      // In a real implementation, you might make a test API call
      providers[provider] = 'up';
    }
  }
  
  return providers;
}

/**
 * Check plugins health
 */
async function checkPluginsHealth(): Promise<Record<string, 'up' | 'down'>> {
  const plugins: Record<string, 'up' | 'down'> = {};
  
  try {
    for (const pluginName of config.plugins.enabled) {
      const pluginState = await db.getPluginState(pluginName);
      plugins[pluginName] = pluginState?.enabled ? 'up' : 'down';
    }
  } catch (error) {
    apiLogger.error('Plugin health check failed:', error);
    // Mark all plugins as down if check fails
    for (const pluginName of config.plugins.enabled) {
      plugins[pluginName] = 'down';
    }
  }
  
  return plugins;
}

/**
 * Determine overall health status
 */
function determineOverallStatus(
  dbStatus: 'up' | 'down',
  aiProviders: Record<string, 'up' | 'down'>,
  plugins: Record<string, 'up' | 'down'>
): 'healthy' | 'degraded' | 'unhealthy' {
  // Critical: database must be up
  if (dbStatus === 'down') {
    return 'unhealthy';
  }
  
  // Check if primary AI provider is up
  const primaryProviderStatus = aiProviders[config.ai.primaryProvider];
  if (primaryProviderStatus === 'down') {
    return 'unhealthy';
  }
  
  // Check if any services are down (degraded but not critical)
  const allServices = [...Object.values(aiProviders), ...Object.values(plugins)];
  const hasDownServices = allServices.some(status => status === 'down');
  
  return hasDownServices ? 'degraded' : 'healthy';
}

/**
 * GET /health - Basic health check
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Perform all health checks in parallel
    const [dbStatus, aiProviders, plugins] = await Promise.all([
      checkDatabaseHealth(),
      checkAIProvidersHealth(),
      checkPluginsHealth()
    ]);
    
    // Determine overall status
    const overallStatus = determineOverallStatus(dbStatus, aiProviders, plugins);
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        ai_providers: aiProviders,
        plugins: plugins
      },
      version: '2.0.0-rc1'
    };
    
    const responseTime = Date.now() - startTime;
    
    // Log health check
    apiLogger.info('Health check completed', {
      status: overallStatus,
      responseTime: `${responseTime}ms`,
      services: {
        database: dbStatus,
        ai_providers: Object.keys(aiProviders).length,
        plugins: Object.keys(plugins).length
      }
    });
    
    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      health: healthStatus,
      response_time_ms: responseTime
    });
    
  } catch (error) {
    apiLogger.error('Health check failed:', error);
    
    const healthStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        ai_providers: {},
        plugins: {}
      },
      version: '2.0.0-rc1'
    };
    
    res.status(503).json({
      health: healthStatus,
      error: 'Health check failed',
      response_time_ms: Date.now() - startTime
    });
  }
}));

/**
 * GET /health/ping - Simple ping endpoint
 */
router.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0-rc1'
  });
});

/**
 * GET /health/detailed - Detailed health information
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Get detailed system information
    const [dbStatus, aiProviders, plugins, dbStats] = await Promise.all([
      checkDatabaseHealth(),
      checkAIProvidersHealth(),
      checkPluginsHealth(),
      db.getDatabaseStats()
    ]);
    
    const overallStatus = determineOverallStatus(dbStatus, aiProviders, plugins);
    
    const detailedHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '2.0.0-rc1',
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        node_version: process.version,
        environment: config.development.nodeEnv
      },
      services: {
        database: {
          status: dbStatus,
          stats: dbStats,
          path: config.database.path
        },
        ai_providers: {
          primary: config.ai.primaryProvider,
          stream_mode: config.ai.streamMode,
          providers: aiProviders
        },
        plugins: {
          enabled_count: config.plugins.enabled.length,
          auto_load: config.plugins.autoLoad,
          states: plugins
        }
      },
      features: {
        journaling: config.features.journaling,
        web_search: config.features.webSearch,
        encryption: config.features.encryption,
        daily_reminders: config.features.dailyReminders
      },
      configuration: {
        personality_name: config.personality.name,
        mood_volatility: config.personality.moodVolatility,
        empathy_threshold: config.personality.empathyThreshold
      }
    };
    
    const responseTime = Date.now() - startTime;
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      health: detailedHealth,
      response_time_ms: responseTime
    });
    
  } catch (error) {
    apiLogger.error('Detailed health check failed:', error);
    res.status(503).json({
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime
    });
  }
}));

/**
 * GET /health/readiness - Kubernetes readiness probe
 */
router.get('/readiness', asyncHandler(async (req: Request, res: Response) => {
  try {
    const dbStatus = await checkDatabaseHealth();
    const aiProviders = await checkAIProvidersHealth();
    
    const ready = dbStatus === 'up' && aiProviders[config.ai.primaryProvider] === 'up';
    
    if (ready) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        details: {
          database: dbStatus,
          primary_ai_provider: aiProviders[config.ai.primaryProvider] || 'down'
        }
      });
    }
    
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /health/liveness - Kubernetes liveness probe
 */
router.get('/liveness', (req: Request, res: Response) => {
  // Simple liveness check - just verify the process is running
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router; 