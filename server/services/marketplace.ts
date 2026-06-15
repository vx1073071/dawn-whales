/**
 * DAWN WHALES R144 J01+J02 — Marketplace Transaction Engine
 * 
 * Marketplace engine for creator products:
 *   1. Strategy Templates — one-time purchase
 *   2. Strategy Combos — one-time purchase (bundle of templates)
 *   3. Signal Subscriptions — monthly recurring
 *   4. Tips — handled in tip.ts (separate pipeline!)
 * 
 * Transaction lifecycle:
 *   1. Validate product (exists, published, ≥ 9.9 USDT min price)
 *   2. Check buyer balance
 *   3. Look up creator level → commission split
 *   4. Atomic debit buyer + credit creator + platform revenue
 *   5. Write dual ledger entries (TEMPLATE_PAY + TEMPLATE_EARN or SUBSCRIPTION_PAY + SUBSCRIPTION_EARN)
 *   6. Record sale stats (creator-level upgrade check)
 *   7. Grant access (add to user's purchased library)
 * 
 * v17.6 Rules:
 *  - Minimum price: 9.9 USDT for ALL products
 *  - Commission by creator level (L1:30% / L2:20% / L3:10%)
 *  - No additional fees beyond commission
 * 
 * ≥300L
 */

import Database from 'better-sqlite3';
import { CreatorLevelEngine, LEVEL_CONFIGS, CreatorLevel } from './creator-level';

export type ProductType = 'TEMPLATE' | 'COMBO' | 'SUBSCRIPTION';

export interface ProductInfo {
  id: string;
  creatorId: string;
  type: ProductType;
  title: string;
  priceUSDT: number;
  published: boolean;
  salesCount: number;
  createdAt: string;
}

export interface PurchaseRequest {
  buyerId: string;
  buyerWalletId: string;
  productId: string;
  idempotencyKey: string;
}

export interface PurchaseResult {
  success: boolean;
  purchaseId: string;
  productId: string;
  productType: ProductType;
  productTitle: string;
  buyerId: string;
  creatorId: string;
  priceUSDT: number;
  creatorLevel: CreatorLevel;
  platformShare: number;
  creatorShare: number;
  error?: string;
}

export interface SubscriptionInfo {
  id: string;
  userId: string;
  creatorId: string;
  productId: string;
  priceUSDT: number;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  nextBillingDate: string;
  pausedAt?: string;
  pausedReason?: string;
  createdAt: string;
}

// ═══════════════ Constants (v17.6) ═══════════════════════════════════════

const MIN_PRODUCT_PRICE = 9.9;  // USDT

// ═══════════════ Marketplace Engine ══════════════════════════════════════

export class MarketplaceEngine {
  private db: Database.Database;
  private levelEngine: CreatorLevelEngine;

