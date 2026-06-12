// ── DAWN WHALES Signal API Routes ─────────────────────────────────────
// R129-P05: Signal receiver endpoint + query
// R137 J02 FIX: /pending brokerId now filters by broker_id (not used as LIMIT)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/jwt-auth';
import { getMainDb } from '../db/database';

const router = Router();

// POST /api/signal — Receive signal from provider
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { symbol, direction, price, confidence, brokerType, brokerId } = req.body;
  const user = (req as Request & { user: { userId: string; username: string } }).user;

  if (!symbol || !direction) {
    res.status(400).json({ success: false, error: 'symbol and direction required' });
    return;
  }

  if (!['BUY', 'SELL'].includes(direction)) {
    res.status(400).json({ success: false, error: 'direction must be BUY or SELL' });
    return;
  }

  const broker = brokerType || 'cloud';
  if (!['cloud', 'opend'].includes(broker)) {
    res.status(400).json({ success: false, error: 'brokerType must be cloud or opend' });
    return;
  }

  const priority = direction === 'SELL' && (req.body.stopLoss || req.body.emergency) ? 'P0' : 'P1';

  const db = getMainDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO signals (id, provider_id, symbol, direction, price, confidence, broker_type, broker_id, status, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, user.userId, symbol, direction, price || null, confidence || 0, broker, brokerId || broker, priority);

  res.status(201).json({
    success: true,
    signal: { id, symbol, direction, brokerType: broker, status: 'pending', priority },
  });
});

// GET /api/signal — Query signals
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as Request & { user: { userId: string } }).user;
  const { brokerType, brokerId, status, limit } = req.query;
  const db = getMainDb();

  let sql = 'SELECT * FROM signals WHERE provider_id = ?';
  const params: unknown[] = [user.userId];

  if (brokerType) { sql += ' AND broker_type = ?'; params.push(brokerType); }
  if (brokerId) { sql += ' AND broker_id = ?'; params.push(brokerId); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit as string, 10)); }

  const signals = db.prepare(sql).all(...params);
  res.json({ success: true, signals, total: signals.length });
});

// GET /api/signal/pending — Get pending OpenD signals for desktop client
// R137 J02 FIX: brokerId filters by broker_id column, limit controls batch size
router.get('/pending', authMiddleware, (req: Request, res: Response) => {
  const user = (req as Request & { user: { userId: string } }).user;
  const { brokerId, limit } = req.query;

  const db = getMainDb();
  let sql = 'SELECT * FROM signals WHERE broker_type = ? AND status IN (?,?) AND provider_id = ?';
  const params: unknown[] = ['opend', 'pending', 'failed', user.userId];

  if (brokerId && brokerId !== '') {
    sql += ' AND broker_id = ?';
    params.push(brokerId);
  }

  sql += ' ORDER BY priority ASC, created_at ASC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit as string, 10) || 50); }

  const signals = db.prepare(sql).all(...params);
  res.json({ success: true, signals, total: signals.length });
});

// POST /api/signal/:id/execute — Report execution result (desktop OpenD)
router.post('/:id/execute', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { success, orderId, errorMessage, fee, feeCurrency } = req.body;
  const db = getMainDb();

  const status = success ? 'executed' : 'failed';
  db.prepare(`
    UPDATE signals SET status = ?, error_message = ?, executed_at = datetime('now')
    WHERE id = ?
  `).run(status, errorMessage || null, id);

  if (success && orderId) {
    const user = (req as Request & { user: { userId: string } }).user;
    const signal = db.prepare('SELECT * FROM signals WHERE id = ?').get(id) as Record<string, string>;
    if (signal) {
      const tradeId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO copy_trades (id, signal_id, user_id, broker_id, order_id, symbol, side, quantity, fee, fee_currency, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'executed')
      `).run(tradeId, id, user.userId, signal.broker_id || 'opend', orderId, signal.symbol, signal.direction, req.body.quantity || 0, fee || 0, feeCurrency || 'USDT');
    }
  }

  res.json({ success: true, signalId: id, status });
});

export default router;
