import { v4 as uuidv4 } from 'uuid';
import { pluginLogger } from '../utils/logger';
import { config } from '../config/settings';
import { DatabaseService, databaseService } from './DatabaseService';
import {
  Plugin,
  PluginContext,
  PluginState,
  Conversation,
  PersonalityState,
  Session
} from '../types';

// Plugin registry interface
interface PluginRegistry {
  [name: string]: Plugin;
}

// Plugin execution result
interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

export class PluginService {
  private plugins: PluginRegistry = {};
  private isInitialized = false;
  private databaseService: DatabaseService;

  constructor(dbService?: DatabaseService) {
    this.databaseService = dbService || databaseService;
  }

  /**
   * Initialize plugin service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load enabled plugins
      await this.loadEnabledPlugins();
      
      // Initialize each plugin
      await this.initializePlugins();
      
      this.isInitialized = true;
      pluginLogger.info('Plugin service initialized successfully', {
        loadedPlugins: Object.keys(this.plugins),
        enabledPlugins: config.plugins.enabled
      });
    } catch (error) {
      pluginLogger.error('Failed to initialize plugin service:', error);
      throw error;
    }
  }

  /**
   * Load enabled plugins from configuration
   */
  private async loadEnabledPlugins(): Promise<void> {
    const enabledPlugins = config.plugins.enabled;
    
    for (const pluginName of enabledPlugins) {
      try {
        await this.loadPlugin(pluginName);
      } catch (error) {
        pluginLogger.error(`Failed to load plugin ${pluginName}:`, error);
        // Continue loading other plugins even if one fails
      }
    }
  }