  constructor(db: Database.Database, levelEngine: CreatorLevelEngine) {
    this.db = db;
    this.levelEngine = levelEngine;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      -- Products table
      CREATE TABLE IF NOT EXISTS marketplace_products (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('TEMPLATE','COMBO','SUBSCRIPTION')),
        title TEXT NOT NULL,
        description TEXT,
        price_usdt REAL NOT NULL CHECK(price_usdt >= 9.9),
        published INTEGER NOT NULL DEFAULT 0,
        sales_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_market_products_creator ON marketplace_products(creator_id);
      CREATE INDEX IF NOT EXISTS idx_market_products_type ON marketplace_products(type);

      -- Purchases table (one-time: template/combo)
      CREATE TABLE IF NOT EXISTS marketplace_purchases (
        id TEXT PRIMARY KEY,
        buyer_id TEXT NOT NULL,
        buyer_wallet_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_type TEXT NOT NULL,
        product_title TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        price_usdt REAL NOT NULL,
        creator_level TEXT NOT NULL,
        platform_share REAL NOT NULL,
        creator_share REAL NOT NULL,
        idempotency_key TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (buyer_wallet_id) REFERENCES wallets(id),
        FOREIGN KEY (product_id) REFERENCES marketplace_products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_market_purchases_buyer ON marketplace_purchases(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_market_purchases_creator ON marketplace_purchases(creator_id);
      CREATE INDEX IF NOT EXISTS idx_market_purchases_idempotency ON marketplace_purchases(idempotency_key);

      -- User library (purchased products)
      CREATE TABLE IF NOT EXISTS user_library (
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        purchase_id TEXT NOT NULL,
        access_granted INTEGER NOT NULL DEFAULT 1,
        purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES marketplace_products(id)
      );

      -- Subscriptions
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        price_usdt REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','CANCELLED')),
        next_billing_date TEXT NOT NULL,
        paused_at TEXT,
        paused_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES marketplace_products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_creator ON user_subscriptions(creator_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_billing ON user_subscriptions(next_billing_date);
    `);
  }

  // ═══════════ Product Management ════════════════════════════════════════

  createProduct(creatorId: string, type: ProductType, title: string, priceUSDT: number, description?: string): ProductInfo {
    if (priceUSDT < MIN_PRODUCT_PRICE) {
      throw new Error(`Price must be at least ${MIN_PRODUCT_PRICE} USDT`);
    }

    const id = generateId();
    this.db.prepare(`
      INSERT INTO marketplace_products (id, creator_id, type, title, description, price_usdt)
      VALUES (?,?,?,?,?,?)
    `).run(id, creatorId, type, title, description || null, priceUSDT);

    return this.getProduct(id)!;
  }

  publishProduct(productId: string, creatorId: string): boolean {
    const result = this.db.prepare(
      'UPDATE marketplace_products SET published=1, updated_at=datetime("now") WHERE id=? AND creator_id=?'
    ).run(productId, creatorId);
    return result.changes > 0;
  }

  unpublishProduct(productId: string, creatorId: string): boolean {
    const result = this.db.prepare(
      'UPDATE marketplace_products SET published=0, updated_at=datetime("now") WHERE id=? AND creator_id=?'
    ).run(productId, creatorId);
    return result.changes > 0;
  }

  getProduct(productId: string): ProductInfo | null {
    const row = this.db.prepare(
      'SELECT * FROM marketplace_products WHERE id = ?'
    ).get(productId) as any;
    if (!row) return null;
    return {
      id: row.id, creatorId: row.creator_id, type: row.type,
      title: row.title, priceUSDT: row.price_usdt,
      published: row.published === 1, salesCount: row.sales_count,
      createdAt: row.created_at,
    };
  }

  listProducts(type?: ProductType, creatorId?: string, limit = 50, offset = 0) {
    let query = 'SELECT * FROM marketplace_products WHERE published=1';
    const params: any[] = [];

    if (type) { query += ' AND type=?'; params.push(type); }
    if (creatorId) { query += ' AND creator_id=?'; params.push(creatorId); }

    query += ' ORDER BY sales_count DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      id: r.id, creatorId: r.creator_id, type: r.type as ProductType,
      title: r.title, priceUSDT: r.price_usdt,
      published: r.published === 1, salesCount: r.sales_count,
      createdAt: r.created_at,
    }));
  }

  // ═══════════ Purchase ══════════════════════════════════════════════════

  /**
   * Purchase a one-time product (template or combo).
   */
  purchase(req: PurchaseRequest): PurchaseResult {
    // Idempotency check
    const idemp = this.db.prepare(
      'SELECT id FROM marketplace_purchases WHERE idempotency_key = ?'
    ).get(req.idempotencyKey) as { id: string } | undefined;
    if (idemp) {
      const p = this.db.prepare('SELECT * FROM marketplace_purchases WHERE id=?').get(idemp.id) as any;
      if (p) return this.buildResult(p);
    }

    // Validate product
    const product = this.getProduct(req.productId);
    if (!product) {
      return { success: false, purchaseId: '', productId: req.productId, productType: 'TEMPLATE',
        productTitle: '', buyerId: req.buyerId, creatorId: '', priceUSDT: 0,
        creatorLevel: 'L1', platformShare: 0, creatorShare: 0, error: 'Product not found' };
    }
    if (!product.published) {
      return { success: false, purchaseId: '', productId: req.productId, productType: product.type,
        productTitle: product.title, buyerId: req.buyerId, creatorId: product.creatorId,
        priceUSDT: product.priceUSDT, creatorLevel: 'L1', platformShare: 0, creatorShare: 0,
        error: 'Product not published' };
    }
    if (product.priceUSDT < MIN_PRODUCT_PRICE) {
      return { success: false, purchaseId: '', productId: req.productId, productType: product.type,
        productTitle: product.title, buyerId: req.buyerId, creatorId: product.creatorId,
        priceUSDT: product.priceUSDT, creatorLevel: 'L1', platformShare: 0, creatorShare: 0,
        error: `Price < ${MIN_PRODUCT_PRICE} USDT minimum` };
    }
    if (product.creatorId === req.buyerId) {
      return { success: false, purchaseId: '', productId: req.productId, productType: product.type,
        productTitle: product.title, buyerId: req.buyerId, creatorId: product.creatorId,
        priceUSDT: product.priceUSDT, creatorLevel: 'L1', platformShare: 0, creatorShare: 0,
        error: 'Cannot purchase your own product' };
    }
    // Check subscription product purchased via purchase() — must use subscribe()
    if (product.type === 'SUBSCRIPTION') {
      return { success: false, purchaseId: '', productId: req.productId, productType: 'SUBSCRIPTION',
        productTitle: product.title, buyerId: req.buyerId, creatorId: product.creatorId,
        priceUSDT: product.priceUSDT, creatorLevel: 'L1', platformShare: 0, creatorShare: 0,
        error: 'Subscription products must use /api/subscription/subscribe' };
    }

    // Check balance
    const buyerWallet = this.db.prepare(
      'SELECT * FROM wallets WHERE id=? AND user_id=?'
    ).get(req.buyerWalletId, req.buyerId) as any;
    if (!buyerWallet || buyerWallet.usdt_balance < product.priceUSDT) {
      return { success: false, purchaseId: '', productId: req.productId, productType: product.type,
        productTitle: product.title, buyerId: req.buyerId, creatorId: product.creatorId,
        priceUSDT: product.priceUSDT, creatorLevel: 'L1', platformShare: 0, creatorShare: 0,
        error: 'Insufficient balance' };
    }

    // Commission calculation
    const commission = this.levelEngine.calculateCommission(product.creatorId, product.priceUSDT);

    // Get creator wallet
    const creatorWallet = this.db.prepare('SELECT * FROM wallets WHERE user_id=?')
      .get(product.creatorId) as any;

    let purchaseId = '';
    const txResult = this.db.transaction(() => {
      // Debit buyer
      const buyerNewBalance = roundUSD(buyerWallet.usdt_balance - product.priceUSDT);
      const buyerNewVersion = buyerWallet.version + 1;
      const buyerChecksum = computeChecksum(buyerNewBalance, buyerWallet.usdt_frozen, buyerNewVersion);
      this.db.prepare(
        "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
      ).run(buyerNewBalance, buyerChecksum, buyerNewVersion, req.buyerWalletId, buyerWallet.version);

      // Credit creator
      if (creatorWallet) {
        const creatorNewBalance = roundUSD(creatorWallet.usdt_balance + commission.creatorShare);
        const creatorNewVersion = creatorWallet.version + 1;
        const creatorChecksum = computeChecksum(creatorNewBalance, creatorWallet.usdt_frozen, creatorNewVersion);
        this.db.prepare(
          "UPDATE wallets SET usdt_balance=?, checksum=?, version=?, updated_at=datetime('now') WHERE id=? AND version=?"
        ).run(creatorNewBalance, creatorChecksum, creatorNewVersion, creatorWallet.id, creatorWallet.version);
      }

      // Create purchase record
      purchaseId = generateId();
      this.db.prepare(`
        INSERT INTO marketplace_purchases (id, buyer_id, buyer_wallet_id, product_id, product_type, product_title, creator_id, price_usdt, creator_level, platform_share, creator_share, idempotency_key)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(purchaseId, req.buyerId, req.buyerWalletId, product.id, product.type,
        product.title, product.creatorId, product.priceUSDT,
        commission.level, commission.platformShare, commission.creatorShare,
        req.idempotencyKey);

      // Ledger: buyer payment
      this.db.prepare(`
        INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(req.buyerWalletId, req.buyerId, 'TEMPLATE_PAY', -product.priceUSDT, buyerNewBalance,
        purchaseId, `${req.idempotencyKey}_pay`, `${product.title} purchase`);

      // Ledger: creator earning
      if (creatorWallet) {
        this.db.prepare(`
          INSERT INTO ledger_entries (wallet_id, user_id, entry_type, amount_usdt, balance_after, reference_id, idempotency_key, description)
          VALUES (?,?,?,?,?,?,?,?)
        `).run(creatorWallet.id, product.creatorId, 'TEMPLATE_EARN', commission.creatorShare,
          roundUSD(creatorWallet.usdt_balance + commission.creatorShare),
          purchaseId, `${req.idempotencyKey}_earn`,
          `${product.title} sold (${commission.level}, ${commission.platformRate*100}% commission)`);
      }

      // Grant access
      this.db.prepare(
        'INSERT OR REPLACE INTO user_library (user_id, product_id, purchase_id) VALUES (?,?,?)'
      ).run(req.buyerId, product.id, purchaseId);

      // Update product sales count
      this.db.prepare(
        'UPDATE marketplace_products SET sales_count = sales_count + 1, updated_at = datetime("now") WHERE id = ?'
      ).run(product.id);
    }) as (() => void);

    try { txResult(); } catch (err: any) {
      return { success: false, purchaseId: '', productId: req.productId, productType: product.type,
        productTitle: product.title, buyerId: req.buyerId, creatorId: product.creatorId,
        priceUSDT: product.priceUSDT, creatorLevel: commission.level,
        platformShare: commission.platformShare, creatorShare: commission.creatorShare,
        error: `Transaction failed: ${err.message}` };
    }

    // Record sale
    this.levelEngine.recordSale(product.creatorId, commission.creatorShare);

    return {
      success: true, purchaseId,
      productId: product.id, productType: product.type, productTitle: product.title,
      buyerId: req.buyerId, creatorId: product.creatorId, priceUSDT: product.priceUSDT,
      creatorLevel: commission.level, platformShare: commission.platformShare,
      creatorShare: commission.creatorShare,
    };
  }

  // ═══════════ User Library ════════════════════════════════════════════

  getUserLibrary(userId: string) {
    const rows = this.db.prepare(`
      SELECT mp.*, ul.purchased_at FROM user_library ul
      JOIN marketplace_products mp ON mp.id = ul.product_id
      WHERE ul.user_id = ?
    `).all(userId) as any[];
    return rows.map(r => ({
      id: r.id, creatorId: r.creator_id, type: r.type as ProductType,
      title: r.title, priceUSDT: r.price_usdt,
      purchasedAt: r.purchased_at,
    }));
  }

  hasAccess(userId: string, productId: string): boolean {
    const row = this.db.prepare(
      'SELECT 1 FROM user_library WHERE user_id=? AND product_id=?'
    ).get(userId, productId);
    return !!row;
  }

  // ═══════════ Helpers ═══════════════════════════════════════════════

  private buildResult(row: any): PurchaseResult {
    return {
      success: true, purchaseId: row.id,
      productId: row.product_id, productType: row.product_type, productTitle: row.product_title,
      buyerId: row.buyer_id, creatorId: row.creator_id, priceUSDT: row.price_usdt,
      creatorLevel: row.creator_level, platformShare: row.platform_share, creatorShare: row.creator_share,
    };
  }
}

// ═══════════════ Helpers ═════════════════════════════════════════════════

function roundUSD(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function computeChecksum(balance: number, frozen: number, version: number): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${balance}:${frozen}:${version}`).digest('hex');
}

function generateId(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}
