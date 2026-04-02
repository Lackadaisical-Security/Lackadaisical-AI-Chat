import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Configuration schema validation
const ConfigSchema = z.object({
  server: z.object({
    frontendPort: z.number().min(1000).max(65535).default(3000),
    backendPort: z.number().min(1000).max(65535).default(3001),
    host: z.string().default('localhost'),
    corsOrigin: z.array(z.string()).default(['http://localhost:3000']),
  }),
  
  database: z.object({
    type: z.enum(['sqlite', 'postgresql', 'mysql']).default('sqlite'),
    path: z.string().optional().default('./database/chat.db'), // For SQLite
    host: z.string().optional(), // For PostgreSQL/MySQL
    port: z.number().optional(), // For PostgreSQL/MySQL
    name: z.string().default('lackadaisical_chat'),
    username: z.string().optional(), // For PostgreSQL/MySQL
    password: z.string().optional(), // For PostgreSQL/MySQL
    encrypted: z.boolean().default(false),
    passphrase: z.string().optional(),
    ssl: z.boolean().default(false), // For PostgreSQL/MySQL
    connectionPool: z.object({
      min: z.number().default(2),
      max: z.number().default(10),
    }).optional(),
  }),
  
  ai: z.object({
    primaryProvider: z.enum(['ollama', 'openai', 'anthropic', 'google', 'xai']).default('ollama'),
    streamMode: z.enum(['sse', 'ws', 'off']).default('sse'),
    models: z.object({
      ollama: z.object({
        default: z.string().default('gpt-oss:20b'),
        uncensored: z.string().default('lackadaisical-uncensored:latest'),
        vision: z.string().default('gemma4:e4b'),
        available: z.array(z.string()).default([
          'gpt-oss:20b',
          'gemma4:e4b',
          'lackadaisical-assistant:latest',
          'lackadaisical-uncensored:latest',
          'llama3.3:latest',
          'llama3.2:latest',
          'llama3.1:latest',
          'llama3:latest',
          'mistral:latest',
          'mixtral:latest',
          'codellama:latest',
          'phi4:latest',
          'gemma2:latest',
          'gemma3:latest',
          'command-r:latest',
          'starcoder2:latest',
        ]),
      }),
      openai: z.string().default('gpt-5.4'),
      anthropic: z.string().default('claude-sonnet-4-6'),
      google: z.string().default('gemini-3.1-flash'),
      xai: z.string().default('grok-4-1-fast-reasoning'),
    }),
    apiKeys: z.object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
      google: z.string().optional(),
      xai: z.string().optional(),
    }),
    ollamaHost: z.string().url().default('http://localhost:11434'),
    ollamaCloudUrl: z.string().url().optional(),
    ollamaCloudApiKey: z.string().optional(),
    contextWindow: z.number().default(262144), // 256k context window for gpt-oss:20b
    extendedThinking: z.boolean().default(true),
    modelCreation: z.object({
      enabled: z.boolean().default(true),
      scriptPath: z.string().default('./scripts/createUncentoredModel.js'),
      modelfilesPath: z.string().default('./scripts/modelfiles'),
    }),
  }),
  
  personality: z.object({
    name: z.string().default('Lacky'),
    baseTraits: z.array(z.string()).default(['friendly', 'curious', 'helpful', 'witty']),
    moodVolatility: z.number().min(0).max(1).default(0.3),
    empathyThreshold: z.number().min(0).max(1).default(0.7),
  }),
  
  plugins: z.object({
    enabled: z.array(z.string()).default(['weather', 'horoscope', 'poem-of-the-day']),
    autoLoad: z.boolean().default(true),
  }),
  
  features: z.object({
    journaling: z.boolean().default(true),
    webSearch: z.boolean().default(true),
    deepResearch: z.boolean().default(true),
    fileUpload: z.boolean().default(true),
    toolUse: z.boolean().default(true),
    codeBlocks: z.boolean().default(true),
    extendedThinking: z.boolean().default(true),
    encryption: z.boolean().default(false),
    dailyReminders: z.boolean().default(false),
  }),
  
  security: z.object({
    jwtSecret: z.string().min(32),
    sessionSecret: z.string().min(32),
    rateLimitWindowMs: z.number().default(900000), // 15 minutes
    rateLimitMaxRequests: z.number().default(100),
  }),
  
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.string().default('./logs/app.log'),
  }),
  
  development: z.object({
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    debugMode: z.boolean().default(false),
  }),
  
  webSearch: z.object({
    timeout: z.number().default(30000),
    maxResults: z.number().default(10),
  }),
  
  journal: z.object({
    reminderTime: z.string().default('21:00'),
    reminderTimezone: z.string().default('America/New_York'),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate configuration from environment variables
 */
function parseConfig(): AppConfig {
  const rawConfig = {
    server: {
      frontendPort: parseInt(process.env.FRONTEND_PORT || '3000', 10),
      backendPort: parseInt(process.env.BACKEND_PORT || '3001', 10),
      host: process.env.BACKEND_HOST || 'localhost',
      corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    },
    database: {
      type: (process.env.DB_TYPE as 'sqlite' | 'postgresql' | 'mysql') || 'sqlite',
      path: process.env.DB_PATH || './database/chat.db',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
      name: process.env.DB_NAME || 'lackadaisical_chat',
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      encrypted: process.env.DB_ENCRYPTED === 'true',
      passphrase: process.env.DB_PASSPHRASE,
      ssl: process.env.DB_SSL === 'true',
      connectionPool: process.env.DB_POOL_MIN && process.env.DB_POOL_MAX ? {
        min: parseInt(process.env.DB_POOL_MIN, 10),
        max: parseInt(process.env.DB_POOL_MAX, 10),
      } : undefined,
    },
    
    ai: {
      primaryProvider: process.env.AI_PRIMARY_PROVIDER || 'ollama',
      streamMode: process.env.STREAM_MODE || 'sse',
      models: {
        ollama: {
          default: process.env.OLLAMA_DEFAULT_MODEL || 'gpt-oss:20b',
          uncensored: process.env.OLLAMA_UNCENSORED_MODEL || 'lackadaisical-uncensored:latest',
          vision: process.env.OLLAMA_VISION_MODEL || 'gemma4:e4b',
          available: (process.env.OLLAMA_AVAILABLE_MODELS?.split(',') || [
            'gpt-oss:20b', 'gemma4:e4b',
            'lackadaisical-assistant:latest', 'lackadaisical-uncensored:latest',
            'llama3.3:latest', 'llama3.2:latest', 'llama3.1:latest', 'llama3:latest',
            'mistral:latest', 'mixtral:latest', 'codellama:latest',
            'phi4:latest',
            'gemma2:latest', 'gemma3:latest',
            'command-r:latest', 'starcoder2:latest',
          ]),
        },
        openai: process.env.OPENAI_MODEL || 'gpt-5.4',
        anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        google: process.env.GOOGLE_MODEL || 'gemini-3.1-flash',
        xai: process.env.XAI_MODEL || 'grok-4-1-fast-reasoning',
      },
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        xai: process.env.XAI_API_KEY,
      },
      ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
      ollamaCloudUrl: process.env.OLLAMA_CLOUD_URL,
      ollamaCloudApiKey: process.env.OLLAMA_CLOUD_API_KEY,
      contextWindow: parseInt(process.env.AI_CONTEXT_WINDOW || '262144', 10),
      extendedThinking: process.env.EXTENDED_THINKING !== 'false',
      ollamaModelsPath: process.env.OLLAMA_MODELS_PATH || './models',
      modelCreation: {
        enabled: process.env.MODEL_CREATION_ENABLED !== 'false',
        scriptPath: process.env.MODEL_CREATION_SCRIPT || './scripts/createUncentoredModel.js',
        modelfilesPath: process.env.MODELFILES_PATH || './scripts/modelfiles',
      },
    },
    
    personality: {
      name: process.env.PERSONALITY_NAME || 'Lacky',
      baseTraits: process.env.PERSONALITY_BASE_TRAITS?.split(',') || ['friendly', 'curious', 'helpful', 'witty'],
      moodVolatility: parseFloat(process.env.MOOD_VOLATILITY || '0.3'),
      empathyThreshold: parseFloat(process.env.EMPATHY_THRESHOLD || '0.7'),
    },
    
    plugins: {
      enabled: process.env.PLUGINS_ENABLED?.split(',') || ['weather', 'horoscope', 'poem-of-the-day'],
      autoLoad: process.env.PLUGINS_AUTO_LOAD !== 'false',
    },
    
    features: {
      journaling: process.env.FEATURE_JOURNALING !== 'false',
      webSearch: process.env.FEATURE_WEB_SEARCH !== 'false',
      deepResearch: process.env.FEATURE_DEEP_RESEARCH !== 'false',
      fileUpload: process.env.FEATURE_FILE_UPLOAD !== 'false',
      toolUse: process.env.FEATURE_TOOL_USE !== 'false',
      codeBlocks: process.env.FEATURE_CODE_BLOCKS !== 'false',
      extendedThinking: process.env.FEATURE_EXTENDED_THINKING !== 'false',
      encryption: process.env.FEATURE_ENCRYPTION === 'true',
      dailyReminders: process.env.FEATURE_DAILY_REMINDERS === 'true',
    },
    
    security: {
      jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      sessionSecret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production',
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
    
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || './logs/app.log',
    },
    
    development: {
      nodeEnv: process.env.NODE_ENV || 'development',
      debugMode: process.env.DEBUG_MODE === 'true',
    },
    
    webSearch: {
      timeout: parseInt(process.env.WEBSEARCH_TIMEOUT || '30000', 10),
      maxResults: parseInt(process.env.WEBSEARCH_MAX_RESULTS || '10', 10),
    },
    
    journal: {
      reminderTime: process.env.JOURNAL_REMINDER_TIME || '21:00',
      reminderTimezone: process.env.JOURNAL_REMINDER_TIMEZONE || 'America/New_York',
    },
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Get validated configuration
 */
export const config = parseConfig();

/**
 * Validate that required secrets are set for production
 */
export function validateProductionSecrets(): void {
  if (config.development.nodeEnv === 'production') {
    const requiredSecrets = [
      { key: 'JWT_SECRET', value: config.security.jwtSecret },
      { key: 'SESSION_SECRET', value: config.security.sessionSecret },
    ];

    const missingSecrets = requiredSecrets.filter(
      ({ value }) => !value || value.includes('change-this-in-production')
    );

    if (missingSecrets.length > 0) {
      console.error('Production secrets validation failed:');
      missingSecrets.forEach(({ key }) => {
        console.error(`  ${key} must be set and not contain default values`);
      });
      process.exit(1);
    }
  }
}

/**
 * Get database path with proper resolution
 */
export function getDatabasePath(): string {
  return path.resolve(config.database.path);
}

/**
 * Check if external API provider is configured
 */
export function isExternalProviderConfigured(provider: string): boolean {
  switch (provider) {
    case 'openai':
      return !!config.ai.apiKeys.openai;
    case 'anthropic':
      return !!config.ai.apiKeys.anthropic;
    case 'google':
      return !!config.ai.apiKeys.google;
    case 'xai':
      return !!config.ai.apiKeys.xai;
    case 'ollama':
      return true; // Always available if Ollama is running
    default:
      return false;
  }
}

export default config; 