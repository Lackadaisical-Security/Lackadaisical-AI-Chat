/**
 * BackupService - Automated backup and restore system for database and configuration
 * Provides scheduled backups, manual backups, and restore capabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import { config } from '../config/settings';
import cron from 'node-cron';

export interface BackupMetadata {
  backupId: string;
  timestamp: Date;
  dbType: string;
  fileSize: number;
  compressed: boolean;
  checksum?: string;
  version: string;
  description?: string;
}

export interface BackupOptions {
  compress?: boolean;
  includeConfig?: boolean;
  description?: string;
}

export interface RestoreOptions {
  verify?: boolean;
  createBackupBeforeRestore?: boolean;
}

export interface BackupScheduleConfig {
  enabled: boolean;
  cronExpression: string; // e.g., '0 2 * * *' for daily at 2 AM
  retentionDays: number;
  maxBackups: number;
}

export class BackupService {
  private backupDir: string;
  private db: DatabaseService;
  private scheduledTask?: cron.ScheduledTask;
  private isInitialized: boolean = false;

  constructor(databaseService: DatabaseService) {
    this.db = databaseService;
    const projectRoot = path.resolve(__dirname, '../../../..');
    this.backupDir = path.resolve(projectRoot, 'backups');
  }

  /**
   * Initialize backup service and schedule
   */
  async initialize(scheduleConfig?: BackupScheduleConfig): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });
      
      logger.info('BackupService initialized:', { backupDir: this.backupDir });

      // Setup scheduled backups if configured
      if (scheduleConfig?.enabled && scheduleConfig.cronExpression) {
        this.scheduleBackups(scheduleConfig);
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize BackupService:', error);
      throw error;
    }
  }

  /**
   * Create a backup of the database
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupMetadata> {
    try {
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const timestamp = new Date();
      const compress = options.compress !== false; // Default to true

      logger.info('Creating backup:', { backupId, compress });

      // Determine backup file name
      const extension = compress ? '.db.gz' : '.db';
      const backupFileName = `${backupId}${extension}`;
      const backupFilePath = path.join(this.backupDir, backupFileName);

      // For SQLite, copy the database file
      if (config.database.type === 'sqlite') {
        const sourceDb = path.resolve(__dirname, '../../../..', config.database.path);
        
        if (compress) {
          // Compress the database file
          await this.compressFile(sourceDb, backupFilePath);
        } else {
          // Direct copy
          await fs.copyFile(sourceDb, backupFilePath);
        }
      } else {
        // For PostgreSQL/MySQL, export using native tools
        await this.exportDatabase(backupFilePath, compress);
      }

      // Get file size
      const stats = await fs.stat(backupFilePath);
      const fileSize = stats.size;

      // Create metadata
      const metadata: BackupMetadata = {
        backupId,
        timestamp,
        dbType: config.database.type,
        fileSize,
        compressed: compress,
        version: '2.0.0-alpha',
        description: options.description
      };

      // Save metadata
      await this.saveMetadata(backupId, metadata);

      // Include configuration files if requested
      if (options.includeConfig) {
        await this.backupConfiguration(backupId);
      }

      logger.info('Backup created successfully:', metadata);
      return metadata;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Restore database from a backup
   */
  async restoreBackup(backupId: string, options: RestoreOptions = {}): Promise<void> {
    try {
      logger.info('Starting restore from backup:', { backupId });

      // Load metadata
      const metadata = await this.loadMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup metadata not found: ${backupId}`);
      }

      // Create backup before restore if requested
      if (options.createBackupBeforeRestore !== false) {
        logger.info('Creating safety backup before restore...');
        await this.createBackup({ description: 'Pre-restore safety backup' });
      }

      // Determine backup file
      const extension = metadata.compressed ? '.db.gz' : '.db';
      const backupFilePath = path.join(this.backupDir, `${backupId}${extension}`);

      // Verify backup exists
      try {
        await fs.access(backupFilePath);
      } catch {
        throw new Error(`Backup file not found: ${backupFilePath}`);
      }

      // Close current database connection
      await this.db.close();

      // Restore based on database type
      if (config.database.type === 'sqlite') {
        const targetDb = path.resolve(__dirname, '../../../..', config.database.path);
        
        if (metadata.compressed) {
          await this.decompressFile(backupFilePath, targetDb);
        } else {
          await fs.copyFile(backupFilePath, targetDb);
        }
      } else {
        // For PostgreSQL/MySQL, import using native tools
        await this.importDatabase(backupFilePath, metadata.compressed);
      }

      // Reinitialize database connection
      await this.db.initialize();

      logger.info('Restore completed successfully:', { backupId });
    } catch (error) {
      logger.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const metadataFiles = files.filter(f => f.endsWith('.meta.json'));

      const backups: BackupMetadata[] = [];
      for (const file of metadataFiles) {
        const backupId = file.replace('.meta.json', '');
        const metadata = await this.loadMetadata(backupId);
        if (metadata) {
          backups.push(metadata);
        }
      }

      // Sort by timestamp, newest first
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return backups;
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      logger.info('Deleting backup:', { backupId });

      // Load metadata to determine file extension
      const metadata = await this.loadMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const extension = metadata.compressed ? '.db.gz' : '.db';
      const backupFilePath = path.join(this.backupDir, `${backupId}${extension}`);
      const metadataFilePath = path.join(this.backupDir, `${backupId}.meta.json`);
      const configBackupPath = path.join(this.backupDir, `${backupId}_config.tar.gz`);

      // Delete files
      await Promise.allSettled([
        fs.unlink(backupFilePath),
        fs.unlink(metadataFilePath),
        fs.unlink(configBackupPath)
      ]);

      logger.info('Backup deleted:', { backupId });
    } catch (error) {
      logger.error('Failed to delete backup:', error);
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(retentionDays: number, maxBackups?: number): Promise<number> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      // Delete backups older than retention period
      for (const backup of backups) {
        if (backup.timestamp < cutoffDate) {
          await this.deleteBackup(backup.backupId);
          deletedCount++;
        }
      }

      // If maxBackups is set, delete oldest backups exceeding the limit
      if (maxBackups && backups.length > maxBackups) {
        const excessBackups = backups.slice(maxBackups);
        for (const backup of excessBackups) {
          await this.deleteBackup(backup.backupId);
          deletedCount++;
        }
      }

      logger.info('Backup cleanup completed:', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Schedule automatic backups
   */
  private scheduleBackups(config: BackupScheduleConfig): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
    }

    this.scheduledTask = cron.schedule(config.cronExpression, async () => {
      try {
        logger.info('Running scheduled backup...');
        await this.createBackup({ compress: true, description: 'Scheduled backup' });
        await this.cleanupOldBackups(config.retentionDays, config.maxBackups);
      } catch (error) {
        logger.error('Scheduled backup failed:', error);
      }
    });

    logger.info('Backup schedule configured:', {
      cron: config.cronExpression,
      retentionDays: config.retentionDays
    });
  }

  /**
   * Stop scheduled backups
   */
  stopScheduledBackups(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = undefined;
      logger.info('Scheduled backups stopped');
    }
  }

  /**
   * Compress a file using gzip
   */
  private async compressFile(sourcePath: string, destPath: string): Promise<void> {
    const source = createReadStream(sourcePath);
    const destination = createWriteStream(destPath);
    const gzip = createGzip({ level: 9 });

    await pipeline(source, gzip, destination);
  }

  /**
   * Decompress a gzipped file
   */
  private async decompressFile(sourcePath: string, destPath: string): Promise<void> {
    const source = createReadStream(sourcePath);
    const destination = createWriteStream(destPath);
    const gunzip = createGunzip();

    await pipeline(source, gunzip, destination);
  }

  /**
   * Export database (PostgreSQL/MySQL)
   * Uses native database tools (pg_dump/mysqldump) via child_process.
   */
  private async exportDatabase(outputPath: string, compress: boolean): Promise<void> {
    const dbType = config.database.type;
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    if (dbType === 'postgresql') {
      const host = config.database.host || 'localhost';
      const port = String(config.database.port || 5432);
      const dbName = config.database.name || 'lackadaisical_chat';
      const args = ['-h', host, '-p', port, '-d', dbName, '-F', 'c', '-f', outputPath];
      if (config.database.username) {
        args.push('-U', config.database.username);
      }

      const env: Record<string, string> = { ...process.env as Record<string, string> };
      if (config.database.password) {
        env['PGPASSWORD'] = config.database.password;
      }

      try {
        await execFileAsync('pg_dump', args, { env, timeout: 300000 });
        logger.info('PostgreSQL backup completed', { outputPath });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('PostgreSQL backup failed:', error);
        throw new Error(
          `PostgreSQL backup failed: ${msg}. ` +
          `Ensure pg_dump is installed and accessible in PATH.`
        );
      }
    } else if (dbType === 'mysql') {
      const host = config.database.host || 'localhost';
      const port = String(config.database.port || 3306);
      const dbName = config.database.name || 'lackadaisical_chat';
      const args = ['-h', host, '-P', port, '--databases', dbName, '--result-file', outputPath];
      if (config.database.username) {
        args.push('-u', config.database.username);
      }
      if (config.database.password) {
        args.push(`-p${config.database.password}`);
      }

      try {
        await execFileAsync('mysqldump', args, { timeout: 300000 });
        logger.info('MySQL backup completed', { outputPath });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('MySQL backup failed:', error);
        throw new Error(
          `MySQL backup failed: ${msg}. ` +
          `Ensure mysqldump is installed and accessible in PATH.`
        );
      }
    } else {
      throw new Error(`Database export not supported for type: ${dbType}`);
    }

    // Compress if requested
    if (compress) {
      const zlib = await import('zlib');
      const fsp = await import('fs/promises');
      const input = await fsp.readFile(outputPath);
      const compressed = zlib.gzipSync(input);
      const compressedPath = outputPath + '.gz';
      await fsp.writeFile(compressedPath, compressed);
      await fsp.unlink(outputPath);
      logger.info('Backup compressed', { compressedPath });
    }
  }

  /**
   * Import database (PostgreSQL/MySQL)
   * Uses native database tools (psql/mysql) via child_process.
   */
  private async importDatabase(inputPath: string, compressed: boolean): Promise<void> {
    const dbType = config.database.type;
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    let actualPath = inputPath;

    // Decompress if needed
    if (compressed) {
      const zlib = await import('zlib');
      const fsp = await import('fs/promises');
      const compressedData = await fsp.readFile(inputPath);
      const decompressed = zlib.gunzipSync(compressedData);
      actualPath = inputPath.replace(/\.gz$/, '');
      await fsp.writeFile(actualPath, decompressed);
    }

    if (dbType === 'postgresql') {
      const host = config.database.host || 'localhost';
      const port = String(config.database.port || 5432);
      const dbName = config.database.name || 'lackadaisical_chat';
      const args = ['-h', host, '-p', port, '-d', dbName, '-c', actualPath];
      if (config.database.username) {
        args.push('-U', config.database.username);
      }

      const env: Record<string, string> = { ...process.env as Record<string, string> };
      if (config.database.password) {
        env['PGPASSWORD'] = config.database.password;
      }

      try {
        await execFileAsync('pg_restore', args, { env, timeout: 300000 });
        logger.info('PostgreSQL restore completed', { inputPath });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('PostgreSQL restore failed:', error);
        throw new Error(
          `PostgreSQL restore failed: ${msg}. ` +
          `Ensure pg_restore is installed and accessible in PATH.`
        );
      }
    } else if (dbType === 'mysql') {
      const host = config.database.host || 'localhost';
      const port = String(config.database.port || 3306);
      const dbName = config.database.name || 'lackadaisical_chat';
      const args = ['-h', host, '-P', port, dbName];
      if (config.database.username) {
        args.push('-u', config.database.username);
      }
      if (config.database.password) {
        args.push(`-p${config.database.password}`);
      }

      try {
        const fsp = await import('fs/promises');
        const { spawn } = await import('child_process');
        const sqlData = await fsp.readFile(actualPath, 'utf-8');

        // Use spawn to pipe SQL data to mysql's stdin safely
        await new Promise<void>((resolve, reject) => {
          const child = spawn('mysql', args, { timeout: 300000, stdio: ['pipe', 'pipe', 'pipe'] });
          let stderr = '';
          child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
          child.on('close', (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`mysql exited with code ${code}: ${stderr}`));
          });
          child.on('error', reject);
          child.stdin.write(sqlData);
          child.stdin.end();
        });
        logger.info('MySQL restore completed', { inputPath });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('MySQL restore failed:', error);
        throw new Error(
          `MySQL restore failed: ${msg}. ` +
          `Ensure mysql client is installed and accessible in PATH.`
        );
      }
    } else {
      throw new Error(`Database import not supported for type: ${dbType}`);
    }

    // Clean up decompressed temp file
    if (compressed && actualPath !== inputPath) {
      try {
        const fsp = await import('fs/promises');
        await fsp.unlink(actualPath);
      } catch {
        // Non-critical cleanup failure
      }
    }
  }

  /**
   * Backup configuration files
   */
  private async backupConfiguration(backupId: string): Promise<void> {
    try {
      const configPath = path.resolve(__dirname, '../../../..', '.env');
      const backupConfigPath = path.join(this.backupDir, `${backupId}_config.tar.gz`);

      // Copy .env file if it exists
      try {
        await fs.copyFile(configPath, backupConfigPath.replace('.tar.gz', '.env'));
      } catch {
        logger.warn('No .env file found to backup');
      }
    } catch (error) {
      logger.error('Failed to backup configuration:', error);
    }
  }

  /**
   * Save backup metadata
   */
  private async saveMetadata(backupId: string, metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this.backupDir, `${backupId}.meta.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load backup metadata
   */
  private async loadMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataPath = path.join(this.backupDir, `${backupId}.meta.json`);
      const data = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data);
      metadata.timestamp = new Date(metadata.timestamp);
      return metadata;
    } catch {
      return null;
    }
  }
}

export default BackupService;
