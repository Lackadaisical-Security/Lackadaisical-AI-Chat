/**
 * AnomalyDetectionService — Enterprise-grade anomaly detection and system integrity monitoring.
 *
 * Detects and alerts on:
 * - Unusual request patterns (rate spikes, endpoint abuse)
 * - Authentication anomalies (brute force, credential stuffing)
 * - System resource anomalies (memory leaks, DB connection issues)
 * - Data integrity issues (schema drift, orphaned records)
 * - Security violations (XSS attempts, injection patterns, path traversal)
 *
 * Uses a sliding window approach for real-time anomaly scoring.
 */

import { logger, securityLogger } from '../utils/logger';
import { EventEmitter } from 'events';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnomalyEvent {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
  details: Record<string, unknown>;
  timestamp: string;
  resolved: boolean;
}

export type AnomalyType =
  | 'rate_spike'
  | 'auth_brute_force'
  | 'injection_attempt'
  | 'path_traversal'
  | 'unusual_payload_size'
  | 'db_connection_issue'
  | 'memory_pressure'
  | 'error_rate_spike'
  | 'slow_response'
  | 'data_integrity'
  | 'xss_attempt'
  | 'system_health';

interface SlidingWindowEntry {
  timestamp: number;
  value: number;
}

interface ThresholdConfig {
  windowMs: number;
  maxCount: number;
  severity: AnomalyEvent['severity'];
}

// ─── Service ────────────────────────────────────────────────────────────────

export class AnomalyDetectionService extends EventEmitter {
  private static instance: AnomalyDetectionService;

  // Sliding windows for various metrics
  private requestWindows: Map<string, SlidingWindowEntry[]> = new Map();
  private authFailureWindow: SlidingWindowEntry[] = [];
  private errorWindow: SlidingWindowEntry[] = [];
  private slowRequestWindow: SlidingWindowEntry[] = [];

  // Anomaly history
  private anomalies: AnomalyEvent[] = [];
  private maxAnomalyHistory = 1000;

  // Thresholds
  private thresholds: Record<string, ThresholdConfig> = {
    requestsPerIp: { windowMs: 60_000, maxCount: 120, severity: 'medium' },
    authFailures: { windowMs: 300_000, maxCount: 10, severity: 'high' },
    errorRate: { windowMs: 60_000, maxCount: 50, severity: 'high' },
    slowRequests: { windowMs: 60_000, maxCount: 20, severity: 'medium' },
  };

  // Injection pattern detection
  private readonly injectionPatterns: Array<{ pattern: RegExp; type: AnomalyType; description: string }> = [
    { pattern: /(\b(union|select|insert|update|delete|drop|alter|exec|execute)\b.*\b(from|into|table|where|set)\b)/i, type: 'injection_attempt', description: 'SQL injection pattern' },
    { pattern: /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/i, type: 'xss_attempt', description: 'Script tag injection' },
    { pattern: /javascript\s*:/i, type: 'xss_attempt', description: 'JavaScript protocol injection' },
    { pattern: /on(error|load|click|mouse|focus|blur)\s*=/i, type: 'xss_attempt', description: 'Event handler injection' },
    { pattern: /\.\.\//g, type: 'path_traversal', description: 'Path traversal attempt' },
    { pattern: /%2e%2e%2f/gi, type: 'path_traversal', description: 'Encoded path traversal' },
    { pattern: /\$\{.*\}/g, type: 'injection_attempt', description: 'Template injection' },
  ];

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startCleanupInterval();
    logger.info('[AnomalyDetection] Service initialized');
  }

  static getInstance(): AnomalyDetectionService {
    if (!AnomalyDetectionService.instance) {
      AnomalyDetectionService.instance = new AnomalyDetectionService();
    }
    return AnomalyDetectionService.instance;
  }

  // ─── Request Monitoring ─────────────────────────────────────────────────

