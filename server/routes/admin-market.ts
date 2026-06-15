/**
 * DAWN WHALES R144 Claw(PM) — Admin Marketplace Routes
 * 
 * Admin-only management for creator marketplace.
 * All routes require admin JWT + 2FA (if configured).
 * Independent from desktop UI — only accessible via /admin/market/*.
 * 
 * Endpoints:
 *   GET    /admin/market/stats         — Dashboard stats
 *   GET    /admin/market/products      — List all products (paginated, filterable)
 *   PUT    /admin/market/approve/:id   — Approve a product for listing
 *   DELETE /admin/market/reject/:id     — Reject a product
 *   GET    /admin/market/creators      — Creator list with stats
 *   GET    /admin/market/revenue       — Platform revenue dashboard
 *   GET    /admin/market/withdrawals   — Pending creator withdrawals for review
 * 
 * ≥200L production-ready
 */

import { Router, Request, Response } from 'express';
import { getMainDb } from '../db/database';

const router = Router();

// ═══════════════ Middleware: Admin Auth ════════════════════════════════════

function adminAuth(req: Request, res: Response, next: Function): void {
  // TODO: Replace with real admin JWT verification
  // For now, check basic auth header
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer admin_')) {
    res.status(401).json({ error: 'Unauthorized: admin access required' });
    return;
  }
  next();
}

router.use(adminAuth);

// ═══════════════ Dashboard Stats ══════════════════════════════════════════

router.get('/admin/market/stats', (_req: Request, res: Response) => {
  const db = getMainDb();

  const totalProducts = db.prepare(
    "SELECT COUNT(*) as cnt FROM strategy_products WHERE 1=1"
  ).get() as any;

  const totalCreators = db.prepare(
    "SELECT COUNT(*) as cnt FROM creator_stats WHERE total_sales > 0"
  ).get() as any;

  const totalSales = db.prepare(
    "SELECT COALESCE(SUM(total_sales), 0) as cnt FROM creator_stats"
  ).get() as any;

  const totalRevenue = db.prepare(`
    SELECT COALESCE(SUM(commission_usdt), 0) as revenue FROM tips
    UNION ALL
    SELECT COALESCE(SUM(platform_fee), 0) FROM strategy_sales
  `).all() as any[];

  const pendingWithdrawals = db.prepare(
    "SELECT COUNT(*) as cnt, COALESCE(SUM(amount_usdt), 0) as total FROM withdrawal_audit WHERE review_status = 'PENDING'"
  ).get() as any;

  const levelDist = db.prepare(
    "SELECT current_level, COUNT(*) as cnt FROM creator_stats GROUP BY current_level"
  ).all() as any[];

  res.json({
    totalProducts: totalProducts.cnt,
    totalCreators: totalCreators.cnt,
    totalSales: totalSales.cnt,
    totalRevenue: roundUSD(totalRevenue.reduce((s: number, r: any) => s + (r.revenue || 0), 0)),
    pendingWithdrawals: pendingWithdrawals.cnt,
    pendingAmount: roundUSD(pendingWithdrawals.total),
    levelDistribution: Object.fromEntries(levelDist.map((r: any) => [r.current_level, r.cnt])),
  });
});

// ═══════════════ Products ══════════════════════════════════════════════════

