// ── DAWN WHALES JWT Authentication Middleware ─────────────────────────
// R129-P03: JWT sign/verify/refresh with Bearer token

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

// ── Middleware ────────────────────────────────────────────────────────

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    if ((payload as Record<string, string>).type === 'refresh') {
      res.status(401).json({ success: false, error: 'Refresh token cannot be used for API access' });
      return;
    }
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ── Routes ───────────────────────────────────────────────────────────

export function registerAuthRoutes(app: ReturnType<typeof import('express').default>): void {
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password required' });
      return;
    }

    const db = require('../db/database').getMainDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as Record<string, string> | undefined;

    // TODO: Replace with bcrypt in production
    if (!user || user.password_hash !== password) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, username: user.username });
    const refresh = signRefreshToken(user.id);
    res.json({ success: true, token, refresh, userId: user.id, username: user.username });
  });

  app.post('/api/auth/refresh', (req: Request, res: Response) => {
    const { refresh } = req.body;
    if (!refresh) {
      res.status(400).json({ success: false, error: 'refresh token required' });
      return;
    }

    try {
      const payload = verifyToken(refresh);
      if ((payload as Record<string, string>).type !== 'refresh') {
        res.status(401).json({ success: false, error: 'Invalid refresh token type' });
        return;
      }
      const db = require('../db/database').getMainDb();
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.userId) as Record<string, string> | undefined;
      if (!user) {
        res.status(401).json({ success: false, error: 'User not found' });
        return;
      }

      const token = signToken({ userId: user.id, username: user.username });
      const newRefresh = signRefreshToken(user.id);
      res.json({ success: true, token, refresh: newRefresh });
    } catch {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password required' });
      return;
    }

    const db = require('../db/database').getMainDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ success: false, error: 'Username already exists' });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, password);

    const token = signToken({ userId: id, username });
    const refresh = signRefreshToken(id);
    res.status(201).json({ success: true, token, refresh, userId: id, username });
  });
}
