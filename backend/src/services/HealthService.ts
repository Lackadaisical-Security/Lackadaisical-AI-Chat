import * as os from 'os';
import { DatabaseService } from './DatabaseService';
import AIService from './AIService';
import { config } from '../config/settings';
import { logger } from '../utils/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    ai: ServiceHealth;
    memory: ServiceHealth;
    plugins: ServiceHealth;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
    };
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}

export class HealthService {
  private databaseService: DatabaseService;
  private aiService: AIService;
  private startTime: Date;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.aiService = new AIService(databaseService);
    this.startTime = new Date();
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Test database with a simple query
      await this.databaseService.getSessions();
      
      return {
        status: 'up',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          type: 'sqlite',
          connected: true
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'down',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check AI service health
   */
  private async checkAIHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const healthStatus = await this.aiService.getHealthStatus();
      
      return {
        status: healthStatus.status === 'healthy' ? 'up' : 
                healthStatus.status === 'degraded' ? 'degraded' : 'down',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          providers: healthStatus.providers,
          details: healthStatus.details
        }
      };
    } catch (error) {
      logger.error('AI health check failed:', error);
      return {
        status: 'down',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check memory service health
   */
  private async checkMemoryHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Check if we can access memory-related database tables
      await this.databaseService.executeQuery(
        'SELECT COUNT(*) as count FROM conversations LIMIT 1'
      );
      
      return {
        status: 'up',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          conversationsAccessible: true
        }
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check plugins health
   */
  private async checkPluginsHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const enabledPlugins = config.plugins.enabled;
      
      return {
        status: 'up',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          enabledPlugins,
          count: enabledPlugins.length
        }
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const loadAverage = os.loadavg();

    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / totalMemory) * 100)
      },
      cpu: {
        loadAverage: loadAverage.map((avg: number) => Math.round(avg * 100) / 100)
      }
    };
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallStatus(services: HealthStatus['services']): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(services).map(s => s.status);
    
    if (statuses.every(s => s === 'up')) {
      return 'healthy';
    }
    
    if (statuses.includes('down')) {
      // Database down = unhealthy
      if (services.database.status === 'down') {
        return 'unhealthy';
      }
      return 'degraded';
    }
    
    return 'degraded';
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const [databaseHealth, aiHealth, memoryHealth, pluginsHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkAIHealth(),
      this.checkMemoryHealth(),
      this.checkPluginsHealth()
    ]);

    const services = {
      database: databaseHealth,
      ai: aiHealth,
      memory: memoryHealth,
      plugins: pluginsHealth
    };

    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      status: this.calculateOverallStatus(services),
      timestamp: new Date().toISOString(),
      version: '2.0.0-rc1',
      uptime,
      services,
      system: this.getSystemMetrics()
    };
  }

  /**
   * Get simple liveness check
   */
  isAlive(): boolean {
    return true; // If this code is running, the service is alive
  }

  /**
   * Get readiness check
   */
  async isReady(): Promise<boolean> {
    try {
      const dbHealth = await this.checkDatabaseHealth();
      return dbHealth.status === 'up';
    } catch {
      return false;
    }
  }
}

export default HealthService;
