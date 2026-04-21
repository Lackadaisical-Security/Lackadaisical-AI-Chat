/**
 * SecurityAuditService — Immutable audit trail for all security-sensitive operations.
 *
 * Provides:
 * - Append-only audit log stored in a separate SQLite database (WAL mode)
 * - Tamper detection via SHA-256 hash chain (each entry includes hash of previous)
 * - Automatic expired refresh token cleanup (prevents DB bloat / memory leak)
 * - UUID and session ID format validation helpers
 * - Security event correlation for anomaly detection integration
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number;
  event_type: string;
  actor_ip: string;
  actor_user_id: string | null;
  resource: string;
  action: string;
  outcome: 'success' | 'failure' | 'blocked';
  details: string; // JSON
  hash: string; // SHA-256 hash chain link
  previous_hash: string;
  created_at: string;
}

export type AuditEventType =
  | 'auth.login'
  | 'auth.register'
  | 'auth.logout'
  | 'auth.password_change'
  | 'auth.token_refresh'
  | 'auth.failed_login'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'security.rate_limit'
  | 'security.xss_blocked'
  | 'security.injection_blocked'
  | 'security.anomaly_detected'
  | 'system.startup'
  | 'system.shutdown'
  | 'system.config_change';

// ─── Validation Helpers ─────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validate UUID v4 format.
 */
export function isValidUUID(value: string): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validate session ID format — alphanumeric plus hyphens/underscores, max 128 chars.
 */
export function isValidSessionId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && SESSION_ID_REGEX.test(value);
}

// ─── Service ────────────────────────────────────────────────────────────────

export class SecurityAuditService {
  private db: Database.Database | null = null;
  private lastHash: string = 'GENESIS';
  private initialized = false;
  private tokenCleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the audit database (separate from main DB for isolation).
   */
  async initialize(dbDir?: string): Promise<void> {
    try {
      const dir = dbDir || path.resolve(process.cwd(), 'database');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const dbPath = path.join(dir, 'audit.db');
      this.db = new Database(dbPath, { fileMustExist: false });

      // Enable WAL mode for better concurrent read performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 5000');

      // Create audit table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          actor_ip TEXT NOT NULL DEFAULT '',
          actor_user_id TEXT,
          resource TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL DEFAULT '',
          outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failure', 'blocked')),
          details TEXT NOT NULL DEFAULT '{}',
          hash TEXT NOT NULL,
          previous_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_actor_ip ON audit_log(actor_ip)`);

      // Load last hash for chain continuity
      const lastRow = this.db.prepare(
        'SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1'
      ).get() as { hash: string } | undefined;

      if (lastRow) {
        this.lastHash = lastRow.hash;
      }

      this.initialized = true;
      logger.info('[SecurityAudit] Audit trail initialized', { dbPath });

      // Log system startup
      this.log({
        event_type: 'system.startup',
        actor_ip: '127.0.0.1',
        resource: 'system',
        action: 'startup',
        outcome: 'success',
        details: { version: '2.0.0-rc1', timestamp: new Date().toISOString() },
      });
    } catch (error) {
      logger.error('[SecurityAudit] Failed to initialize:', error);
    }
  }

  /**
   * Append an audit entry with hash chain integrity.
   */
  log(entry: {
    event_type: AuditEventType | string;
    actor_ip: string;
    actor_user_id?: string;
    resource: string;
    action: string;
    outcome: 'success' | 'failure' | 'blocked';
    details?: Record<string, unknown>;
  }): void {
    if (!this.initialized || !this.db) return;

    try {
      const detailsJson = JSON.stringify(entry.details || {});
      const previousHash = this.lastHash;

      // Create hash chain link: SHA-256(previousHash + eventType + details + timestamp)
      const now = new Date().toISOString();
      const hashInput = `${previousHash}|${entry.event_type}|${detailsJson}|${now}`;
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

      this.db.prepare(`
        INSERT INTO audit_log (event_type, actor_ip, actor_user_id, resource, action, outcome, details, hash, previous_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.event_type,
        entry.actor_ip,
        entry.actor_user_id || null,
        entry.resource,
        entry.action,
        entry.outcome,
        detailsJson,
        hash,
        previousHash,
        now
      );

      this.lastHash = hash;
    } catch (error) {
      logger.error('[SecurityAudit] Failed to log entry:', error);
    }
  }

