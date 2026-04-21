import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/DatabaseService';
import {
  generateToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  requireAuth,
  AuthenticatedRequest
} from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/settings';

/**
 * Create auth routes with database-backed user storage.
 * Users, passwords, and refresh tokens are persisted in the database.
 */
export function createAuthRoutes(db: DatabaseService): Router {
  const router = Router();
  const authRateLimiter = endpointRateLimiter('auth');

  /**
   * Validate email format safely — avoids ReDoS by using indexOf-based checks
   * instead of regex with unbounded quantifiers on user input.
   */
  function isValidEmail(email: string): boolean {
    if (typeof email !== 'string') return false;
    if (email.length > 254) return false; // RFC 5321 max length
    const atIndex = email.indexOf('@');
    if (atIndex < 1) return false; // must have local part
    const dotIndex = email.lastIndexOf('.');
    if (dotIndex <= atIndex + 1) return false; // must have domain with dot
    if (dotIndex >= email.length - 1) return false; // must have TLD
    if (email.includes(' ')) return false; // no spaces
    return true;
  }

  /** Ensure the users and refresh_tokens tables exist */
  async function ensureAuthTables(): Promise<void> {
    try {
      await db.executeStatement(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);
      await db.executeStatement(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await db.executeStatement(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await db.executeStatement(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
      await db.executeStatement(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`);
    } catch (error) {
      logger.error('Failed to ensure auth tables:', error);
    }
  }

  ensureAuthTables();

  /** Helper to extract first row from query result */
  function firstRow<T>(result: { data: T | T[] | null | undefined }): T | undefined {
    if (!result.data) return undefined;
    if (Array.isArray(result.data)) return result.data[0];
    return result.data;
  }

  // POST /auth/register
  router.post('/register', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    if (!email || !password) throw new ApiError(400, 'Email and password are required');
    if (!isValidEmail(email)) {
      throw new ApiError(400, 'Valid email address is required');
    }
    if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');

    const existing = firstRow(await db.executeQuery<{ id: string }>('SELECT id FROM users WHERE email = ?', [email]));
    if (existing) throw new ApiError(409, 'User with this email already exists');

    const userId = uuidv4();
    const hashedPw = await hashPassword(password);
    const userName = name || email.split('@')[0];

    await db.executeStatement(
      'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [userId, email, userName, hashedPw, 'user']
    );

    const accessToken = generateToken(userId, email, 'user');
    const refreshToken = generateRefreshToken(userId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.executeStatement(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, refreshToken, expiresAt]
    );

    logger.info('User registered', { userId, email });
    res.status(201).json({
      success: true,
      data: {
        user: { id: userId, email, name: userName, role: 'user' },
        tokens: { accessToken, refreshToken, expiresIn: 604800 }
      },
      message: 'Registration successful'
    });
  }));

  // POST /auth/login
  router.post('/login', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, 'Email and password are required');

    const user = firstRow(await db.executeQuery<{
      id: string; email: string; name: string; password_hash: string; role: string;
    }>('SELECT id, email, name, password_hash, role FROM users WHERE email = ?', [email]));

    if (!user) throw new ApiError(401, 'Invalid email or password');
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw new ApiError(401, 'Invalid email or password');

    const accessToken = generateToken(user.id, email, user.role as 'user' | 'admin');
    const refreshToken = generateRefreshToken(user.id);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.executeStatement(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );
    await db.executeStatement('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    logger.info('User logged in', { userId: user.id, email });
    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        tokens: { accessToken, refreshToken, expiresIn: 604800 }
      },
      message: 'Login successful'
    });
  }));

  // POST /auth/refresh
  router.post('/refresh', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new ApiError(400, 'Refresh token is required');

    let payload: { userId: string; type: string };
    try {
      payload = jwt.verify(refreshToken, config.security.jwtSecret) as { userId: string; type: string };
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh') throw new ApiError(401, 'Invalid token type');

    const stored = firstRow(await db.executeQuery<{ user_id: string; expires_at: string }>(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token = ? AND user_id = ?',
      [refreshToken, payload.userId]
    ));
    if (!stored) throw new ApiError(401, 'Invalid refresh token');
    if (new Date(stored.expires_at) < new Date()) {
      await db.executeStatement('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      throw new ApiError(401, 'Refresh token expired');
    }

    await db.executeStatement('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    const user = firstRow(await db.executeQuery<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM users WHERE id = ?', [payload.userId]
    ));
    if (!user) throw new ApiError(401, 'User not found');

    const newAccessToken = generateToken(user.id, user.email, user.role as 'user' | 'admin');
    const newRefreshToken = generateRefreshToken(user.id);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.executeStatement(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, newRefreshToken, expiresAt]
    );

    res.json({
      success: true,
      data: { tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 604800 } },
      message: 'Token refreshed successfully'
    });
  }));

  // POST /auth/logout
  router.post('/logout', authRateLimiter, requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (userId) await db.executeStatement('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    logger.info('User logged out', { userId });
    res.json({ success: true, message: 'Logged out successfully' });
  }));

  // GET /auth/me
  router.get('/me', authRateLimiter, requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const user = firstRow(await db.executeQuery<{
      id: string; email: string; name: string; role: string; created_at: string;
    }>('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [userId]));
    if (!user) throw new ApiError(404, 'User not found');

    res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.created_at } } });
  }));

  // POST /auth/change-password
  router.post('/change-password', authRateLimiter, requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;
    if (!currentPassword || !newPassword) throw new ApiError(400, 'Current password and new password are required');
    if (newPassword.length < 8) throw new ApiError(400, 'New password must be at least 8 characters');
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const user = firstRow(await db.executeQuery<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = ?', [userId]
    ));
    if (!user) throw new ApiError(404, 'User not found');
    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) throw new ApiError(401, 'Current password is incorrect');

    const newHash = await hashPassword(newPassword);
    await db.executeStatement('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, userId]);
    await db.executeStatement('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

    logger.info('Password changed', { userId });
    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  }));

  // PUT /auth/profile — Update user profile (name, email)
  router.put('/profile', authRateLimiter, requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Not authenticated');

    const { name, email } = req.body;
    if (!name && !email) throw new ApiError(400, 'At least one of name or email is required');

    const user = firstRow(await db.executeQuery<{ id: string; email: string; name: string; role: string }>(
      'SELECT id, email, name, role FROM users WHERE id = ?', [userId]
    ));
    if (!user) throw new ApiError(404, 'User not found');

    // Validate name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new ApiError(400, 'Name must be a non-empty string');
      }
      if (name.trim().length > 50) {
        throw new ApiError(400, 'Name must be 50 characters or fewer');
      }
    }

    // Validate email uniqueness if changing
    if (email !== undefined && email !== user.email) {
      if (!isValidEmail(email)) {
        throw new ApiError(400, 'Valid email address is required');
      }
      const existingEmail = firstRow(await db.executeQuery<{ id: string }>(
        'SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]
      ));
      if (existingEmail) throw new ApiError(409, 'Email is already in use by another account');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email.trim());
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await db.executeStatement(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Return updated profile
    const updated = firstRow(await db.executeQuery<{
      id: string; email: string; name: string; role: string; created_at: string;
    }>('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [userId]));

    if (!updated) throw new ApiError(404, 'User not found after update');

    logger.info('User profile updated', { userId, updatedFields: Object.keys(req.body) });
    res.json({
      success: true,
      data: {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          createdAt: updated.created_at
        }
      },
      message: 'Profile updated successfully'
    });
  }));

  return router;
}

// Default export for backward compatibility
const router = Router();
export default router;
