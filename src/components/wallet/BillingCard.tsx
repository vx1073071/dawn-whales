// ── R201 ML P1: BillingCards (7 AI计费卡片) ──────────
// 7 AI service cards with instant 1U charge + silent deduction
// Each card: service name, description, price, CTA button
// After click: instant charge → loading → result preview
// Minimalist design — one card per service type

import React, { useState, useCallback } from 'react';
import { Button, Tag, Skeleton } from 'antd';
import {
  ThunderboltOutlined, CompassOutlined, ScanOutlined,
  BellOutlined, AlertOutlined, PieChartOutlined,
  ReadOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type AIServiceId =
  | 'strategy_match' | 'market_state' | 'daily_briefing'
  | 'arbitrage_scan' | 'signal_push' | 'stress_test'
  | 'attribution';

interface AIServiceConfig {
  id: AIServiceId;
  title: string;
  titleCN: string;
  description: string;
  descriptionCN: string;
  icon: React.ReactNode;
  price: number; // USDT
  priceLabel: string;
  category: 'strategy' | 'market' | 'risk' | 'alert';
  color: string;
}

interface BillingCardProps {
  service: AIServiceConfig;
  onExecute?: (serviceId: AIServiceId) => Promise<{ success: boolean; balanceAfter?: number }>;
  onViewResult?: (serviceId: AIServiceId) => void;
  balance?: number | null;
  disabled?: boolean;
  compact?: boolean;
}

// ── i18n (9 languages minimal, shared) ──────────────────────────────
const BI18N: Record<string, { execute: string; executing: string; done: string; failed: string; retry: string; view: string; free: string; perUse: string }> = {
  'zh-CN': { execute: '立即执行', executing: '执行中...', done: '已完成', failed: '失败', retry: '重试', view: '查看', free: '免费', perUse: '/次' },
  en: { execute: 'Execute', executing: 'Running...', done: 'Done', failed: 'Failed', retry: 'Retry', view: 'View', free: 'Free', perUse: '/use' },
  ja: { execute: '実行', executing: '実行中...', done: '完了', failed: '失敗', retry: '再試行', view: '見る', free: '無料', perUse: '/回' },
  ko: { execute: '실행', executing: '실행 중...', done: '완료', failed: '실패', retry: '재시도', view: '보기', free: '무료', perUse: '/회' },
  fr: { execute: 'Exécuter', executing: 'En cours...', done: 'Terminé', failed: 'Échec', retry: 'Réessayer', view: 'Voir', free: 'Gratuit', perUse: '/fois' },
  it: { execute: 'Esegui', executing: 'In corso...', done: 'Completato', failed: 'Fallito', retry: 'Riprova', view: 'Vedi', free: 'Gratis', perUse: '/volta' },
  de: { execute: 'Ausführen', executing: 'Läuft...', done: 'Fertig', failed: 'Fehlgeschlagen', retry: 'Wiederholen', view: 'Ansehen', free: 'Kostenlos', perUse: '/Nutzung' },
  es: { execute: 'Ejecutar', executing: 'Ejecutando...', done: 'Completado', failed: 'Fallido', retry: 'Reintentar', view: 'Ver', free: 'Gratis', perUse: '/uso' },
};

// ── 7 AI Services ────────────────────────────────────────────────────
const AI_SERVICES: AIServiceConfig[] = [
  {
    id: 'strategy_match', title: 'AI Strategy Match', titleCN: 'AI策略匹配',
    description: 'Analyze your holdings → match best factor templates → AI coaching. 1U for personalized strategy.',
    descriptionCN: '持仓分析→因子画像→AI推荐最佳策略模板。1U获得个性化策略。',
    icon: <CompassOutlined />, price: 1, priceLabel: '1U/次',
    category: 'strategy', color: '#4a90d9',
  },
  {
    id: 'market_state', title: 'Market State Detector', titleCN: '市场状态检测',
    description: 'Bull/Bear/Range/Panic classification. AI recommends the right scenario pack for current regime.',
    descriptionCN: '牛/熊/震荡/恐慌四态分类→自动推荐适配的因子场景包。1U看清市场。',
    icon: <ScanOutlined />, price: 1, priceLabel: '1U/次',
    category: 'market', color: '#66bd63',
  },
  {
    id: 'daily_briefing', title: 'AI Daily Briefing', titleCN: 'AI每日简报',
    description: 'Morning digest: factor IC changes, market regime shift, top 3 signals. Your quant newspaper.',
    descriptionCN: '每日早报：因子IC变动+市场状态切换+Top3信号。你的量化晨报。',
    icon: <ReadOutlined />, price: 1, priceLabel: '1U/天',
    category: 'market', color: '#d4a853',
  },
  {
    id: 'arbitrage_scan', title: 'AI Arbitrage Scanner', titleCN: 'AI套利扫描',
    description: 'Cross-exchange + cross-market spread scan. Identifies arb opportunities across 10 markets.',
    descriptionCN: '跨交易所+跨市场价差扫描→10市场套利机会自动发现。1U扫一次。',
    icon: <ThunderboltOutlined />, price: 1, priceLabel: '1U/次',
    category: 'strategy', color: '#9b59b6',
  },
  {
    id: 'signal_push', title: 'AI Signal Alert', titleCN: 'AI信号推送',
    description: 'Factor signal change push. When your chosen factors flip 🟢→🔴, get notified instantly.',
    descriptionCN: '因子信号变化推送→你选的因子信号反转🟢→🔴时立即通知。0.5U/天。',
    icon: <BellOutlined />, price: 0.5, priceLabel: '0.5U/天',
    category: 'alert', color: '#FF8C00',
  },
  {
    id: 'stress_test', title: 'AI Stress Test', titleCN: 'AI压力测试',
    description: 'Portfolio stress test: 2008/2020/2022 scenarios. Max drawdown, VaR, tail risk estimates.',
    descriptionCN: '组合压力测试：模拟2008/2020/2022等极端行情→最大回撤+VaR+尾部风险。1U测一次。',
    icon: <AlertOutlined />, price: 1, priceLabel: '1U/次',
    category: 'risk', color: '#d73027',
  },
  {
    id: 'attribution', title: 'AI Performance Attribution', titleCN: 'AI收益归因',
    description: 'Decompose P&L: how much from factors, market beta, sector, luck? Brinson attribution.',
    descriptionCN: '收益拆解：因子贡献?市场贝塔?行业?运气? Brinson归因分析。1U看透收益来源。',
    icon: <PieChartOutlined />, price: 1, priceLabel: '1U/次',
    category: 'risk', color: '#008080',
  },
];

// ── Component: Single Billing Card ──────────────────────────────────
const BillingCard: React.FC<BillingCardProps> = ({
  service, onExecute, onViewResult, balance, disabled, compact,
}) => {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const locale = 'en';
  const t = BI18N[locale] || BI18N.en;

  const isFree = service.price === 0;
  const insufficientBalance = balance !== null && balance !== undefined && balance < service.price;

  const handleExecute = useCallback(async () => {
    if (!onExecute || insufficientBalance) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const result = await onExecute(service.id);
      if (result.success) {
        setState('done');
      } else {
        setState('error');
      }
    } catch (err: any) {
      setState('error');
      setErrorMsg(err?.message || t.failed);
    }
  }, [onExecute, service.id, insufficientBalance, t]);

  if (compact) {
    return (
      <div style={cs.compact} onClick={state === 'idle' ? handleExecute : undefined}>
        <span style={{ ...cs.compactIcon, color: service.color }}>{service.icon}</span>
        <div style={cs.compactInfo}>
          <div style={cs.compactTitle}>{service.title}</div>
          <div style={cs.compactDesc}>{service.descriptionCN.substring(0, 40)}...</div>
        </div>
        <Tag color={isFree ? 'green' : 'gold'} style={cs.compactPrice}>{service.priceLabel}</Tag>
      </div>
    );
  }

  return (
    <div style={{ ...cs.card, borderTop: `3px solid ${service.color}` }}>
      {/* Header */}
      <div style={cs.header}>
        <span style={{ ...cs.icon, color: service.color }}>{service.icon}</span>
        <div style={cs.headerInfo}>
          <div style={cs.title}>{service.title}</div>
          <div style={cs.titleCN}>{service.titleCN}</div>
        </div>
        <Tag color={isFree ? 'green' : 'gold'} style={cs.priceTag}>
          {service.priceLabel}
        </Tag>
      </div>

      {/* Description */}
      <p style={cs.desc}>{service.descriptionCN}</p>

      {/* State: Loading */}
      {state === 'loading' && (
        <div style={cs.stateBox}>
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
          <Tag color="processing" style={{ marginTop: 8 }}>{t.executing}</Tag>
        </div>
      )}

      {/* State: Done */}
      {state === 'done' && (
        <div style={{ ...cs.stateBox, borderColor: '#66bd63' }}>
          <span style={{ color: '#66bd63' }}>✅ {t.done}</span>
          <Button size="small" type="link" onClick={() => onViewResult?.(service.id)}>
            {t.view} →
          </Button>
        </div>
      )}

      {/* State: Error */}
      {state === 'error' && (
        <div style={{ ...cs.stateBox, borderColor: '#d73027' }}>
          <span style={{ color: '#d73027' }}>❌ {errorMsg || t.failed}</span>
          <Button size="small" danger onClick={handleExecute}>{t.retry}</Button>
        </div>
      )}

      {/* CTA */}
      {state === 'idle' && (
        <Button
          type="primary"
          block
          onClick={handleExecute}
          disabled={disabled || insufficientBalance}
          style={{
            ...cs.ctaBtn,
            background: isFree ? '#66bd63' : `linear-gradient(135deg, ${service.color}, ${service.color}dd)`,
            border: 'none',
          }}
        >
          {insufficientBalance ? '💰 余额不足' : `${t.execute} — ${service.priceLabel}`}
        </Button>
      )}
    </div>
  );
};