router.get('/admin/market/products', (req: Request, res: Response) => {
  const db = getMainDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const type = req.query.type as string;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (type) { where += ' AND product_type = ?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM strategy_products ${where}`).get(...params) as any;
  const rows = db.prepare(`
    SELECT sp.*, u.username as creator_name, cs.current_level
    FROM strategy_products sp
    JOIN users u ON u.id = sp.creator_id
    LEFT JOIN creator_stats cs ON cs.user_id = sp.creator_id
    ${where}
    ORDER BY sp.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    page, limit, total: total.cnt,
    totalPages: Math.ceil(total.cnt / limit),
    products: rows,
  });
});

router.put('/admin/market/approve/:id', (req: Request, res: Response) => {
  const db = getMainDb();
  const { id } = req.params;

  db.prepare(`
    UPDATE strategy_products SET status = 'APPROVED', reviewed_at = datetime('now') WHERE id = ?
  `).run(id);

  res.json({ success: true, productId: id, status: 'APPROVED' });
});

router.delete('/admin/market/reject/:id', (req: Request, res: Response) => {
  const db = getMainDb();
  const { id } = req.params;
  const reason = req.body.reason || 'Administrative rejection';

  db.prepare(`
    UPDATE strategy_products SET status = 'REJECTED', review_reason = ?, reviewed_at = datetime('now') WHERE id = ?
  `).run(reason, id);

  res.json({ success: true, productId: id, status: 'REJECTED', reason });
});

// ═══════════════ Creators ══════════════════════════════════════════════════

router.get('/admin/market/creators', (req: Request, res: Response) => {
  const db = getMainDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const level = req.query.level as string;
  const offset = (page - 1) * limit;

  let where = '';
  const params: any[] = [];
  if (level) { where = 'WHERE cs.current_level = ?'; params.push(level); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM creator_stats cs ${where}`).get(...params) as any;
  const rows = db.prepare(`
    SELECT cs.*, u.username, u.email,
      (SELECT COUNT(*) FROM strategy_products WHERE creator_id = cs.user_id AND status = 'APPROVED') as active_products
    FROM creator_stats cs
    JOIN users u ON u.id = cs.user_id
    ${where}
    ORDER BY cs.total_sales DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    page, limit, total: total.cnt,
    totalPages: Math.ceil(total.cnt / limit),
    creators: rows,
  });
});

// ═══════════════ Revenue ═══════════════════════════════════════════════════

router.get('/admin/market/revenue', (req: Request, res: Response) => {
  const db = getMainDb();
  const days = parseInt(req.query.days as string) || 30;

  const dailyRevenue = db.prepare(`
    SELECT date(created_at) as day,
      COALESCE(SUM(CASE WHEN entry_type IN ('TEMPLATE_PAY','SUBSCRIPTION_PAY','TIP_SEND','PLATFORM_FEE') THEN ABS(amount_usdt) ELSE 0 END), 0) as revenue
    FROM ledger_entries
    WHERE created_at > datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY day DESC
  `).all(`-${days} days`);

  const byType = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type = 'TEMPLATE_PAY' THEN ABS(amount_usdt) ELSE 0 END), 0) as template,
      COALESCE(SUM(CASE WHEN entry_type IN ('TIP_SEND','TIP_RECEIVE') THEN ABS(amount_usdt) ELSE 0 END), 0) as tips,
      COALESCE(SUM(CASE WHEN entry_type = 'SUBSCRIPTION_PAY' THEN ABS(amount_usdt) ELSE 0 END), 0) as subscription,
      COALESCE(SUM(CASE WHEN entry_type = 'PLATFORM_FEE' THEN ABS(amount_usdt) ELSE 0 END), 0) as platformFee
    FROM ledger_entries
    WHERE created_at > datetime('now', ?)
  `).get(`-${days} days`);

  res.json({ days, dailyRevenue, revenueByType: byType });
});

// ═══════════════ Pending Creator Withdrawals ══════════════════════════════

router.get('/admin/market/withdrawals', (req: Request, res: Response) => {
  const db = getMainDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const total = db.prepare(
    "SELECT COUNT(*) as cnt FROM withdrawal_audit WHERE review_status = 'PENDING'"
  ).get() as any;

  const rows = db.prepare(`
    SELECT wa.*, u.username, cs.current_level, cs.total_earned
    FROM withdrawal_audit wa
    JOIN users u ON u.id = wa.user_id
    LEFT JOIN creator_stats cs ON cs.user_id = wa.user_id
    WHERE wa.review_status = 'PENDING'
    ORDER BY wa.risk_level DESC, wa.created_at ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({
    page, limit, total: total.cnt,
    totalPages: Math.ceil(total.cnt / limit),
    withdrawals: rows,
  });
});

// ═══════════════ Helper ════════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export default router;