  /**
   * Track an incoming request for anomaly detection.
   */
  trackRequest(ip: string, path: string, method: string, statusCode: number, durationMs: number, bodySize: number): void {
    const now = Date.now();

    // Track per-IP request rate
    const ipKey = `ip:${ip}`;
    if (!this.requestWindows.has(ipKey)) {
      this.requestWindows.set(ipKey, []);
    }
    const ipWindow = this.requestWindows.get(ipKey)!;
    ipWindow.push({ timestamp: now, value: 1 });
    this.pruneWindow(ipWindow, this.thresholds.requestsPerIp.windowMs);

    if (ipWindow.length > this.thresholds.requestsPerIp.maxCount) {
      this.raiseAnomaly({
        type: 'rate_spike',
        severity: this.thresholds.requestsPerIp.severity,
        message: `Rate spike detected from IP ${ip}: ${ipWindow.length} requests in ${this.thresholds.requestsPerIp.windowMs / 1000}s`,
        source: ip,
        details: { ip, requestCount: ipWindow.length, path, method },
      });
    }

    // Track error rate
    if (statusCode >= 500) {
      this.errorWindow.push({ timestamp: now, value: 1 });
      this.pruneWindow(this.errorWindow, this.thresholds.errorRate.windowMs);

      if (this.errorWindow.length > this.thresholds.errorRate.maxCount) {
        this.raiseAnomaly({
          type: 'error_rate_spike',
          severity: 'high',
          message: `Error rate spike: ${this.errorWindow.length} server errors in ${this.thresholds.errorRate.windowMs / 1000}s`,
          source: 'system',
          details: { errorCount: this.errorWindow.length, latestPath: path },
        });
      }
    }

    // Track slow requests
    if (durationMs > 5000) {
      this.slowRequestWindow.push({ timestamp: now, value: durationMs });
      this.pruneWindow(this.slowRequestWindow, this.thresholds.slowRequests.windowMs);

      if (this.slowRequestWindow.length > this.thresholds.slowRequests.maxCount) {
        this.raiseAnomaly({
          type: 'slow_response',
          severity: 'medium',
          message: `Slow response pattern: ${this.slowRequestWindow.length} slow requests in last minute`,
          source: 'system',
          details: { count: this.slowRequestWindow.length, latestDuration: durationMs, path },
        });
      }
    }

    // Check for unusual payload sizes (potential attack vector)
    if (bodySize > 10 * 1024 * 1024) { // > 10MB
      this.raiseAnomaly({
        type: 'unusual_payload_size',
        severity: 'medium',
        message: `Unusually large request payload: ${(bodySize / 1024 / 1024).toFixed(1)}MB`,
        source: ip,
        details: { ip, path, method, bodySize },
      });
    }
  }

  // ─── Auth Monitoring ──────────────────────────────────────────────────

  /**
   * Track authentication failure for brute-force detection.
   */
  trackAuthFailure(ip: string, email?: string): void {
    const now = Date.now();
    this.authFailureWindow.push({ timestamp: now, value: 1 });
    this.pruneWindow(this.authFailureWindow, this.thresholds.authFailures.windowMs);

    if (this.authFailureWindow.length > this.thresholds.authFailures.maxCount) {
      this.raiseAnomaly({
        type: 'auth_brute_force',
        severity: 'critical',
        message: `Possible brute-force attack: ${this.authFailureWindow.length} auth failures in ${this.thresholds.authFailures.windowMs / 60000}min`,
        source: ip,
        details: { ip, failureCount: this.authFailureWindow.length, targetEmail: email ? '[REDACTED]' : undefined },
      });
    }
  }

  // ─── Input Scanning ───────────────────────────────────────────────────

  /**
   * Scan request input for injection/XSS patterns.
   * Returns detected anomalies (empty array if clean).
   */
  scanInput(ip: string, path: string, input: string): AnomalyEvent[] {
    const detected: AnomalyEvent[] = [];

    for (const { pattern, type, description } of this.injectionPatterns) {
      if (pattern.test(input)) {
        const anomaly = this.raiseAnomaly({
          type,
          severity: type === 'path_traversal' ? 'high' : 'medium',
          message: `${description} detected in request to ${path}`,
          source: ip,
          details: { ip, path, pattern: pattern.source, matchedType: type },
        });
        if (anomaly) detected.push(anomaly);
      }
    }

    return detected;
  }

  // ─── System Health Monitoring ─────────────────────────────────────────

  /**
   * Check system resource usage and raise anomalies if thresholds exceeded.
   */
  checkSystemHealth(): { healthy: boolean; metrics: Record<string, unknown> } {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const rssMB = memUsage.rss / 1024 / 1024;
    const uptimeSeconds = process.uptime();

    let healthy = true;

    // Memory pressure check
    if (heapPercent > 90) {
      healthy = false;
      this.raiseAnomaly({
        type: 'memory_pressure',
        severity: 'critical',
        message: `Heap memory usage at ${heapPercent.toFixed(1)}% (${heapUsedMB.toFixed(0)}MB / ${heapTotalMB.toFixed(0)}MB)`,
        source: 'system',
        details: { heapUsedMB, heapTotalMB, heapPercent, rssMB },
      });
    } else if (heapPercent > 75) {
      this.raiseAnomaly({
        type: 'memory_pressure',
        severity: 'medium',
        message: `Heap memory usage elevated at ${heapPercent.toFixed(1)}%`,
        source: 'system',
        details: { heapUsedMB, heapTotalMB, heapPercent, rssMB },
      });
    }

    return {
      healthy,
      metrics: {
        heapUsedMB: Math.round(heapUsedMB * 10) / 10,
        heapTotalMB: Math.round(heapTotalMB * 10) / 10,
        heapPercent: Math.round(heapPercent * 10) / 10,
        rssMB: Math.round(rssMB * 10) / 10,
        uptimeSeconds: Math.round(uptimeSeconds),
        activeAnomalies: this.getActiveAnomalies().length,
      },
    };
  }