// ── Component: Billing Card Grid ───────────────────────────────────
const BillingCardGrid: React.FC<{
  services?: AIServiceConfig[];
  onExecute?: (serviceId: AIServiceId) => Promise<{ success: boolean; balanceAfter?: number }>;
  onViewResult?: (serviceId: AIServiceId) => void;
  balance?: number | null;
}> = ({ services = AI_SERVICES, onExecute, onViewResult, balance }) => {
  return (
    <div style={gridStyles.container}>
      <div style={gridStyles.header}>
        <h3 style={gridStyles.title}>🤖 AI-Powered Services</h3>
        <p style={gridStyles.subtitle}>Pay per use. Silent deduction. No subscription.</p>
      </div>
      <div style={gridStyles.grid}>
        {services.map((s) => (
          <BillingCard key={s.id} service={s}
            onExecute={onExecute} onViewResult={onViewResult}
            balance={balance} />
        ))}
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const cs: Record<string, React.CSSProperties> = {
  card: {
    background: '#1a1a2e',
    borderRadius: 10,
    padding: '14px 16px',
    border: '1px solid #2a2a4a',
    fontFamily: "'Inter', -apple-system, sans-serif",
    transition: 'all 0.2s ease',
  },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  icon: { fontSize: 22, flexShrink: 0 },
  headerInfo: { flex: 1 },
  title: { fontSize: 13, fontWeight: 700, color: '#e0e0e0' },
  titleCN: { fontSize: 10, color: '#888' },
  priceTag: { fontSize: 10, fontWeight: 600 },
  desc: { fontSize: 11, color: '#aaa', margin: '0 0 10px', lineHeight: 1.5 },
  stateBox: {
    padding: '10px 12px', background: '#0f0f1e', borderRadius: 8,
    border: '1px solid #2a2a4a', marginBottom: 8,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  ctaBtn: { height: 34, borderRadius: 8, fontWeight: 600, fontSize: 12 },
  // Compact
  compact: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', background: '#0f0f1e', borderRadius: 8,
    border: '1px solid #2a2a4a', cursor: 'pointer',
  },
  compactIcon: { fontSize: 18, flexShrink: 0 },
  compactInfo: { flex: 1 },
  compactTitle: { fontSize: 11, fontWeight: 600, color: '#e0e0e0' },
  compactDesc: { fontSize: 9, color: '#888' },
  compactPrice: { fontSize: 9 },
};

const gridStyles: Record<string, React.CSSProperties> = {
  container: { fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { marginBottom: 14 },
  title: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 },
};

export { BillingCard, BillingCardGrid, AI_SERVICES };
export type { BillingCardProps, AIServiceId, AIServiceConfig };
