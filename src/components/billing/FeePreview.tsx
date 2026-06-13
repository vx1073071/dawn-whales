// ── R150 ML #15 — FeePreview (统一预估手续费组件) ────────────────────────
// PM: 2h — All order/trade/AI/marketplace entry points show estimated fee
// v17.6 fee rates (permanent):
//   股票/ETF: 0.1% min 2U | 期货: 0.1% min 2U | 期权: 0.1% min 2U
//   加密现货: 0.1% min 2U | 加密合约: 0.02% min 0.5U
//   AI: 1-2U/次 (AIDrawPanel + AIStrategyPanel)
//   创作者市场: L1/L2/L3 抽成

import { Tag, Space, Tooltip } from 'antd';
import { DollarOutlined, InfoCircleOutlined } from '@ant-design/icons';

// ═══════════ Types ═══════════

export type AssetType = 'stock' | 'futures' | 'option' | 'crypto_spot' | 'crypto_contract';

export interface FeePreviewProps {
  assetType: AssetType;
  orderAmount?: number;       // USDT, for trading
  aiService?: 'draw' | 'chat' | 'param_fill' | 'combo' | 'backtest_interpret' | 'optimize' | 'health_check'
    | 'ta_standard' | 'ta_premium' | 'ta_flagship';
  marketplaceProduct?: 'template' | 'combo' | 'subscription';
  productPrice?: number;      // Marketplace product price
  creatorLevel?: 'L1' | 'L2' | 'L3';
  tipAmount?: number;
  showAiPrice?: boolean;
  size?: 'small' | 'default';
  style?: React.CSSProperties;
}

// ═══════════ Constants (v17.6 permanent) ═══════════

const TRADE_FEE_RATE: Record<AssetType, number> = {
  stock: 0.001,           // 0.1%
  futures: 0.001,
  option: 0.001,
  crypto_spot: 0.001,
  crypto_contract: 0.0002, // 0.02%
};

const TRADE_MIN_FEE: Record<AssetType, number> = {
  stock: 2,
  futures: 2,
  option: 2,
  crypto_spot: 2,
  crypto_contract: 0.5,
};

const AI_PRICE: Record<string, number> = {
  draw: 1,
  chat: 1,
  param_fill: 1,
  combo: 2,
  backtest_interpret: 1,
  optimize: 1.5,
  health_check: 1,
  ta_standard: 1.0,
  ta_premium: 1.5,
  ta_flagship: 2.0,
};

const PLATFORM_CUT: Record<string, number> = {
  L1: 0.30,
  L2: 0.20,
  L3: 0.10,
};

export function getTradeFee(assetType: AssetType, amount: number): number {
  const fee = amount * TRADE_FEE_RATE[assetType];
  return Math.max(fee, TRADE_MIN_FEE[assetType]);
}

export function getAiPrice(service: string): number {
  return AI_PRICE[service] ?? 1;
}

export function getMarketplaceFee(price: number, creatorLevel: string): {
  platformCut: number;
  creatorGets: number;
} {
  const rate = PLATFORM_CUT[creatorLevel] ?? 0.30;
  const cut = price * rate;
  return { platformCut: cut, creatorGets: price - cut };
}

// ═══════════ FeePreview Component ═══════════

export default function FeePreview({
  assetType, orderAmount, aiService, marketplaceProduct,
  productPrice = 0, creatorLevel = 'L1', tipAmount, showAiPrice = true,
  size = 'default', style,
}: FeePreviewProps) {
  // ── Trading fee ──
  const tradeFee = orderAmount != null && orderAmount > 0
    ? getTradeFee(assetType, orderAmount)
    : null;

  // ── AI fee ──
  const aiFee = aiService ? getAiPrice(aiService) : null;

  // ── Marketplace fee ──
  const marketFee = marketplaceProduct && productPrice > 0
    ? getMarketplaceFee(productPrice, creatorLevel)
    : null;

  // ── Tip fee ──
  const tipFee = tipAmount != null && tipAmount > 0 && creatorLevel
    ? getMarketplaceFee(tipAmount, creatorLevel)
    : null;

  const fs = size === 'small' ? 11 : 13;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', ...style }}>
      {/* Trading fee */}
      {tradeFee != null && (
        <Tooltip title={`${(TRADE_FEE_RATE[assetType] * 100).toFixed(assetType === 'crypto_contract' ? 3 : 1)}% rate · min ${TRADE_MIN_FEE[assetType]} USDT`}>
          <Tag color="blue" style={{ fontSize: fs }}>
            <DollarOutlined /> 手续费: {tradeFee.toFixed(2)} USDT
          </Tag>
        </Tooltip>
      )}

      {/* AI fee */}
      {aiFee != null && (
        <Tooltip title="AI service · deducted silently on completion">
          <Tag color="purple" style={{ fontSize: fs }}>
            <DollarOutlined /> AI: {aiFee} USDT
          </Tag>
        </Tooltip>
      )}

      {/* Marketplace fee */}
      {marketFee != null && (
        <Tooltip title={`Platform ${((PLATFORM_CUT[creatorLevel] ?? 0.30) * 100).toFixed(0)}% · Creator ${(100 - (PLATFORM_CUT[creatorLevel] ?? 0.30) * 100).toFixed(0)}%`}>
          <Space size={2} style={{ fontSize: fs }}>
            <Tag color="gold">{creatorLevel}</Tag>
            <span style={{ color: '#8b949e' }}>
              <InfoCircleOutlined style={{ fontSize: 10, marginRight: 2 }} />
              平台抽: {marketFee.platformCut.toFixed(2)}U · 创作者得: {marketFee.creatorGets.toFixed(2)}U
            </span>
          </Space>
        </Tooltip>
      )}

      {/* Tip fee */}
      {tipFee != null && (
        <Tooltip title={`Tip: platform ${((PLATFORM_CUT[creatorLevel] ?? 0.30) * 100).toFixed(0)}% · creator ${(100 - (PLATFORM_CUT[creatorLevel] ?? 0.30) * 100).toFixed(0)}%`}>
          <Space size={2} style={{ fontSize: fs }}>
            <Tag color="green">打赏 {tipAmount}U</Tag>
            <span style={{ color: '#8b949e' }}>
              创作者得: {tipFee.creatorGets.toFixed(2)}U
            </span>
          </Space>
        </Tooltip>
      )}

      {/* AI price table */}
      {showAiPrice && !aiService && !tradeFee && !marketFee && !tipFee && (
        <div style={{ padding: '4px 8px', background: '#1a2e2a', borderRadius: 6, border: '1px solid #3b82f633' }}>
          <Space wrap size={4} style={{ fontSize: 10 }}>
            {Object.entries(AI_PRICE).map(([k, v]) => (
              <Tag key={k} color="purple" style={{ fontSize: 9 }}>{k.replace(/_/g, ' ')}: {v}U</Tag>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
}