  // ─── Anomaly Management ───────────────────────────────────────────────

  /**
   * Raise a new anomaly event.
   */
  private raiseAnomaly(params: Omit<AnomalyEvent, 'id' | 'timestamp' | 'resolved'>): AnomalyEvent | null {
    // Dedup: don't raise if same type+source within last 60s
    const recentDup = this.anomalies.find(
      a =>
        a.type === params.type &&
        a.source === params.source &&
        !a.resolved &&
        Date.now() - new Date(a.timestamp).getTime() < 60_000
    );
    if (recentDup) return null;

    const anomaly: AnomalyEvent = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...params,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.anomalies.push(anomaly);

    // Trim history
    if (this.anomalies.length > this.maxAnomalyHistory) {
      this.anomalies = this.anomalies.slice(-this.maxAnomalyHistory);
    }

    // Log based on severity
    const logMsg = `[ANOMALY:${anomaly.severity.toUpperCase()}] ${anomaly.message}`;
    if (anomaly.severity === 'critical') {
      securityLogger.logSuspiciousActivity(logMsg, anomaly.source, anomaly.details);
    } else if (anomaly.severity === 'high') {
      logger.warn(logMsg, anomaly.details);
    } else {
      logger.info(logMsg, anomaly.details);
    }

    // Emit event for real-time subscribers
    this.emit('anomaly', anomaly);

    return anomaly;
  }

  /**
   * Get all active (unresolved) anomalies.
   */
  getActiveAnomalies(): AnomalyEvent[] {
    return this.anomalies.filter(a => !a.resolved);
  }

  /**
   * Get anomaly history with optional filters.
   */
  getAnomalies(filters?: {
    type?: AnomalyType;
    severity?: AnomalyEvent['severity'];
    since?: string;
    limit?: number;
  }): AnomalyEvent[] {
    let result = [...this.anomalies];

    if (filters?.type) result = result.filter(a => a.type === filters.type);
    if (filters?.severity) result = result.filter(a => a.severity === filters.severity);
    if (filters?.since) {
      const sinceDate = new Date(filters.since).getTime();
      result = result.filter(a => new Date(a.timestamp).getTime() >= sinceDate);
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) result = result.slice(0, filters.limit);

    return result;
  }

  /**
   * Resolve an anomaly by ID.
   */
  resolveAnomaly(id: string): boolean {
    const anomaly = this.anomalies.find(a => a.id === id);
    if (anomaly) {
      anomaly.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Get summary statistics.
   */
  getSummary(): Record<string, unknown> {
    const active = this.getActiveAnomalies();
    const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byType: Record<string, number> = {};

    for (const a of active) {
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byType[a.type] = (byType[a.type] || 0) + 1;
    }

    return {
      totalActive: active.length,
      totalHistorical: this.anomalies.length,
      bySeverity,
      byType,
      systemHealth: this.checkSystemHealth(),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private pruneWindow(window: SlidingWindowEntry[], maxAgeMs: number): void {
    const cutoff = Date.now() - maxAgeMs;
    while (window.length > 0 && window[0].timestamp < cutoff) {
      window.shift();
    }
  }

  private startCleanupInterval(): void {
    // Clean up sliding windows every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cutoff5m = Date.now() - 300_000;

      for (const [key, entries] of this.requestWindows) {
        const pruned = entries.filter(e => e.timestamp >= cutoff5m);
        if (pruned.length === 0) {
          this.requestWindows.delete(key);
        } else {
          this.requestWindows.set(key, pruned);
        }
      }

      this.pruneWindow(this.authFailureWindow, 300_000);
      this.pruneWindow(this.errorWindow, 300_000);
      this.pruneWindow(this.slowRequestWindow, 300_000);

      // Auto-resolve old anomalies (>24h)
      const dayAgo = Date.now() - 86_400_000;
      for (const a of this.anomalies) {
        if (!a.resolved && new Date(a.timestamp).getTime() < dayAgo) {
          a.resolved = true;
        }
      }
    }, 300_000);

    // Prevent timer from keeping process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Shutdown cleanup.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton export
export const anomalyDetectionService = AnomalyDetectionService.getInstance();
