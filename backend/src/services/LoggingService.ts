/**
 * LoggingService - Advanced logging system with rotation, levels, and structured logging
 * Provides centralized logging for the entire application
 */

import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config/settings';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

// Log categories
export enum LogCategory {
  DATABASE = 'database',
  AI = 'ai',
  API = 'api',
  PLUGIN = 'plugin',
  MEMORY = 'memory',
  PERSONALITY = 'personality',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  SYSTEM = 'system',
  USER = 'user'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface LoggingConfig {
  level: LogLevel;
  console: boolean;
  file: boolean;
  maxFiles: number;
  maxSize: string;
  compress: boolean;
  logDir: string;
}

export class LoggingService {
  private logger: winston.Logger;
  private logDir: string;
  private config: LoggingConfig;

  constructor(config?: Partial<LoggingConfig>) {
    // Set up log directory
    const projectRoot = path.resolve(__dirname, '../../../..');
    this.logDir = config?.logDir || path.resolve(projectRoot, 'logs');

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Default configuration
    this.config = {
      level: LogLevel.INFO,
      console: true,
      file: true,
      maxFiles: 14, // Keep 2 weeks of logs
      maxSize: '20m',
      compress: true,
      logDir: this.logDir,
      ...config
    };

    // Initialize Winston logger
    this.logger = this.createLogger();
  }

