import electronLog from 'electron-log';

// ── TradingEasy — Payment Integration (Scaffolding) ────────────────────────
//
// @deprecated Since v1.12.0 (2026-06-12).
// The project has moved to USDT-only points system (see electron/engine/data/usdt-points-manager.ts).
// This file was a scaffolding for Stripe/WeChat/Alipay integration that was never used in production.
// Retained for historical reference; will be deleted in R106 after final audit confirms no remaining consumers.
//
// Original comments:
// TODO: Configure API keys in .env for production use
// STRIPE_SECRET_KEY=sk_test_...
// STRIPE_WEBHOOK_SECRET=whsec_...
// WECHAT_PAY_APP_ID=wx...
// WECHAT_PAY_MCH_ID=...
// WECHAT_PAY_API_KEY=...
import { EngineError, ErrorDomain, ErrorCode } from '../../electron/engine/core/engine-error';
import i18n from '../i18n';

export type PaymentProvider = 'stripe' | 'wechat' | 'alipay';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;         // in cents for Stripe, in fen for WeChat
  currency: 'usd' | 'cny';
  interval?: 'month' | 'year';
}

export interface CheckoutSession {
  id: string;
  url: string;
  provider: PaymentProvider;
  productId: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
}

// ── Product catalog ─────────────────────────────────────────────────────

export const PRODUCTS: Product[] = [
  {
    id: 'dw_free',
    name: i18n.t('payment.k1'),
    description: i18n.t('payment.k2'),
    price: 0,
    currency: 'cny',
  },
  {
    id: 'dw_pro_monthly',
    name: i18n.t('payment.k3'),
    description: i18n.t('payment.k4'),
    price: 9900, // ¥99
    currency: 'cny',
    interval: 'month',
  },
  {
    id: 'dw_pro_yearly',
    name: i18n.t('payment.k5'),
    description: i18n.t('payment.k6'),
    price: 29900, // $299/yr
    currency: 'cny',
    interval: 'year',
  },
  {
    id: 'dw_marketplace_commission',
    name: i18n.t('payment.k7'),
    description: i18n.t('payment.k8'),
    price: 0,
    currency: 'cny',
  },
];

// ── Stripe integration (stub) ──────────────────────────────────────────

export async function createStripeCheckout(productId: string): Promise<CheckoutSession> {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new EngineError(ErrorDomain.TRADE, ErrorCode.DATA_UNAVAILABLE, 'Product not found');

  // TODO: Replace with actual Stripe API call
  // const session = await stripe.checkout.sessions.create({ ... });
  electronLog.warn('[Payment] Stripe checkout not configured yet');
  return {
    id: `cs_test_${Date.now()}`,
    url: '#',
    provider: 'stripe',
    productId,
    amount: product.price,
    status: 'pending',
  };
}

// ── WeChat Pay integration (stub) ──────────────────────────────────────

export async function createWechatPayOrder(productId: string): Promise<CheckoutSession> {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new EngineError(ErrorDomain.TRADE, ErrorCode.DATA_UNAVAILABLE, 'Product not found');

  // TODO: Replace with actual WeChat Pay API call
  // const order = await wechatPay.createOrder({ ... });
  electronLog.warn('[Payment] WeChat Pay not configured yet');
  return {
    id: `wx_test_${Date.now()}`,
    url: '#',
    provider: 'wechat',
    productId,
    amount: product.price,
    status: 'pending',
  };
}

// ── License verification (stub) ────────────────────────────────────────

export interface License {
  key: string;
  productId: string;
  email: string;
  activatedAt: string;
  expiresAt: string;
  maxDevices: number;
}

export async function verifyLicense(key: string): Promise<License | null> {
  // TODO: Replace with actual license server API
  electronLog.warn('[License] Verification server not configured');
  if (key.startsWith('DW-')) {
    return {
      key,
      productId: 'dw_pro_yearly',
      email: 'user@example.com',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      maxDevices: 3,
    };
  }
  return null;
}