  /**
   * Load a single plugin
   */
  private async loadPlugin(pluginName: string): Promise<void> {
    try {
      // Dynamic import of plugin module - go from backend/src/services to root plugins directory
      const pluginModule = await import(`../../../plugins/${pluginName}/index.ts`);
      const plugin: Plugin = pluginModule.default;
      
      // Validate plugin structure
      this.validatePlugin(plugin);
      
      // Store in registry
      this.plugins[pluginName] = plugin;
      
      pluginLogger.info(`Plugin loaded: ${pluginName}`, {
        version: plugin.version,
        author: plugin.author,
        permissions: plugin.permissions
      });
    } catch (error) {
      pluginLogger.error(`Failed to load plugin ${pluginName}:`, error);
      throw new Error(`Plugin ${pluginName} could not be loaded: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: Plugin): void {
    const requiredFields = ['name', 'version', 'description', 'author', 'permissions'];
    
    for (const field of requiredFields) {
      if (!(field in plugin)) {
        throw new Error(`Plugin missing required field: ${field}`);
      }
    }

    if (typeof plugin.name !== 'string' || plugin.name.trim() === '') {
      throw new Error('Plugin name must be a non-empty string');
    }

    if (typeof plugin.version !== 'string' || plugin.version.trim() === '') {
      throw new Error('Plugin version must be a non-empty string');
    }

    if (!Array.isArray(plugin.permissions)) {
      throw new Error('Plugin permissions must be an array');
    }
  }

  /**
   * Initialize all loaded plugins
   */
  private async initializePlugins(): Promise<void> {
    const initPromises = Object.entries(this.plugins).map(async ([name, plugin]) => {
      try {
        if (plugin.init) {
          const pluginState = await databaseService.getPluginState(name);
          const config = pluginState?.config || {};
          
          await plugin.init(config);
          pluginLogger.info(`Plugin initialized: ${name}`);
        }
      } catch (error) {
        pluginLogger.error(`Failed to initialize plugin ${name}:`, error);
        throw error;
      }
    });

    await Promise.all(initPromises);
  }

  /**
   * Execute a plugin
   */
  async executePlugin(
    pluginName: string,
    input: any,
    context: Omit<PluginContext, 'config'>
  ): Promise<PluginResult> {
    if (!this.isInitialized) {
      throw new Error('Plugin service not initialized');
    }

    const plugin = this.plugins[pluginName];
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (!plugin.execute) {
      throw new Error(`Plugin ${pluginName} does not support execution`);
    }

    const startTime = Date.now();

    try {
      // Get plugin configuration
      const pluginState = await databaseService.getPluginState(pluginName);
      const pluginConfig = pluginState?.config || {};

      // Create full context
      const fullContext: PluginContext = {
        ...context,
        config: pluginConfig
      };

      // Execute plugin
      const result = await plugin.execute(input, fullContext);

      const executionTime = Date.now() - startTime;

      // Update plugin usage statistics
      await this.updatePluginUsage(pluginName, executionTime);

      const pluginResult: PluginResult = {
        success: true,
        data: result,
        executionTime,
        metadata: {
          pluginName,
          pluginVersion: plugin.version,
          inputType: typeof input,
          resultType: typeof result
        }
      };

      pluginLogger.info(`Plugin executed successfully: ${pluginName}`, {
        executionTime,
        inputType: typeof input,
        resultType: typeof result
      });

      return pluginResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      pluginLogger.error(`Plugin execution failed: ${pluginName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        metadata: {
          pluginName,
          pluginVersion: plugin.version
        }
      };
    }
  }

  /**
   * Update plugin usage statistics
   */
  private async updatePluginUsage(pluginName: string, executionTime: number): Promise<void> {
    try {
      const currentState = await databaseService.getPluginState(pluginName);
      
      const updates: Partial<PluginState> = {
        last_used: new Date().toISOString(),
        usage_count: (currentState?.usage_count || 0) + 1,
        state_data: {
          ...currentState?.state_data,
          lastExecutionTime: executionTime,
          totalExecutionTime: (currentState?.state_data?.totalExecutionTime || 0) + executionTime,
          averageExecutionTime: this.calculateAverageExecutionTime(
            currentState?.state_data?.totalExecutionTime || 0,
            currentState?.usage_count || 0,
            executionTime
          )
        }
      };

      await databaseService.updatePluginState(pluginName, updates);
    } catch (error) {
      pluginLogger.error(`Failed to update plugin usage for ${pluginName}:`, error);
    }
  }

  /**
   * Calculate average execution time
   */
  private calculateAverageExecutionTime(
    totalTime: number,
    previousCount: number,
    newExecutionTime: number
  ): number {
    const newTotal = totalTime + newExecutionTime;
    const newCount = previousCount + 1;
    return Math.round(newTotal / newCount);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): Plugin[] {
    return Object.values(this.plugins);
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | null {
    return this.plugins[name] || null;
  }

  /**
   * Check if plugin is loaded
   */
  isPluginLoaded(name: string): boolean {
    return name in this.plugins;
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginName: string): Promise<void> {
    try {
      // Load plugin if not already loaded
      if (!this.isPluginLoaded(pluginName)) {
        await this.loadPlugin(pluginName);
      }

      // Update plugin state
      await databaseService.updatePluginState(pluginName, {
        enabled: true,
        updated_at: new Date().toISOString()
      });

      pluginLogger.info(`Plugin enabled: ${pluginName}`);
    } catch (error) {
      pluginLogger.error(`Failed to enable plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginName: string): Promise<void> {
    try {
      // Update plugin state
      await databaseService.updatePluginState(pluginName, {
        enabled: false,
        updated_at: new Date().toISOString()
      });

      pluginLogger.info(`Plugin disabled: ${pluginName}`);
    } catch (error) {
      pluginLogger.error(`Failed to disable plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(pluginName: string, config: Record<string, any>): Promise<void> {
    try {
      await databaseService.updatePluginState(pluginName, {
        config,
        updated_at: new Date().toISOString()
      });

      // Re-initialize plugin with new config if it has an init method
      const plugin = this.plugins[pluginName];
      if (plugin?.init) {
        await plugin.init(config);
      }

      pluginLogger.info(`Plugin configuration updated: ${pluginName}`);
    } catch (error) {
      pluginLogger.error(`Failed to update plugin config for ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin statistics
   */
  async getPluginStats(): Promise<Record<string, any>> {
    try {
      const plugins = await Promise.all(
        Object.keys(this.plugins).map(async (name) => {
          const state = await databaseService.getPluginState(name);
          const plugin = this.plugins[name];
          
          return {
            name,
            version: plugin.version,
            description: plugin.description,
            author: plugin.author,
            enabled: state?.enabled || false,
            usageCount: state?.usage_count || 0,
            lastUsed: state?.last_used,
            averageExecutionTime: state?.state_data?.averageExecutionTime || 0,
            permissions: plugin.permissions
          };
        })
      );

      return {
        totalPlugins: plugins.length,
        enabledPlugins: plugins.filter(p => p.enabled).length,
        plugins
      };
    } catch (error) {
      pluginLogger.error('Failed to get plugin statistics:', error);
      throw error;
    }
  }

  /**
   * Cleanup plugins
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const cleanupPromises = Object.entries(this.plugins).map(async ([name, plugin]) => {
        try {
          if (plugin.cleanup) {
            await plugin.cleanup();
            pluginLogger.info(`Plugin cleaned up: ${name}`);
          }
        } catch (error) {
          pluginLogger.error(`Failed to cleanup plugin ${name}:`, error);
        }
      });

      await Promise.all(cleanupPromises);
      
      this.plugins = {};
      this.isInitialized = false;
      
      pluginLogger.info('Plugin service cleaned up');
    } catch (error) {
      pluginLogger.error('Failed to cleanup plugin service:', error);
      throw error;
    }
  }

  /**
   * Create plugin context from conversation data
   */
  createPluginContext(
    userId: string,
    sessionId: string,
    conversations: Conversation[],
    personalityState: PersonalityState | null,
    session: Session | null
  ): Omit<PluginContext, 'config'> {
    return {
      user_id: userId,
      session_id: sessionId,
      conversation_history: conversations,
      personality_state: personalityState || {
        id: 1,
        name: 'Lacky',
        static_traits: ['friendly', 'helpful'],
        current_mood: { energy: 50, empathy: 50, humor: 50, curiosity: 50, patience: 50 },
        energy_level: 50,
        empathy_level: 50,
        humor_level: 50,
        curiosity_level: 50,
        patience_level: 50,
        conversation_count: 0,
        total_interactions: 0,
        last_interaction: null,
        mood_history: [],
        learning_data: {},
        personality_version: '2.0.0-rc1',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }
    };
  }
}

// Export singleton instance
export const pluginService = new PluginService(); 