/**
 * AnomalyDetectionService — Unit Tests
 * Tests sliding-window anomaly detection, input scanning, and system health monitoring.
 */

import { AnomalyDetectionService, AnomalyEvent, AnomalyType } from '../services/AnomalyDetectionService';

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;

  beforeEach(() => {
    // Reset singleton for clean tests
    (AnomalyDetectionService as any).instance = undefined;
    service = AnomalyDetectionService.getInstance();
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const a = AnomalyDetectionService.getInstance();
      const b = AnomalyDetectionService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('trackRequest', () => {
    it('should not raise anomaly for normal traffic', () => {
      const active = service.getActiveAnomalies();
      const before = active.length;
      service.trackRequest('192.168.1.1', '/api/v1/chat', 'POST', 200, 100, 500);
      expect(service.getActiveAnomalies().length).toBe(before);
    });

    it('should detect error rate spike', () => {
      // Generate many 500 errors rapidly
      for (let i = 0; i < 55; i++) {
        service.trackRequest('192.168.1.1', '/api/v1/chat', 'POST', 500, 100, 500);
      }
      const anomalies = service.getActiveAnomalies();
      const errorSpike = anomalies.find(a => a.type === 'error_rate_spike');
      expect(errorSpike).toBeDefined();
      expect(errorSpike!.severity).toBe('high');
    });

    it('should detect unusual payload size', () => {
      service.trackRequest('10.0.0.1', '/api/v1/files/upload', 'POST', 200, 100, 15 * 1024 * 1024);
      const anomalies = service.getActiveAnomalies();
      const payloadAnomaly = anomalies.find(a => a.type === 'unusual_payload_size');
      expect(payloadAnomaly).toBeDefined();
    });

    it('should detect slow response patterns', () => {
      for (let i = 0; i < 25; i++) {
        service.trackRequest('192.168.1.1', '/api/v1/chat', 'POST', 200, 6000, 500);
      }
      const anomalies = service.getActiveAnomalies();
      const slowAnomaly = anomalies.find(a => a.type === 'slow_response');
      expect(slowAnomaly).toBeDefined();
    });
  });

  describe('trackAuthFailure', () => {
    it('should detect brute-force attacks', () => {
      for (let i = 0; i < 12; i++) {
        service.trackAuthFailure('10.0.0.1', 'test@example.com');
      }
      const anomalies = service.getActiveAnomalies();
      const bruteForce = anomalies.find(a => a.type === 'auth_brute_force');
      expect(bruteForce).toBeDefined();
      expect(bruteForce!.severity).toBe('critical');
    });

    it('should redact email in anomaly details', () => {
      for (let i = 0; i < 12; i++) {
        service.trackAuthFailure('10.0.0.1', 'secret@example.com');
      }
      const anomalies = service.getActiveAnomalies();
      const bruteForce = anomalies.find(a => a.type === 'auth_brute_force');
      expect(bruteForce).toBeDefined();
      // Should contain [REDACTED] not the actual email
      expect(bruteForce!.details.targetEmail).toBe('[REDACTED]');
      expect(JSON.stringify(bruteForce)).not.toContain('secret@example.com');
    });
  });

  describe('scanInput', () => {
    it('should detect DROP TABLE SQL injection', () => {
      const result = service.scanInput('10.0.0.3', '/api/v1/chat', "'; DROP TABLE users; --");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('injection_attempt');
    });

    it('should detect UNION SELECT SQL injection', () => {
      // Use a different IP to avoid dedup with the DROP TABLE test
      const result = service.scanInput('10.0.0.5', '/api/v1/search', "1 UNION SELECT password FROM users WHERE admin=1");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('injection_attempt');
    });

    it('should detect XSS script tag injection', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/chat', '<script>alert("xss")</script>');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('xss_attempt');
    });

    it('should detect JavaScript protocol injection', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/chat', 'javascript:alert(1)');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('xss_attempt');
    });

    it('should detect event handler injection', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/chat', '<img onerror=alert(1)>');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('xss_attempt');
    });

    it('should detect path traversal attempts', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/files/../../../etc/passwd', '../../../etc/passwd');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(a => a.type === 'path_traversal')).toBe(true);
    });

    it('should detect encoded path traversal', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/files/%2e%2e%2f%2e%2e%2f', '%2e%2e%2f%2e%2e%2f');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(a => a.type === 'path_traversal')).toBe(true);
    });

    it('should detect template injection', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/chat', '${process.env.SECRET}');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('injection_attempt');
    });

    it('should not flag normal text', () => {
      const result = service.scanInput('10.0.0.1', '/api/v1/chat', 'Hello, how are you today?');
      expect(result.length).toBe(0);
    });
  });

  describe('checkSystemHealth', () => {
    it('should return health metrics', () => {
      const health = service.checkSystemHealth();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('metrics');
      expect(health.metrics).toHaveProperty('heapUsedMB');
      expect(health.metrics).toHaveProperty('heapTotalMB');
      expect(health.metrics).toHaveProperty('heapPercent');
      expect(health.metrics).toHaveProperty('rssMB');
      expect(health.metrics).toHaveProperty('uptimeSeconds');
      expect(health.metrics).toHaveProperty('activeAnomalies');
    });

    it('should report healthy when heap is under 90%', () => {
      const health = service.checkSystemHealth();
      // In test environments, heap usage may be elevated.
      // The service only reports unhealthy at >90% heap usage.
      expect(health).toHaveProperty('healthy');
      expect(typeof health.healthy).toBe('boolean');
      // If healthy is false, it means we're above 90% — which is a valid detection
      if (health.healthy) {
        expect((health.metrics as any).heapPercent).toBeLessThan(90);
      } else {
        expect((health.metrics as any).heapPercent).toBeGreaterThan(90);
      }
    });
  });

  describe('resolveAnomaly', () => {
    it('should resolve an existing anomaly', () => {
      // Generate an anomaly
      service.trackRequest('10.0.0.1', '/api/v1/files/upload', 'POST', 200, 100, 15 * 1024 * 1024);
      const anomalies = service.getActiveAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);

      const resolved = service.resolveAnomaly(anomalies[0].id);
      expect(resolved).toBe(true);

      // Should no longer be in active list
      const stillActive = service.getActiveAnomalies().find(a => a.id === anomalies[0].id);
      expect(stillActive).toBeUndefined();
    });

    it('should return false for non-existent anomaly', () => {
      const resolved = service.resolveAnomaly('nonexistent_id');
      expect(resolved).toBe(false);
    });
  });

  describe('getAnomalies', () => {
    it('should filter by type', () => {
      service.trackRequest('10.0.0.1', '/api/v1/files', 'POST', 200, 100, 15 * 1024 * 1024);
      const anomalies = service.getAnomalies({ type: 'unusual_payload_size' as AnomalyType });
      expect(anomalies.every(a => a.type === 'unusual_payload_size')).toBe(true);
    });

    it('should filter by severity', () => {
      // Generate a critical anomaly via brute force
      for (let i = 0; i < 12; i++) {
        service.trackAuthFailure('10.0.0.1');
      }
      const critical = service.getAnomalies({ severity: 'critical' });
      expect(critical.every(a => a.severity === 'critical')).toBe(true);
    });

    it('should respect limit parameter', () => {
      service.trackRequest('10.0.0.1', '/test', 'POST', 200, 100, 15 * 1024 * 1024);
      service.trackRequest('10.0.0.2', '/test', 'POST', 200, 100, 15 * 1024 * 1024);
      const limited = service.getAnomalies({ limit: 1 });
      expect(limited.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', () => {
      const summary = service.getSummary();
      expect(summary).toHaveProperty('totalActive');
      expect(summary).toHaveProperty('totalHistorical');
      expect(summary).toHaveProperty('bySeverity');
      expect(summary).toHaveProperty('byType');
      expect(summary).toHaveProperty('systemHealth');
    });
  });

  describe('deduplication', () => {
    it('should not raise duplicate anomalies within 60s window', () => {
      service.trackRequest('10.0.0.1', '/test', 'POST', 200, 100, 15 * 1024 * 1024);
      service.trackRequest('10.0.0.1', '/test', 'POST', 200, 100, 15 * 1024 * 1024);
      const anomalies = service.getAnomalies({ type: 'unusual_payload_size' as AnomalyType });
      // Should only have 1 due to dedup
      const fromSameSource = anomalies.filter(a => a.source === '10.0.0.1');
      expect(fromSameSource.length).toBe(1);
    });
  });
});
