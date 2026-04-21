/**
 * Security Middleware Tests
 * Tests for request sanitization, CSRF protection, security headers,
 * depth limiting, and encryption utilities.
 */

import { Request, Response, NextFunction } from 'express';
import {
  requestSanitizer,
  securityHeaders,
  requestDepthLimiter,
  encryptValue,
  decryptValue,
} from '../middleware/security';

// Helper to create mock request/response/next
function createMocks(overrides: Partial<{
  body: any;
  query: any;
  params: any;
  method: string;
  path: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}> = {}) {
  const req: Partial<Request> = {
    body: overrides.body || {},
    query: overrides.query || {},
    params: overrides.params || {},
    method: overrides.method || 'GET',
    path: overrides.path || '/',
    headers: overrides.headers || {},
    cookies: overrides.cookies || {},
    ip: '127.0.0.1',
  };

  const res: Partial<Response> = {
    setHeader: jest.fn().mockReturnThis(),
    removeHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
  };

  const next: NextFunction = jest.fn();

  return { req: req as Request, res: res as Response, next };
}

describe('Security Middleware', () => {
  // ─── Request Sanitizer Tests ─────────────────────────────────────────────

  describe('requestSanitizer', () => {
    it('should sanitize HTML entities in query parameters', () => {
      const { req, res, next } = createMocks({
        query: { search: '<script>alert("xss")</script>' },
      });

      requestSanitizer(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.search).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should sanitize body parameters', () => {
      const { req, res, next } = createMocks({
        body: { name: '<img onerror="alert(1)" src=x>' },
      });

      requestSanitizer(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('&lt;img onerror=&quot;alert(1)&quot; src=x&gt;');
    });

    it('should preserve safe fields like content and message', () => {
      const { req, res, next } = createMocks({
        body: {
          content: '<think>reasoning here</think>',
          message: '<b>Hello</b>',
          name: '<script>bad</script>',
        },
      });

      requestSanitizer(req, res, next);

      expect(next).toHaveBeenCalled();
      // Safe fields should only have null bytes removed, not HTML encoded
      expect(req.body.content).toBe('<think>reasoning here</think>');
      expect(req.body.message).toBe('<b>Hello</b>');
      // Non-safe fields should be sanitized
      expect(req.body.name).toBe('&lt;script&gt;bad&lt;/script&gt;');
    });

    it('should remove null bytes from all fields', () => {
      const { req, res, next } = createMocks({
        body: {
          content: 'hello\0world',
          name: 'test\0value',
        },
      });

      requestSanitizer(req, res, next);

      expect(req.body.content).toBe('helloworld');
      expect(req.body.name).toBe('testvalue');
    });

    it('should handle nested objects', () => {
      const { req, res, next } = createMocks({
        body: {
          user: {
            name: '<script>xss</script>',
            profile: {
              bio: 'Safe text',
            },
          },
        },
      });

      requestSanitizer(req, res, next);

      expect(req.body.user.name).toBe('&lt;script&gt;xss&lt;/script&gt;');
      expect(req.body.user.profile.bio).toBe('Safe text');
    });

    it('should handle arrays', () => {
      const { req, res, next } = createMocks({
        body: {
          tags: ['<b>bold</b>', 'normal', '<script>bad</script>'],
        },
      });

      requestSanitizer(req, res, next);

      expect(req.body.tags[0]).toBe('&lt;b&gt;bold&lt;/b&gt;');
      expect(req.body.tags[1]).toBe('normal');
      expect(req.body.tags[2]).toBe('&lt;script&gt;bad&lt;/script&gt;');
    });

    it('should skip multipart form-data requests', () => {
      const { req, res, next } = createMocks({
        body: { name: '<script>test</script>' },
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
      });

      requestSanitizer(req, res, next);

      expect(next).toHaveBeenCalled();
      // Body should NOT be sanitized for multipart
      expect(req.body.name).toBe('<script>test</script>');
    });

    it('should sanitize URL params', () => {
      const { req, res, next } = createMocks({
        params: { id: '<script>alert(1)</script>' },
      });

      requestSanitizer(req, res, next);

      expect(req.params.id).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should not crash on empty body', () => {
      const { req, res, next } = createMocks({
        body: undefined,
      });
      req.body = undefined;

      requestSanitizer(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── Security Headers Tests ──────────────────────────────────────────────

  describe('securityHeaders', () => {
    it('should set X-Content-Type-Options', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    it('should set X-Frame-Options to DENY', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set X-XSS-Protection', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should set Referrer-Policy', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        expect.stringContaining('camera=()')
      );
    });

    it('should set no-cache headers for API paths', () => {
      const { req, res, next } = createMocks({ path: '/api/v1/chat' });
      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    });

    it('should not set no-cache headers for non-API paths', () => {
      const { req, res, next } = createMocks({ path: '/static/file.js' });
      securityHeaders(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalledWith('Cache-Control', expect.any(String));
    });

    it('should remove X-Powered-By', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    });

    it('should call next()', () => {
      const { req, res, next } = createMocks();
      securityHeaders(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ─── Request Depth Limiter Tests ─────────────────────────────────────────

  describe('requestDepthLimiter', () => {
    it('should allow requests within depth limit', () => {
      const middleware = requestDepthLimiter(5);
      const { req, res, next } = createMocks({
        body: { a: { b: { c: 'value' } } }, // depth 3
      });

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject requests exceeding depth limit', () => {
      const middleware = requestDepthLimiter(3);
      const { req, res, next } = createMocks({
        body: { a: { b: { c: { d: { e: 'too deep' } } } } }, // depth 5
      });

      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'BODY_DEPTH_EXCEEDED',
        })
      );
    });

    it('should pass through requests with no body', () => {
      const middleware = requestDepthLimiter(3);
      const { req, res, next } = createMocks();
      req.body = undefined;

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle flat objects', () => {
      const middleware = requestDepthLimiter(3);
      const { req, res, next } = createMocks({
        body: { name: 'test', age: 25, active: true },
      });

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── Encryption Tests ────────────────────────────────────────────────────

  describe('encryptValue / decryptValue', () => {
    const masterSecret = 'test-master-secret-with-at-least-32-characters';

    it('should encrypt and decrypt a value correctly', () => {
      const plaintext = 'sk-abc123def456ghi789';
      const encrypted = encryptValue(plaintext, masterSecret);
      const decrypted = decryptValue(encrypted, masterSecret);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext (random salt/IV)', () => {
      const plaintext = 'same-value';
      const encrypted1 = encryptValue(plaintext, masterSecret);
      const encrypted2 = encryptValue(plaintext, masterSecret);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(decryptValue(encrypted1, masterSecret)).toBe(plaintext);
      expect(decryptValue(encrypted2, masterSecret)).toBe(plaintext);
    });

    it('should fail to decrypt with wrong secret', () => {
      const plaintext = 'sensitive-api-key';
      const encrypted = encryptValue(plaintext, masterSecret);

      expect(() => {
        decryptValue(encrypted, 'wrong-secret-that-is-at-least-32-chars');
      }).toThrow();
    });

    it('should fail on invalid encrypted format', () => {
      expect(() => {
        decryptValue('not:valid', masterSecret);
      }).toThrow('Invalid encrypted value format');
    });

    it('should handle empty strings', () => {
      const encrypted = encryptValue('', masterSecret);
      const decrypted = decryptValue(encrypted, masterSecret);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = '密码是🔑安全的!';
      const encrypted = encryptValue(plaintext, masterSecret);
      const decrypted = decryptValue(encrypted, masterSecret);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long values', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encryptValue(plaintext, masterSecret);
      const decrypted = decryptValue(encrypted, masterSecret);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypted output should contain salt:iv:authTag:ciphertext', () => {
      const encrypted = encryptValue('test', masterSecret);
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      // salt = 32 bytes = 64 hex chars
      expect(parts[0]).toHaveLength(64);
      // iv = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // authTag = 16 bytes = 32 hex chars
      expect(parts[2]).toHaveLength(32);
      // ciphertext should be non-empty
      expect(parts[3].length).toBeGreaterThan(0);
    });
  });
});
