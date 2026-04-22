import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config/settings';
import { logger } from '../utils/logger';

interface JWTPayload {
  userId: string;
  email?: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * Verify JWT token and return payload
 */
function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, config.security.jwtSecret) as JWTPayload;
    return payload;
  } catch (error) {
    logger.warn('JWT verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string, email?: string, role: 'user' | 'admin' = 'user'): string {
  const payload = {
    userId,
    email,
    role
  };
  
  return jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: '7d',
    issuer: 'lackadaisical-ai-chat'
  });
}

/**
 * Generate refresh token with unique jti to prevent collisions
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    config.security.jwtSecret,
    { expiresIn: '30d', issuer: 'lackadaisical-ai-chat' }
  );
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Required authentication middleware
 * Blocks requests without valid JWT token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }
  
  const payload = verifyToken(token);
  
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
    return;
  }
  
  req.user = payload;
  next();
}

/**
 * Optional authentication middleware
 * Continues even without token, but attaches user if present
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}

/**
 * Admin-only middleware
 * Requires valid admin JWT token
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }
  
  const payload = verifyToken(token);
  
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
    return;
  }
  
  if (payload.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }
  
  req.user = payload;
  next();
}

/**
 * API key authentication middleware
 * For service-to-service communication
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
    return;
  }
  
  // In production, you would verify the API key against a database
  // For now, we'll use a simple check against environment variable
  const validApiKey = process.env.SERVICE_API_KEY;
  
  if (!validApiKey || apiKey !== validApiKey) {
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }
  
  next();
}

export default {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireApiKey,
  generateToken,
  generateRefreshToken,
  hashPassword,
  comparePassword
};