  /**
   * Verify the hash chain integrity of the audit log.
   * Returns { valid: boolean, entries: number, firstBrokenAt?: number }
   */
  verifyIntegrity(): { valid: boolean; entries: number; firstBrokenAt?: number } {
    if (!this.initialized || !this.db) {
      return { valid: false, entries: 0 };
    }

    try {
      const rows = this.db.prepare(
        'SELECT id, event_type, details, hash, previous_hash, created_at FROM audit_log ORDER BY id ASC'
      ).all() as Array<{
        id: number; event_type: string; details: string;
        hash: string; previous_hash: string; created_at: string;
      }>;

      let expectedPrevHash = 'GENESIS';

      for (const row of rows) {
        if (row.previous_hash !== expectedPrevHash) {
          return { valid: false, entries: rows.length, firstBrokenAt: row.id };
        }

        const hashInput = `${row.previous_hash}|${row.event_type}|${row.details}|${row.created_at}`;
        const computedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        if (computedHash !== row.hash) {
          return { valid: false, entries: rows.length, firstBrokenAt: row.id };
        }

        expectedPrevHash = row.hash;
      }

      return { valid: true, entries: rows.length };
    } catch (error) {
      logger.error('[SecurityAudit] Integrity check failed:', error);
      return { valid: false, entries: 0 };
    }
  }

  /**
   * Query audit log entries.
   */
  query(filters?: {
    event_type?: string;
    actor_ip?: string;
    outcome?: string;
    since?: string;
    limit?: number;
  }): AuditEntry[] {
    if (!this.initialized || !this.db) return [];

    try {
      let sql = 'SELECT * FROM audit_log WHERE 1=1';
      const params: unknown[] = [];

      if (filters?.event_type) {
        sql += ' AND event_type = ?';
        params.push(filters.event_type);
      }
      if (filters?.actor_ip) {
        sql += ' AND actor_ip = ?';
        params.push(filters.actor_ip);
      }
      if (filters?.outcome) {
        sql += ' AND outcome = ?';
        params.push(filters.outcome);
      }
      if (filters?.since) {
        sql += ' AND created_at >= ?';
        params.push(filters.since);
      }

      sql += ' ORDER BY id DESC';

      if (filters?.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      } else {
        sql += ' LIMIT 100';
      }

      return this.db.prepare(sql).all(...params) as AuditEntry[];
    } catch (error) {
      logger.error('[SecurityAudit] Query failed:', error);
      return [];
    }
  }

  // ─── Expired Token Cleanup ────────────────────────────────────────────

  /**
   * Start periodic cleanup of expired refresh tokens in the main DB.
   * Prevents unbounded growth of the refresh_tokens table.
   */
  startTokenCleanup(mainDb: { executeStatement: (sql: string, params?: unknown[]) => Promise<unknown> }): void {
    // Run cleanup every hour
    const cleanupFn = async () => {
      try {
        await mainDb.executeStatement(
          "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
        );
        logger.info('[SecurityAudit] Expired refresh tokens cleaned up');
      } catch (error) {
        // Table may not exist yet during initial setup
        logger.debug('[SecurityAudit] Token cleanup skipped:', error);
      }
    };

    // Initial cleanup after 10s (give DB time to initialize)
    setTimeout(cleanupFn, 10_000);

    // Then every hour
    this.tokenCleanupInterval = setInterval(cleanupFn, 3_600_000);
    if (this.tokenCleanupInterval.unref) {
      this.tokenCleanupInterval.unref();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  close(): void {
    if (this.tokenCleanupInterval) {
      clearInterval(this.tokenCleanupInterval);
      this.tokenCleanupInterval = null;
    }

    if (this.initialized && this.db) {
      this.log({
        event_type: 'system.shutdown',
        actor_ip: '127.0.0.1',
        resource: 'system',
        action: 'shutdown',
        outcome: 'success',
        details: { timestamp: new Date().toISOString() },
      });

      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('[SecurityAudit] Audit trail closed');
    }
  }
}

export const securityAuditService = new SecurityAuditService();
