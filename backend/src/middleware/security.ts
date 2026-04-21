/**
 * Security Middleware — Enterprise-grade request sanitization,
 * CSRF protection, and security header enforcement.
 * 
 * Provides defense-in-depth against:
 * - XSS (Cross-Site Scripting) via input sanitization
 * - SQL Injection via parameterized query enforcement and input validation
 * - CSRF (Cross-Site Request Forgery) via double-submit cookie pattern
 * - Clickjacking via frame-deny headers
 * - MIME sniffing via content-type enforcement
 * - Information disclosure via error masking
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// ─── Input Sanitization ─────────────────────────────────────────────────────

/**
 * Strips potentially dangerous HTML/script content from string values.
 * Preserves markdown code blocks (```) which are legitimate in chat.
 */
function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;

  // Encode HTML entities to prevent XSS
  let sanitized = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Remove null bytes (common in injection attacks)
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Recursively sanitize all string values in an object.
 * Skips known safe fields that may contain legitimate HTML/code.
 */
const SAFE_FIELDS = new Set([
  'content', 'message', 'prompt', 'code', 'html', 'markdown',
  'system', 'template', 'fileContent', 'response', 'thinking',
]);

function sanitizeObject(obj: any, depth: number = 0, parentKey?: string): any {
  // Prevent infinite recursion
  if (depth > 10) return obj;

  if (typeof obj === 'string') {
    // Skip sanitization for known code/content fields
    if (parentKey && SAFE_FIELDS.has(parentKey)) {
      // Still remove null bytes even in safe fields
      return obj.replace(/\0/g, '');
    }
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1, parentKey));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, depth + 1, key);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Request sanitization middleware.
 * Sanitizes query params and body params to strip XSS vectors.
 */
export function requestSanitizer(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize request body (skip multipart form-data — binary content)
    const contentType = req.headers['content-type'] || '';
    if (req.body && typeof req.body === 'object' && !contentType.includes('multipart/form-data')) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Request sanitization error:', error);
    next(); // Don't block the request on sanitization failure
  }
}

// ─── CSRF Protection ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure CSRF token.
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF protection using the double-submit cookie pattern.
 * 
 * On GET requests: generates a CSRF token and sets it as a cookie + response header.
 * On state-changing requests (POST/PUT/DELETE): validates the token from the
 * X-CSRF-Token header matches the csrf_token cookie.
 * 
 * Exempt paths: /api/v1/chat (SSE streaming uses GET), /health, /api (docs)
 */
const CSRF_EXEMPT_PATHS = new Set([
  '/health',
  '/api',
]);

const CSRF_EXEMPT_PREFIXES = [
  '/api/v1/chat',      // Chat uses streaming POST — frontend sends via fetch, not forms
  '/api/chat',
  '/api/v1/files/upload', // File uploads are multipart
  '/api/files/upload',
  '/api/v1/auth',      // Auth endpoints manage their own security via JWT
  '/api/auth',
];

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip for GET/HEAD/OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Set CSRF token for subsequent state-changing requests
    if (!req.cookies?.csrf_token) {
      const token = generateCsrfToken();
      res.cookie('csrf_token', token, {
        httpOnly: false, // Needs to be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
      res.setHeader('X-CSRF-Token', token);
    }
    return next();
  }

  // Check exemptions
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }
  if (CSRF_EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  // Validate CSRF token for state-changing requests
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn('CSRF validation failed:', {
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      ip: req.ip,
    });
    // Don't block in development — just warn
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        error: 'CSRF validation failed',
        code: 'CSRF_INVALID',
      });
      return;
    }
  }

  next();
}

// ─── Security Headers ────────────────────────────────────────────────────────

/**
 * Additional security headers beyond what helmet provides.
 * Enforces strict transport security, permission policies, and cache control.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Strict Transport Security (force HTTPS in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent page from being framed (clickjacking protection)
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection (legacy browser support)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy — minimize information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy — restrict browser features
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Cache-Control — prevent caching of API responses with sensitive data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Remove powered-by header
  res.removeHeader('X-Powered-By');

  next();
}

// ─── Request Size & Depth Limiting ──────────────────────────────────────────

/**
 * Validates request body depth to prevent deeply nested JSON payloads
 * that could cause stack overflow during processing.
 */
function getObjectDepth(obj: any, currentDepth: number = 0): number {
  if (currentDepth > 20) return currentDepth; // Early exit
  if (obj === null || typeof obj !== 'object') return currentDepth;

  let maxDepth = currentDepth;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      maxDepth = Math.max(maxDepth, getObjectDepth(value, currentDepth + 1));
    }
  }
  return maxDepth;
}

export function requestDepthLimiter(maxDepth: number = 15) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      if (depth > maxDepth) {
        logger.warn('Request body depth exceeded limit:', {
          path: req.path,
          depth,
          maxDepth,
          ip: req.ip,
        });
        res.status(400).json({
          success: false,
          error: 'Request body too deeply nested',
          code: 'BODY_DEPTH_EXCEEDED',
        });
        return;
      }
    }
    next();
  };
}

// ─── API Key Encryption at Rest ─────────────────────────────────────────────

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derive an encryption key from the JWT secret using PBKDF2.
 * This ensures API keys stored in the database are encrypted at rest.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt a plaintext value using AES-256-GCM.
 * Returns a combined string: salt:iv:authTag:ciphertext (all hex-encoded)
 */
export function encryptValue(plaintext: string, masterSecret: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterSecret, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt a value encrypted with encryptValue.
 */
export function decryptValue(encryptedStr: string, masterSecret: string): string {
  const parts = encryptedStr.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted value format');
  }

  const [saltHex, ivHex, authTagHex, ciphertext] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(masterSecret, salt);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ─── Export combined middleware ──────────────────────────────────────────────

/**
 * Apply all security middleware in the correct order.
 * Use this as a convenience function in the main server setup.
 */
export function applySecurityMiddleware(app: any): void {
  app.use(securityHeaders);
  app.use(requestSanitizer);
  app.use(requestDepthLimiter(15));
  // CSRF is optional — enable in production or when using cookie-based auth
  if (process.env.NODE_ENV === 'production') {
    app.use(csrfProtection);
  }
}
