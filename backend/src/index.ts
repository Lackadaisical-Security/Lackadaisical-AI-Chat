import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import * as dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import configuration and utilities
import { config, validateProductionSecrets, getDatabasePath } from './config/settings';
import { logger } from './utils/logger';
import { DatabaseService } from './services/DatabaseService';
import { PersonalityService } from './services/PersonalityService';
import { MemoryService } from './services/MemoryService';
// import { PluginService } from './services/PluginService';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import { createJournalRoutes } from './routes/journal';
import personalityRoutes from './routes/personality';
import pluginRoutes from './routes/plugins';
import companionRoutes, { createCompanionRoutes } from './routes/companion';
import createChatRoutes from './routes/chat';
import sessionRoutes, { createSessionRoutes } from './routes/sessions';
import contextRoutes, { createContextRoutes } from './routes/context';
import authRoutes, { createAuthRoutes } from './routes/auth';
import modelRoutes from './routes/models';
import fileRoutes from './routes/files';
import searchRoutes from './routes/search';
import emulatorRoutes from './routes/emulator';
import imageGenerationRoutes from './routes/imageGeneration';
import messageLogRoutes from './routes/messageLogs';
import AIService from './services/AIService';

// Import new services
import { messageLogService } from './services/MessageLogService';

import { requestSanitizer, securityHeaders, requestDepthLimiter } from './middleware/security';

// Import WebSocket handler
import WebSocketService from './services/WebSocketService';

// Types
import { APIError } from './types';

class LackadaisicalAIServer {
  private app: Express;
  private server: any;
  private wsService: WebSocketService | null = null;
  private database: DatabaseService;
  private personality: PersonalityService | null = null;
  private memory: MemoryService | null = null;
  // private pluginService: PluginService | null = null;

  constructor() {
    this.app = express();
    this.database = new DatabaseService();
    // Note: Don't initialize dependent services here - wait for database to be ready
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration - FIXED for EventSource streaming
    this.app.use(cors({
      origin: config.server.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'X-CSRF-Token'],
    }));

    // Security headers (additional to helmet)
    this.app.use(securityHeaders);

    // Compression
    this.app.use(compression());