  /**
   * Create Winston logger instance
   */
  private createLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, category, ...metadata }) => {
        let msg = `${timestamp} [${level}]`;
        if (category) msg += ` [${category}]`;
        msg += `: ${message}`;
        
        if (Object.keys(metadata).length > 0) {
          msg += ` ${JSON.stringify(metadata)}`;
        }
        
        return msg;
      })
    );

    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.console) {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
          level: this.config.level
        })
      );
    }

    // File transports
    if (this.config.file) {
      // Combined log (all levels)
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'combined.log'),
          format: logFormat,
          maxsize: this.parseSize(this.config.maxSize),
          maxFiles: this.config.maxFiles,
          tailable: true
        })
      );

      // Error log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'error.log'),
          level: 'error',
          format: logFormat,
          maxsize: this.parseSize(this.config.maxSize),
          maxFiles: this.config.maxFiles,
          tailable: true
        })
      );

      // Info log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'info.log'),
          level: 'info',
          format: logFormat,
          maxsize: this.parseSize(this.config.maxSize),
          maxFiles: this.config.maxFiles,
          tailable: true
        })
      );

      // Debug log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'debug.log'),
          level: 'debug',
          format: logFormat,
          maxsize: this.parseSize(this.config.maxSize),
          maxFiles: this.config.maxFiles,
          tailable: true
        })
      );

      // HTTP/API log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'api.log'),
          level: 'http',
          format: logFormat,
          maxsize: this.parseSize(this.config.maxSize),
          maxFiles: this.config.maxFiles,
          tailable: true
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      format: logFormat,
      transports,
      exitOnError: false
    });
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+)([bkmg])$/i);
    if (!match) return 20 * 1024 * 1024; // Default 20MB

    const [, num, unit] = match;
    return parseInt(num) * (units[unit.toLowerCase()] || 1);
  }

  /**
   * Log error
   */
  error(message: string, metadata?: any, category?: LogCategory): void {
    this.logger.error(message, { category, ...metadata });
  }

  /**
   * Log warning
   */
  warn(message: string, metadata?: any, category?: LogCategory): void {
    this.logger.warn(message, { category, ...metadata });
  }

  /**
   * Log info
   */
  info(message: string, metadata?: any, category?: LogCategory): void {
    this.logger.info(message, { category, ...metadata });
  }

  /**
   * Log HTTP/API request
   */
  http(message: string, metadata?: any, category?: LogCategory): void {
    this.logger.http(message, { category: category || LogCategory.API, ...metadata });
  }

  /**
   * Log debug
   */
  debug(message: string, metadata?: any, category?: LogCategory): void {
    this.logger.debug(message, { category, ...metadata });
  }

  /**
   * Log with specific level
   */
  log(level: LogLevel, message: string, metadata?: any, category?: LogCategory): void {
    this.logger.log(level, message, { category, ...metadata });
  }

  /**
   * Create category-specific logger
   */
  createCategoryLogger(category: LogCategory) {
    return {
      error: (message: string, metadata?: any) => this.error(message, metadata, category),
      warn: (message: string, metadata?: any) => this.warn(message, metadata, category),
      info: (message: string, metadata?: any) => this.info(message, metadata, category),
      debug: (message: string, metadata?: any) => this.debug(message, metadata, category),
      http: (message: string, metadata?: any) => this.http(message, metadata, category)
    };
  }

  /**
   * Log performance metric
   */
  logPerformance(operation: string, durationMs: number, metadata?: any): void {
    this.info(`Performance: ${operation} took ${durationMs}ms`, {
      ...metadata,
      operation,
      duration: durationMs
    }, LogCategory.PERFORMANCE);
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: any): void {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    this.log(level, `Security: ${event}`, {
      ...metadata,
      severity,
      event
    }, LogCategory.SECURITY);
  }

  /**
   * Log user action
   */
  logUserAction(action: string, userId?: string, metadata?: any): void {
    this.info(`User action: ${action}`, {
      ...metadata,
      userId,
      action
    }, LogCategory.USER);
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, durationMs?: number, metadata?: any): void {
    this.debug(`Database: ${operation}`, {
      ...metadata,
      operation,
      duration: durationMs
    }, LogCategory.DATABASE);
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<{
    totalSize: number;
    fileCount: number;
    oldestLog: Date | null;
    newestLog: Date | null;
  }> {
    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));

      let totalSize = 0;
      let oldestLog: Date | null = null;
      let newestLog: Date | null = null;

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.promises.stat(filePath);
        
        totalSize += stats.size;

        if (!oldestLog || stats.birthtime < oldestLog) {
          oldestLog = stats.birthtime;
        }
        if (!newestLog || stats.mtime > newestLog) {
          newestLog = stats.mtime;
        }
      }

      return {
        totalSize,
        fileCount: logFiles.length,
        oldestLog,
        newestLog
      };
    } catch (error) {
      this.error('Failed to get log stats', error);
      return {
        totalSize: 0,
        fileCount: 0,
        oldestLog: null,
        newestLog: null
      };
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(olderThanDays: number): Promise<number> {
    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files.filter(f => f.endsWith('.log'));
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      this.info(`Cleaned up ${deletedCount} old log files`, { deletedCount, olderThanDays });
      return deletedCount;
    } catch (error) {
      this.error('Failed to cleanup old logs', error);
      return 0;
    }
  }

  /**
   * Archive logs into a compressed tar.gz file
   */
  async archiveLogs(archiveName?: string): Promise<string> {
    const archiveFileName = archiveName || `logs_archive_${Date.now()}.tar.gz`;
    const archivePath = path.join(this.logDir, archiveFileName);

    const zlib = await import('zlib');
    const fsp = await import('fs/promises');
    const fsSync = await import('fs');

    // Collect all .log files in the log directory
    const entries = await fsp.readdir(this.logDir);
    const logFiles = entries.filter(f => f.endsWith('.log'));

    if (logFiles.length === 0) {
      this.info('No log files to archive');
      return archivePath;
    }

    // Build a simple tar-like concatenation: for each file, write a header + content
    // We use gzip compression on the combined output
    const chunks: Buffer[] = [];

    for (const logFile of logFiles) {
      const filePath = path.join(this.logDir, logFile);
      const stat = await fsp.stat(filePath);
      const content = await fsp.readFile(filePath);

      // Simple tar header (512 bytes) — filename + size in octal
      const header = Buffer.alloc(512, 0);
      // Name field (0-99)
      header.write(logFile, 0, Math.min(logFile.length, 100), 'utf-8');
      // Mode (100-107)
      header.write('0000644\0', 100, 8, 'utf-8');
      // Size in octal (124-135)
      header.write(stat.size.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf-8');
      // Mtime in octal (136-147)
      header.write(Math.floor(stat.mtimeMs / 1000).toString(8).padStart(11, '0') + '\0', 136, 12, 'utf-8');
      // Type flag (156) — regular file
      header.write('0', 156, 1, 'utf-8');
      // Magic (257-262)
      header.write('ustar\0', 257, 6, 'utf-8');
      // Version (263-264)
      header.write('00', 263, 2, 'utf-8');

      // Calculate checksum
      let checksum = 0;
      // Fill checksum field with spaces for calculation
      header.write('        ', 148, 8, 'utf-8');
      for (let i = 0; i < 512; i++) {
        checksum += header[i];
      }
      header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf-8');

      chunks.push(header);
      chunks.push(content);

      // Pad to 512-byte boundary
      const remainder = content.length % 512;
      if (remainder > 0) {
        chunks.push(Buffer.alloc(512 - remainder, 0));
      }
    }

    // End-of-archive marker (two 512-byte blocks of zeros)
    chunks.push(Buffer.alloc(1024, 0));

    const tarData = Buffer.concat(chunks);
    const compressed = zlib.gzipSync(tarData);
    await fsp.writeFile(archivePath, compressed);

    this.info('Logs archived successfully', {
      archivePath,
      filesArchived: logFiles.length,
      compressedSize: compressed.length,
    });

    return archivePath;
  }

  /**
   * Update log level at runtime
   */
  setLogLevel(level: LogLevel): void {
    this.logger.level = level;
    this.config.level = level;
    this.info(`Log level changed to ${level}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggingConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const loggingService = new LoggingService({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  console: process.env.NODE_ENV !== 'production',
  file: true
});

export default LoggingService;
