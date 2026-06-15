// ── R229 ML-3.2u: CreatorTrustBadges — 创作者信任体系UI ──────────
// 4 trust elements on every strategy template:
//   1. Audit Badge (L1/L2/L3 tier + verified stamps)
//   2. Real Data (live metrics + equity curve + drawdown)
//   3. Transparent Pricing (creator/platform split + no hidden fees)
//   4. Security Notice (fund safety + data privacy + API key safety)
// 11-language i18n

import React from 'react';

// ── Types ───────────────────────────────────────────────────────────
export type CreatorLevel = 'L1' | 'L2' | 'L3';
export type TrustBadge = 'verified' | 'audited' | 'editor-pick' | 'consistent' | 'low-dd';

export interface CreatorTrustData {
  creatorId: string;
  creatorName: string;
  level: CreatorLevel;
  badges: TrustBadge[];
  metrics: {
    totalVolume: number;     // USDT
    activeUsers: number;
    avgWinRate: number;      // 0-1
    avgSharpe: number;
    maxDrawdown: number;     // 0-1
    totalStrategies: number;
    avgHoldingDays: number;
    dataUpdatedAt: string;
  };
  pricing: {
    creatorShare: number;    // percentage
    platformShare: number;   // percentage
    strategyPrice: number;   // USDT
    signalPrice: number;     // USDT
  };
  securityDeclared: boolean;
}

export interface CreatorTrustBadgesProps {
  trust: CreatorTrustData;
  locale?: string;
  compact?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    trustTitle: '🔒 创作者信任信息',
    level: '创作者等级',
    badges: '认证徽章',
    verified: '已认证', audited: '已审计', editorPick: '编辑精选',
    consistent: '稳定表现', lowDD: '低回撤',
    l1: '新手创作者', l2: '进阶创作者', l3: '旗舰创作者',
    realData: '📊 真实数据',
    totalVolume: '总交易量', activeUsers: '活跃用户',
    avgWinRate: '平均胜率', avgSharpe: '平均夏普',
    maxDrawdown: '最大回撤', totalStrategies: '策略数',
    avgHoldingDays: '平均持有天数', updatedAt: '数据更新',
    pricing: '💰 透明定价',
    creatorShare: '创作者分成', platformShare: '平台费用',
    strategyPrice: '策略价格', signalPrice: '信号订阅',
    noHidden: '无隐藏收费',
    security: '🔐 安全声明',
    fundSafety: '资金安全：您始终掌控自己的交易账户',
    dataPrivacy: '数据隐私：个人信息不会与创作者共享',
    apiKeySafety: 'API密钥：仅存储在本机，不上传任何服务器',
    strategySafety: '策略安全：所有策略经过AI审核和7天回测',
    guarantee: '30天不满意退款保证',
    usdt: 'USDT', days: '天', strategies: '个',
  },
  en: {
    trustTitle: '🔒 Creator Trust Info',
    level: 'Creator Level', badges: 'Verified Badges',
    verified: 'Verified', audited: 'Audited', editorPick: "Editor's Pick",
    consistent: 'Consistent', lowDD: 'Low Drawdown',
    l1: 'Beginner', l2: 'Advanced', l3: 'Flagship',
    realData: '📊 Real Data',
    totalVolume: 'Total Volume', activeUsers: 'Active Users',
    avgWinRate: 'Avg Win Rate', avgSharpe: 'Avg Sharpe',
    maxDrawdown: 'Max Drawdown', totalStrategies: 'Strategies',
    avgHoldingDays: 'Avg Hold Days', updatedAt: 'Updated',
    pricing: '💰 Transparent Pricing',
    creatorShare: 'Creator Share', platformShare: 'Platform Fee',
    strategyPrice: 'Strategy Price', signalPrice: 'Signal Price',
    noHidden: 'No hidden fees',
    security: '🔐 Security',
    fundSafety: 'Fund safety: You always control your trading account',
    dataPrivacy: 'Data privacy: Your info is never shared with creators',
    apiKeySafety: 'API key: Stored locally only, never uploaded',
    strategySafety: 'Strategy safety: All strategies are AI-audited',
    guarantee: '30-day money-back guarantee',
    usdt: 'USDT', days: 'days', strategies: 'strategies',
  },
  ja: {
    trustTitle: '🔒 クリエイター信頼情報',
    level: 'クリエイターレベル', badges: '認証バッジ',
    verified: '認証済', audited: '監査済', editorPick: '編集者推薦',
    consistent: '安定', lowDD: '低DD',
    l1: '初心者', l2: '上級者', l3: 'フラッグシップ',
    realData: '📊 実データ', totalVolume: '総取引量', activeUsers: 'アクティブユーザー',
    avgWinRate: '平均勝率', avgSharpe: '平均シャープ',
    maxDrawdown: '最大DD', totalStrategies: '戦略数',
    avgHoldingDays: '平均保有日数', updatedAt: '更新日',
    pricing: '💰 透明な価格設定', creatorShare: 'クリエイター分', platformShare: 'プラットフォーム手数料',
    strategyPrice: '戦略価格', signalPrice: 'シグナル価格',
    noHidden: '隠れた手数料なし',
    security: '🔐 セキュリティ', fundSafety: '資金安全：常に取引口座を管理',
    dataPrivacy: 'データプライバシー：情報は共有されません',
    apiKeySafety: 'APIキー：端末のみ保存、アップロードなし',
    strategySafety: '戦略安全：AI監査済み', guarantee: '30日返金保証',
    usdt: 'USDT', days: '日', strategies: '戦略',
  },
};

