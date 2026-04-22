import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { securityLogger as logger } from '../utils/logger';
import { createRateLimitError } from './errorHandler';
import { config } from '../config/settings';
import { anomalyDetectionService } from '../services/AnomalyDetectionService';

// Rate limiter configurations
const rateLimiters = {
  // General API rate limiter
  general: new RateLimiterMemory({
    keyPrefix: 'general',
    points: config.security.rateLimitMaxRequests, // Number of requests
    duration: config.security.rateLimitWindowMs / 1000, // Per duration in seconds
    blockDuration: 60, // Block for 1 minute
  }),

  // Chat endpoint - more restrictive for AI calls
  chat: new RateLimiterMemory({
    keyPrefix: 'chat',
    points: 30, // 30 requests
    duration: 60, // Per minute
    blockDuration: 120, // Block for 2 minutes
  }),

  // Authentication attempts - very restrictive
  auth: new RateLimiterMemory({
    keyPrefix: 'auth',
    points: 5, // 5 attempts
    duration: 900, // Per 15 minutes
    blockDuration: 900, // Block for 15 minutes
  }),

  // Journal entries - moderate limit
  journal: new RateLimiterMemory({
    keyPrefix: 'journal',
    points: 20, // 20 entries
    duration: 3600, // Per hour
    blockDuration: 300, // Block for 5 minutes
  }),

  // Settings/configuration changes - restrictive
  settings: new RateLimiterMemory({
    keyPrefix: 'settings',
    points: 10, // 10 changes
    duration: 300, // Per 5 minutes
    blockDuration: 600, // Block for 10 minutes
  }),

  // File uploads - very restrictive
  upload: new RateLimiterMemory({
    keyPrefix: 'upload',
    points: 5, // 5 uploads
    duration: 300, // Per 5 minutes
    blockDuration: 900, // Block for 15 minutes
  }),
};

/**
 * Get client identifier for rate limiting
 */