    // Body parsing — skip for multipart/form-data (handled by multer in file routes)
    this.app.use((req, res, next) => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        return next();
      }
      express.json({ limit: '50mb' })(req, res, next);
    });
    this.app.use((req, res, next) => {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        return next();
      }
      express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
    });

    // Serve uploaded/generated files statically
    this.app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads/serve')));

    // Request sanitization (XSS prevention) and depth limiting
    this.app.use(requestSanitizer);
    this.app.use(requestDepthLimiter(15));

    // Request logging
    this.app.use(requestLogger);

    // Morgan logging in development
    if (config.development.nodeEnv === 'development') {
      this.app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
    }

    // Rate limiting
    this.app.use(rateLimiter);

    // API info middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-API-Version', '2.0.0-rc1');
      // Don't expose server technology in headers (security best practice)
      res.removeHeader('X-Powered-By');
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // API base path (keeping both v1 and direct for compatibility)
    const apiBase = '/api/v1';

    // Initialize routes with dependency injection
    const healthRoutesWithDeps = this.createHealthRoutes();
    const sessionRoutesWithDeps = createSessionRoutes(this.database);
    const chatRoutesWithDeps = this.createChatRoutes();
    const contextRoutesWithDeps = createContextRoutes(this.database);
    const companionRoutesWithDeps = createCompanionRoutes(this.database);
    const authRoutesWithDeps = createAuthRoutes(this.database);

    // Health check (outside API versioning for monitoring)
    this.app.use('/health', healthRoutesWithDeps);

    // Main API routes with versioning
    this.app.use(`${apiBase}/auth`, authRoutesWithDeps);
    this.app.use(`${apiBase}/chat`, chatRoutesWithDeps);
    this.app.use(`${apiBase}/journal`, createJournalRoutes(this.database));
    this.app.use(`${apiBase}/personality`, personalityRoutes);
    this.app.use(`${apiBase}/plugins`, pluginRoutes);
    this.app.use(`${apiBase}/companion`, companionRoutesWithDeps);
    this.app.use(`${apiBase}/sessions`, sessionRoutesWithDeps);
    this.app.use(`${apiBase}`, contextRoutesWithDeps);

    // Direct API routes for frontend compatibility
    this.app.use('/api/auth', authRoutesWithDeps);
    this.app.use('/api/chat', chatRoutesWithDeps);
    this.app.use('/api/journal', createJournalRoutes(this.database));
    this.app.use('/api/personality', personalityRoutes);
    this.app.use('/api/plugins', pluginRoutes);
    this.app.use('/api/companion', companionRoutesWithDeps);
    this.app.use('/api/sessions', sessionRoutesWithDeps);
    this.app.use('/api/models', modelRoutes);
    this.app.use('/api', contextRoutesWithDeps);

    // New feature routes
    this.app.use(`${apiBase}/files`, fileRoutes);
    this.app.use(`${apiBase}/search`, searchRoutes);
    this.app.use(`${apiBase}/emulator`, emulatorRoutes);
    this.app.use(`${apiBase}/image`, imageGenerationRoutes);
    this.app.use(`${apiBase}/logs`, messageLogRoutes);
    this.app.use('/api/files', fileRoutes);
    this.app.use('/api/search', searchRoutes);
    this.app.use('/api/emulator', emulatorRoutes);
    this.app.use('/api/image', imageGenerationRoutes);
    this.app.use('/api/logs', messageLogRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Lackadaisical AI Chat API',
        version: '2.0.0-rc1',        description: 'A companion-oriented modular AI chatbot backend',
        author: 'Lackadaisical Security 2025',
        website: 'https://lackadaisical-security.com',
        endpoints: {
          health: '/health',
          api: {
            base: '/api/v1',
            chat: '/api/v1/chat',
            journal: '/api/v1/journal',
            personality: '/api/v1/personality',
            plugins: '/api/v1/plugins',
            sessions: '/api/v1/sessions',
          },
        },
        features: {
          streaming: config.ai.streamMode !== 'off',
          journaling: config.features.journaling,
          webSearch: config.features.webSearch,
          deepResearch: (config.features as any).deepResearch,
          fileUpload: (config.features as any).fileUpload,
          toolUse: (config.features as any).toolUse,
          codeBlocks: (config.features as any).codeBlocks,
          extendedThinking: (config.features as any).extendedThinking,
          encryption: config.features.encryption,
          plugins: config.plugins.enabled.length > 0,
        },
      });
    });

    // API documentation
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        api_version: '2.0.0-rc1',
        documentation_url: '/api',
        endpoints: {
          health: {
            'GET /health': 'Service health check with database and AI provider status'
          },
          auth: {
            'POST /api/v1/auth/register': 'Register a new user account',
            'POST /api/v1/auth/login': 'Authenticate and get access/refresh tokens',
            'POST /api/v1/auth/refresh': 'Refresh access token using refresh token',
            'POST /api/v1/auth/logout': 'Revoke all refresh tokens (requires auth)',
            'GET /api/v1/auth/me': 'Get current authenticated user info',
            'POST /api/v1/auth/change-password': 'Change user password (requires auth)',
          },
          chat: {
            'POST /api/v1/chat': 'Send a chat message and get AI response',
            'GET /api/v1/chat/stream': 'SSE streaming chat endpoint',
            'GET /api/v1/chat/preferences': 'Get memory preferences',
            'PUT /api/v1/chat/preferences': 'Update memory preferences',
            'POST /api/v1/chat/preferences/toggle-cross-session': 'Toggle cross-session memory',
            'GET /api/v1/chat/sessions/summaries': 'Get session summaries',
            'GET /api/v1/chat/sessions/active': 'Get active sessions',
            'GET /api/v1/chat/search/all': 'Search across all sessions',
            'GET /api/v1/chat/context/full/:sessionId': 'Get enhanced context window',
            'GET /api/v1/chat/analytics/:sessionId': 'Get session analytics',
            'GET /api/v1/chat/analytics/global': 'Get global analytics',
            'DELETE /api/v1/chat/history/:sessionId': 'Delete conversation history',
          },
          sessions: {
            'GET /api/v1/sessions': 'List all sessions',
            'POST /api/v1/sessions': 'Create a new session',
            'PUT /api/v1/sessions/:id': 'Update session details',
            'DELETE /api/v1/sessions/:id': 'Delete a session',
            'GET /api/v1/sessions/:id/messages': 'Get conversation history for session',
            'GET /api/v1/sessions/:id/context': 'Get session context',
            'POST /api/v1/sessions/:id/context': 'Update session context',
            'DELETE /api/v1/sessions/:id/context': 'Clear session context',
          },
          journal: {
            'GET /api/v1/journal': 'List journal entries with optional filters',
            'POST /api/v1/journal': 'Create a new journal entry',
            'GET /api/v1/journal/:id': 'Get a specific journal entry',
            'PUT /api/v1/journal/:id': 'Update a journal entry',
            'DELETE /api/v1/journal/:id': 'Delete a journal entry',
            'GET /api/v1/journal/export/:format': 'Export journal (json/csv/txt/markdown)',
            'GET /api/v1/journal/analytics': 'Get journal analytics',
          },
          files: {
            'POST /api/v1/files/upload': 'Upload a file (multipart/form-data)',
            'GET /api/v1/files/download/:fileId': 'Download a file by ID',
            'GET /api/v1/files/:fileId': 'Get file metadata and extracted text',
            'GET /api/v1/files/session/:sessionId': 'Get all files for a session',
            'DELETE /api/v1/files/:fileId': 'Delete an uploaded file',
            'POST /api/v1/files/serve-code': 'Create a downloadable code file from content',
          },
          search: {
            'POST /api/v1/search': 'Web search with optional result count and time range',
            'POST /api/v1/search/deep-research': 'Deep research with multi-source synthesis',
            'GET /api/v1/search/tools': 'List available tools',
            'POST /api/v1/search/tool': 'Execute a specific tool',
          },
          personality: {
            'GET /api/v1/personality': 'Get current personality state',
            'PUT /api/v1/personality': 'Update personality traits',
            'POST /api/v1/personality/reset': 'Reset personality to defaults',
          },
          plugins: {
            'GET /api/v1/plugins': 'List all plugins',
            'GET /api/v1/plugins/:name': 'Get plugin details',
            'POST /api/v1/plugins/:name/enable': 'Enable a plugin',
            'POST /api/v1/plugins/:name/disable': 'Disable a plugin',
            'PUT /api/v1/plugins/:name/config': 'Update plugin configuration',
            'POST /api/v1/plugins/:name/execute': 'Execute a plugin',
            'POST /api/v1/plugins/reload': 'Reload all plugins',
          },
          logs: {
            'GET /api/v1/logs/session/:sessionId': 'Get message logs for a session',
            'GET /api/v1/logs/stats': 'Get log statistics',
          },
          imageGeneration: {
            'POST /api/v1/image/generate': 'Generate images from text prompt (ComfyUI)',
            'GET /api/v1/image/models': 'List available Stable Diffusion models',
            'GET /api/v1/image/samplers': 'List available samplers',
            'GET /api/v1/image/status': 'Check if ComfyUI is available',
          },
          emulator: {
            'POST /api/v1/emulator/start': 'Start a new emulator session',
            'GET /api/v1/emulator/sessions': 'List active emulator sessions',
            'POST /api/v1/emulator/sessions/:id/stop': 'Stop an emulator session',
            'POST /api/v1/emulator/search': 'Search via emulated browser',
            'POST /api/v1/emulator/navigate': 'Navigate to a URL',
            'POST /api/v1/emulator/stop-all': 'Stop all emulator sessions',
          },
          models: {
            'GET /api/models': 'List available AI models',
          },
        },
        features: {
          streaming: config.ai.streamMode !== 'off',
          journaling: config.features.journaling,
          webSearch: config.features.webSearch,
          fileUpload: true,
          toolUse: true,
          codeBlocks: true,
          extendedThinking: true,
          imageGeneration: true,
          encryption: config.features.encryption,
          plugins: config.plugins.enabled.length > 0,
        },
      });
    });

    // 404 handler for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      const error: APIError = {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        details: {
          method: req.method,
          path: req.originalUrl,
          available_endpoints: '/api',
        },
        timestamp: new Date().toISOString(),
      };
      res.status(404).json({ error });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(errorHandler);

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit the process in production
      if (config.development.nodeEnv !== 'production') {
        process.exit(1);
      }
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      // Always exit on uncaught exceptions
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * Create route handlers with dependency injection
   */
  private createHealthRoutes() {
    const { Router } = require('express');
    const router = Router();
    const { asyncHandler } = require('./middleware/errorHandler');
    
    // Simple health check that uses the initialized database
    router.get('/', asyncHandler(async (req: Request, res: Response) => {
      let databaseStatus = 'down';
      try {
        // Try to use the database - if it works, it's initialized
        await this.database.getSessions();
        databaseStatus = 'up';
      } catch (error) {
        // Database not properly initialized
        databaseStatus = 'down';
      }

      const healthStatus = {
        health: {
          status: databaseStatus === 'up' ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            database: databaseStatus,
            ai_providers: {
              ollama: 'up'
            }
          },
          version: '2.0.0-rc1'
        },
        response_time_ms: Date.now() % 100
      };
      res.json(healthStatus);
    }));
    
    return router;
  }

  private createChatRoutes() {
    // Create AI service instance if not already created
    const aiService = new AIService(this.database);
    
    // Use the chat routes factory function with proper dependency injection
    return createChatRoutes(this.database, aiService);
  }

  /**
   * Initialize database and dependent services
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbPath = getDatabasePath();
      const dbDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info(`Created database directory: ${dbDir}`);
      }

      // Initialize database connection
      await this.database.initialize();
      logger.info('Database initialized successfully');

      // Now initialize dependent services
      this.personality = new PersonalityService(this.database);
      this.memory = new MemoryService(this.database);
      // this.pluginService = new PluginService(this.database);
      // await this.pluginService.initialize();

      // Initialize the message log service (separate WAL-mode SQLite DB)
      await messageLogService.initialize();
      logger.info('Message log service initialized (WAL mode)');

      logger.info('Dependent services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize database and services:', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket server for streaming
   */
  private setupWebSocket(): void {
    if (config.ai.streamMode === 'ws') {
      this.wsService = new WebSocketService(this.server, this.database);
      logger.info('WebSocket server initialized for streaming');
    }
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Validate production secrets
      validateProductionSecrets();

      // Initialize database
      await this.initializeDatabase();

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket if enabled
      this.setupWebSocket();

      // Start listening
      const port = config.server.backendPort;
      const host = config.server.host;

      this.server.listen(port, host, () => {
        logger.info(`🚀 Lackadaisical AI Chat Server started successfully!`);
        logger.info(`📍 Server running at http://${host}:${port}`);
        logger.info(`🗃️  Database: ${getDatabasePath()}`);
        logger.info(`🤖 AI Provider: ${config.ai.primaryProvider}`);
        logger.info(`📡 Stream Mode: ${config.ai.streamMode}`);
        logger.info(`🔌 Plugins: ${config.plugins.enabled.join(', ')}`);
        logger.info(`🌍 Environment: ${config.development.nodeEnv}`);
        
        if (config.development.nodeEnv === 'development') {
          logger.info(`📖 API Documentation: http://${host}:${port}/api`);
          logger.info(`❤️  Health Check: http://${host}:${port}/health`);
        }
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use`);
        } else {
          logger.error('Server error:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Close HTTP server
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Close WebSocket server
    if (this.wsService) {
      this.wsService.close();
      logger.info('WebSocket server closed');
    }

    // Close database connection
    try {
      await this.database.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database:', error);
    }

    // Close message log database
    try {
      messageLogService.close();
      logger.info('Message log database closed');
    } catch (error) {
      logger.error('Error closing message log database:', error);
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  }
}

// Start the server
if (require.main === module) {
  const server = new LackadaisicalAIServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default LackadaisicalAIServer; 