// ── Level colors ────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<CreatorLevel, { color: string; bg: string; border: string; icon: string }> = {
  L1: { color: '#f0883e', bg: 'rgba(240,136,62,0.1)', border: 'rgba(240,136,62,0.2)', icon: '🥉' },
  L2: { color: '#8b949e', bg: 'rgba(139,148,158,0.12)', border: 'rgba(139,148,158,0.2)', icon: '🥈' },
  L3: { color: '#d29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.2)', icon: '🥇' },
};

const BADGE_CONFIG: Record<TrustBadge, { icon: string; color: string; bg: string }> = {
  verified: { icon: '✓', color: '#3fb950', bg: 'rgba(34,197,94,0.1)' },
  audited: { icon: '🔍', color: '#58a6ff', bg: 'rgba(59,130,246,0.1)' },
  'editor-pick': { icon: '⭐', color: '#d29922', bg: 'rgba(210,153,34,0.1)' },
  consistent: { icon: '📈', color: '#a371f7', bg: 'rgba(163,113,247,0.1)' },
  'low-dd': { icon: '🛡️', color: '#3fb950', bg: 'rgba(34,197,94,0.1)' },
};

// ── Component ───────────────────────────────────────────────────────
const CreatorTrustBadges: React.FC<CreatorTrustBadgesProps> = ({ trust, locale: pl, compact }) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;
  const lvl = LEVEL_CONFIG[trust.level];

  return (
    <div style={{
      background: '#0d1117', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{t.trustTitle}</span>
        {/* Creator Level */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 8,
          background: lvl.bg, border: `1px solid ${lvl.border}`,
        }}>
          <span style={{ fontSize: 14 }}>{lvl.icon}</span>
          <span style={{ color: lvl.color, fontWeight: 700, fontSize: 11 }}>{t[`l${trust.level.slice(1)}`]}</span>
        </div>
      </div>

      <div style={{ padding: compact ? '10px 14px' : '14px 18px' }}>

        {/* Element 1: Audit Badges */}
        <div style={{ marginBottom: compact ? 10 : 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>
            🏅 {t.badges}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {trust.badges.map(badge => {
              const cfg = BADGE_CONFIG[badge];
              return (
                <span key={badge} style={{
                  padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: cfg.bg, border: `1px solid ${cfg.color}22`, color: cfg.color,
                }}>
                  {cfg.icon} {t[badge]}
                </span>
              );
            })}
          </div>
          {trust.badges.length === 0 && (
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>—</span>
          )}
        </div>

        {/* Element 2: Real Data */}
        <div style={{ marginBottom: compact ? 10 : 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>
            {t.realData}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
            gap: 6,
          }}>
            <MetricBox label={t.totalVolume} value={`${(trust.metrics.totalVolume / 1000).toFixed(1)}k ${t.usdt}`} color="#58a6ff" />
            <MetricBox label={t.activeUsers} value={String(trust.metrics.activeUsers)} color="#a371f7" />
            <MetricBox label={t.avgWinRate} value={`${(trust.metrics.avgWinRate * 100).toFixed(1)}%`} color="#3fb950" />
            <MetricBox label={t.avgSharpe} value={trust.metrics.avgSharpe.toFixed(2)} color="#d29922" />
            <MetricBox label={t.maxDrawdown} value={`${(trust.metrics.maxDrawdown * 100).toFixed(1)}%`} color="#f85149" />
            <MetricBox label={t.totalStrategies} value={`${trust.metrics.totalStrategies} ${t.strategies}`} color="#f0883e" />
            <MetricBox label={t.avgHoldingDays} value={`${trust.metrics.avgHoldingDays} ${t.days}`} color="#06b6d4" />
            <MetricBox label={t.updatedAt} value={trust.metrics.dataUpdatedAt} color="rgba(255,255,255,0.3)" />
          </div>
        </div>

        {/* Element 3: Transparent Pricing */}
        <div style={{ marginBottom: compact ? 10 : 14 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>
            {t.pricing}
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          }}>
            {/* Split bar */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                <span>👤 {t.creatorShare}: {trust.pricing.creatorShare}%</span>
                <span>🏢 {t.platformShare}: {trust.pricing.platformShare}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ width: `${trust.pricing.creatorShare}%`, background: '#3b82f6' }} />
                <div style={{ width: `${trust.pricing.platformShare}%`, background: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            {/* Prices */}
            <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t.strategyPrice}: <b style={{ color: '#58a6ff' }}>{trust.pricing.strategyPrice} {t.usdt}</b></span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t.signalPrice}: <b style={{ color: '#58a6ff' }}>{trust.pricing.signalPrice} {t.usdt}</b></span>
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(34,197,94,0.6)', textAlign: 'center' }}>
              ✓ {t.noHidden}
            </div>
          </div>
        </div>

        {/* Element 4: Security */}
        <div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>
            {t.security}
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)',
            display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10,
          }}>
            <SecurityRow icon="🔒" text={t.fundSafety} />
            <SecurityRow icon="🔐" text={t.dataPrivacy} />
            <SecurityRow icon="🗝️" text={t.apiKeySafety} />
            <SecurityRow icon="🤖" text={t.strategySafety} />
            {trust.securityDeclared && (
              <SecurityRow icon="✅" text={t.guarantee} color="#3fb950" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────
const MetricBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '6px 10px', borderRadius: 8, textAlign: 'center',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{label}</div>
  </div>
);

const SecurityRow: React.FC<{ icon: string; text: string; color?: string }> = ({ icon, text, color = 'rgba(255,255,255,0.5)' }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
    <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
    <span style={{ color, lineHeight: 1.4 }}>{text}</span>
  </div>
);

export default CreatorTrustBadges;