function getClientKey(req: Request): string {
  // Use IP address as primary identifier
  let clientKey = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Add user agent fingerprint for additional uniqueness
  const userAgent = req.get('User-Agent');
  if (userAgent) {
    // Simple hash of user agent
    const hash = userAgent.split('').reduce((a: number, b: string) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    clientKey += `_${Math.abs(hash)}`;
  }

  return clientKey;
}

/**
 * Get appropriate rate limiter based on endpoint
 */
function getRateLimiter(req: Request): RateLimiterMemory {
  const path = req.path.toLowerCase();

  if (path.includes('/chat')) {
    return rateLimiters.chat;
  } else if (path.includes('/journal')) {
    return rateLimiters.journal;
  } else if (path.includes('/settings') || path.includes('/config') || path.includes('/personality')) {
    return rateLimiters.settings;
  } else if (path.includes('/upload')) {
    return rateLimiters.upload;
  }
  // Note: /auth routes use the general limiter at the global level.
  // Strict auth rate limiting (login/register) is applied per-route via endpointRateLimiter('auth').

  return rateLimiters.general;
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(res: Response, rateLimiterRes: RateLimiterRes): void {
  res.set({
    'X-RateLimit-Limit': String(rateLimiterRes.consumedPoints || 0),
    'X-RateLimit-Remaining': String(rateLimiterRes.remainingPoints || 0),
    'X-RateLimit-Reset': String(new Date(Date.now() + (rateLimiterRes.msBeforeNext || 0))),
  });
}

/**
 * Rate limiting middleware
 */
export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip rate limiting for health checks and static files
    if (req.path === '/health' || req.path.startsWith('/static/')) {
      return next();
    }

    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const clientKey = getClientKey(req);
    const limiter = getRateLimiter(req);

    // Check rate limit
    const rateLimiterRes = await limiter.consume(clientKey);

    // Add rate limit headers
    addRateLimitHeaders(res, rateLimiterRes);

    // Log successful request would go here

    next();

  } catch (rateLimiterRes) {
    // Rate limit exceeded
    const clientKey = getClientKey(req);
    const isRateLimiterRes = rateLimiterRes && typeof rateLimiterRes === 'object';

    if (isRateLimiterRes) {
      // Add rate limit headers even when blocked
      addRateLimitHeaders(res, rateLimiterRes as RateLimiterRes);
    }

    // Log rate limit hit
    logger.logRateLimitHit(clientKey, req.path);

    // Track in anomaly detection
    anomalyDetectionService.trackAuthFailure(clientKey);

    // Calculate retry after in seconds
    const retryAfter = isRateLimiterRes ? 
      Math.round((rateLimiterRes as RateLimiterRes).msBeforeNext / 1000) : 60;

    res.set('Retry-After', String(retryAfter));

    // Send response directly instead of throwing (avoids uncaught promise rejection)
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const clientKey = getClientKey(req);
    
    // Use auth rate limiter for strict endpoints
    const rateLimiterRes = await rateLimiters.auth.consume(clientKey);
    addRateLimitHeaders(res, rateLimiterRes);
    
    next();

  } catch (rateLimiterRes) {
    const clientKey = getClientKey(req);
    
    logger.logRateLimitHit(clientKey, req.path);
    logger.logSuspiciousActivity(
      'Strict rate limit exceeded',
      clientKey,
      { path: req.path, userAgent: req.get('User-Agent') }
    );

    // Track in anomaly detection
    anomalyDetectionService.trackAuthFailure(clientKey);

    const retryAfter = rateLimiterRes && typeof rateLimiterRes === 'object' ?
      Math.round((rateLimiterRes as RateLimiterRes).msBeforeNext / 1000) : 900;

    res.set('Retry-After', String(retryAfter));

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Strict rate limit exceeded. Try again in ${Math.round(retryAfter / 60)} minutes.`,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Progressive rate limiter that increases delay for repeated violations
 */
export const progressiveRateLimiter = (options: {
  points: number;
  duration: number;
  progressivePenalty?: boolean;
}) => {
  const limiter = new RateLimiterMemory({
    keyPrefix: 'progressive',
    points: options.points,
    duration: options.duration,
    blockDuration: options.duration,
    execEvenly: true, // Spread requests evenly across duration
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientKey = getClientKey(req);
      const rateLimiterRes = await limiter.consume(clientKey);
      
      addRateLimitHeaders(res, rateLimiterRes);
      next();

    } catch (rateLimiterRes) {
      const clientKey = getClientKey(req);
      
      // Progressive penalty - increase block time for repeat offenders
      if (options.progressivePenalty) {
        const blockDuration = Math.min(
          3600, // Max 1 hour
          options.duration * Math.pow(2, (rateLimiterRes as any).totalHits || 1)
        );
        
        // Update limiter with progressive penalty
        await limiter.penalty(clientKey, blockDuration);
      }

      logger.logRateLimitHit(clientKey, req.path);

      const retryAfter = rateLimiterRes && typeof rateLimiterRes === 'object' ?
        Math.round((rateLimiterRes as RateLimiterRes).msBeforeNext / 1000) : options.duration;

      res.set('Retry-After', String(retryAfter));

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded with progressive penalty. Try again in ${retryAfter} seconds.`,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Rate limiter for specific endpoints
 */
export const endpointRateLimiter = (endpoint: keyof typeof rateLimiters) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientKey = getClientKey(req);
      const limiter = rateLimiters[endpoint];
      
      const rateLimiterRes = await limiter.consume(clientKey);
      addRateLimitHeaders(res, rateLimiterRes);
      
      next();

    } catch (rateLimiterRes) {
      const clientKey = getClientKey(req);
      
      logger.logRateLimitHit(clientKey, req.path);

      const retryAfter = rateLimiterRes && typeof rateLimiterRes === 'object' ?
        Math.round((rateLimiterRes as RateLimiterRes).msBeforeNext / 1000) : 60;

      res.set('Retry-After', String(retryAfter));

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `${endpoint} rate limit exceeded. Try again in ${retryAfter} seconds.`,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Reset rate limits for a client (admin function)
 */
export const resetRateLimit = async (clientKey: string): Promise<void> => {
  const promises = Object.values(rateLimiters).map(limiter => 
    limiter.delete(clientKey).catch(() => {}) // Ignore errors
  );
  
  await Promise.all(promises);
  // Log rate limit reset - would use main logger here
};

/**
 * Get rate limit status for a client
 */
export const getRateLimitStatus = async (clientKey: string): Promise<Record<string, any>> => {
  const status: Record<string, any> = {};
  
  for (const [name, limiter] of Object.entries(rateLimiters)) {
    try {
      const res = await limiter.get(clientKey);
      status[name] = {
        remaining: res ? res.remainingPoints : limiter.points,
        resetTime: res ? new Date(Date.now() + res.msBeforeNext) : null,
        blocked: res ? res.msBeforeNext > 0 && res.remainingPoints === 0 : false
      };
    } catch (error) {
      status[name] = { error: 'Failed to get status' };
    }
  }
  
  return status;
};

export default rateLimiter; 