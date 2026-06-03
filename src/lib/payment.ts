// ── DAWN WHALES — Payment Integration (Scaffolding) ────────────────────────
// TODO: Configure API keys in .env for production use
// STRIPE_SECRET_KEY=sk_test_...
// STRIPE_WEBHOOK_SECRET=whsec_...
// WECHAT_PAY_APP_ID=wx...
// WECHAT_PAY_MCH_ID=...
// WECHAT_PAY_API_KEY=...

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
    name: '免费版',
    description: '基础行情 + 3个策略 + 回测',
    price: 0,
    currency: 'cny',
  },
  {
    id: 'dw_pro_monthly',
    name: '专业版 · 月付',
    description: '无限策略 + 实盘 + 高级指标',
    price: 9900, // ¥99
    currency: 'cny',
    interval: 'month',
  },
  {
    id: 'dw_pro_yearly',
    name: '专业版 · 年付',
    description: '无限策略 + 实盘 + 高级指标 (省33%)',
    price: 29900, // ¥299/年
    currency: 'cny',
    interval: 'year',
  },
  {
    id: 'dw_marketplace_commission',
    name: '策略市场抽成',
    description: '平台收取30%交易手续费',
    price: 0,
    currency: 'cny',
  },
];

// ── Stripe integration (stub) ──────────────────────────────────────────

export async function createStripeCheckout(productId: string): Promise<CheckoutSession> {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new Error('Product not found');

  // TODO: Replace with actual Stripe API call
  // const session = await stripe.checkout.sessions.create({ ... });
  console.warn('[Payment] Stripe checkout not configured yet');
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
  if (!product) throw new Error('Product not found');

  // TODO: Replace with actual WeChat Pay API call
  // const order = await wechatPay.createOrder({ ... });
  console.warn('[Payment] WeChat Pay not configured yet');
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
  console.warn('[License] Verification server not configured');
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
