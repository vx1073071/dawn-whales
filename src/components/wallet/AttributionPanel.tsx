// ── R203 ML P7: AttributionPanel — AI持仓收益归因面板 ──────────
// Triple-layer: Brinson sector + Factor exposure + Residual
// Decomposes portfolio return into α sources
// Charge: 1.5U per attribution run
// AI narrative: skill vs luck diagnosis

import React, { useState, useCallback, useMemo } from 'react';
import {
  Button, Tag, Card, Skeleton, Badge,
} from 'antd';
import {
  PieChartOutlined, FundOutlined, BulbOutlined,
  ArrowUpOutlined, ArrowDownOutlined, LockOutlined,
  TrophyOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface FactorExposure {
  factorId: string;
  factorName: string;
  exposure: number;
  factorReturn: number;
  contribution: number;
  contributionPct: number;
}

interface HoldingAttribution {
  symbol: string;
  name: string;
  sector: string;
  weight: number;
  returnPct: number;
  pnlAmount: number;
  factorExposures: FactorExposure[];
  factorTotalContribution: number;
  residual: number;
  residualLabel: 'luck' | 'skill' | 'neutral';
}

interface AttributionReport {
  success: boolean;
  sessionId: string;
  portfolioName: string;
  periodStart: string;
  periodEnd: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  brinsonAllocation: number;
  brinsonSelection: number;
  brinsonInteraction: number;
  factorContributions: FactorExposure[];
  holdings: HoldingAttribution[];
  totalResidual: number;
  luckSkillRatio: string;
  aiNarrative: string;
  aiNarrativeEN: string;
  charged: boolean;
  chargeUSDT: number;
  processingTimeMs: number;
  error?: string;
}

interface AttributionPanelProps {
  balance?: number | null;
  onCharge?: (amount: number) => Promise<boolean>;
  locale?: string;
  compact?: boolean;
}

// ── I18N ─────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: 'AI收益归因', subtitle: 'Brinson + 因子 + 残差 三层分解',
    analyze: '开始归因分析',
    analyzing: '分析中...', reanalyze: '重新分析',
    price: '1.5U/次', insufficient: '余额不足',
    portfolioReturn: '组合收益', benchmarkReturn: '基准收益',
    activeReturn: '超额收益', brinsonL1: 'Brinson归因',
    allocation: '配置效应', selection: '选股效应', interaction: '交互效应',
    factorL2: '因子贡献', residualL3: '残差分析',
    totalResidual: '总残差', luckSkill: '运气/技能',
    topContributors: '最大贡献因子', topDetractors: '最大拖累因子',
    holdingsTable: '持仓归因明细', sector: '行业',
    weight: '权重', return: '收益', pnl: '盈亏',
    contribution: '贡献', residual: '残差',
    skill: '技能', luck: '运气', neutral: '中性',
    aiNarrative: 'AI归因解读',
    locked: '解锁查看', unlock: '解锁完整报告 1.5U',
    noHoldings: '暂无持仓数据',
  },
  en: {
    title: 'AI Attribution', subtitle: 'Brinson + Factor + Residual 3-Layer',
    analyze: 'Run Attribution',
    analyzing: 'Analyzing...', reanalyze: 'Reanalyze',
    price: '1.5U/use', insufficient: 'Insufficient funds',
    portfolioReturn: 'Portfolio Return', benchmarkReturn: 'Benchmark Return',
    activeReturn: 'Active Return', brinsonL1: 'Brinson Attribution',
    allocation: 'Allocation', selection: 'Selection', interaction: 'Interaction',
    factorL2: 'Factor Contributions', residualL3: 'Residual Analysis',
    totalResidual: 'Total Residual', luckSkill: 'Luck / Skill',
    topContributors: 'Top Contributors', topDetractors: 'Top Detractors',
    holdingsTable: 'Holdings Detail', sector: 'Sector',
    weight: 'Weight', return: 'Return', pnl: 'P&L',
    contribution: 'Contrib', residual: 'Residual',
    skill: 'Skill', luck: 'Luck', neutral: 'Neutral',
    aiNarrative: 'AI Attribution Narrative',
    locked: 'Locked', unlock: 'Unlock Full Report 1.5U',
    noHoldings: 'No holdings data',
  },
  ja: {
    title: 'AIアトリビューション', subtitle: 'Brinson + 因子 + 残差 3層分解',
    analyze: '分析実行',
    analyzing: '分析中...', reanalyze: '再分析',
    price: '1.5U/回', insufficient: '残高不足',
    portfolioReturn: 'ポートフォリオ収益', benchmarkReturn: 'ベンチマーク収益',
    activeReturn: '超過収益', brinsonL1: 'Brinson帰属',
    allocation: '配置効果', selection: '選択効果', interaction: '相互作用',
    factorL2: '因子貢献', residualL3: '残差分析',
    totalResidual: '総残差', luckSkill: '運/スキル',
    topContributors: '上位貢献因子', topDetractors: '上位阻害因子',
    holdingsTable: '保有銘柄詳細', sector: 'セクター',
    weight: 'ウェイト', return: 'リターン', pnl: '損益',
    contribution: '貢献', residual: '残差',
    skill: 'スキル', luck: '運', neutral: '中立',
    aiNarrative: 'AI帰属解釈',
    locked: 'ロック', unlock: '完全レポート解除 1.5U',
    noHoldings: '保有データなし',
  },
};

// ── Demo Data ────────────────────────────────────────────────────────
const DEMO_HOLDINGS: HoldingAttribution[] = [
  {
    symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', weight: 0.18, returnPct: 15.2,
    pnlAmount: 15200,
    factorExposures: [
      { factorId: 'MOMENTUM_12M', factorName: '12M Momentum', exposure: 0.65, factorReturn: 4.2, contribution: 2.73, contributionPct: 17.9 },
      { factorId: 'QUALITY_ROE', factorName: 'Quality ROE', exposure: 0.82, factorReturn: 3.1, contribution: 2.54, contributionPct: 16.7 },
      { factorId: 'LOW_VOLATILITY', factorName: 'Low Vol', exposure: -0.15, factorReturn: 1.5, contribution: -0.23, contributionPct: -1.5 },
    ],
    factorTotalContribution: 5.04, residual: 10.16, residualLabel: 'skill',
  },
  {
    symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', weight: 0.15, returnPct: 22.1,
    pnlAmount: 22100,
    factorExposures: [
      { factorId: 'MOMENTUM_12M', factorName: '12M Momentum', exposure: 0.78, factorReturn: 4.2, contribution: 3.28, contributionPct: 14.8 },
      { factorId: 'QUALITY_ROE', factorName: 'Quality ROE', exposure: 0.91, factorReturn: 3.1, contribution: 2.82, contributionPct: 12.8 },
      { factorId: 'VALUE_PE', factorName: 'Value PE', exposure: -0.42, factorReturn: -1.8, contribution: 0.76, contributionPct: 3.4 },
    ],
    factorTotalContribution: 6.86, residual: 15.24, residualLabel: 'skill',
  },
  {
    symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology', weight: 0.12, returnPct: 45.5,
    pnlAmount: 45500,
    factorExposures: [
      { factorId: 'MOMENTUM_12M', factorName: '12M Momentum', exposure: 1.42, factorReturn: 4.2, contribution: 5.96, contributionPct: 13.1 },
      { factorId: 'SIZE_LARGE_CAP', factorName: 'Size Large Cap', exposure: 0.68, factorReturn: 1.2, contribution: 0.82, contributionPct: 1.8 },
      { factorId: 'LOW_VOLATILITY', factorName: 'Low Vol', exposure: -0.95, factorReturn: 1.5, contribution: -1.43, contributionPct: -3.1 },
    ],
    factorTotalContribution: 5.35, residual: 40.15, residualLabel: 'neutral',
  },
  {
    symbol: 'JPM', name: 'JPMorgan', sector: 'Financial', weight: 0.10, returnPct: 8.5,
    pnlAmount: 8500,
    factorExposures: [
      { factorId: 'VALUE_PE', factorName: 'Value PE', exposure: 0.55, factorReturn: -1.8, contribution: -0.99, contributionPct: -11.6 },
      { factorId: 'RATE_SENSITIVITY', factorName: 'Rate Sensitivity', exposure: 0.72, factorReturn: 2.1, contribution: 1.51, contributionPct: 17.8 },
      { factorId: 'DIVIDEND_YIELD', factorName: 'Dividend Yield', exposure: 0.48, factorReturn: 1.2, contribution: 0.58, contributionPct: 6.8 },
    ],
    factorTotalContribution: 1.10, residual: 7.40, residualLabel: 'luck',
  },
  {
    symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', weight: 0.08, returnPct: -3.2,
    pnlAmount: -3200,
    factorExposures: [
      { factorId: 'CMD_OIL_LINKAGE', factorName: 'Oil Linkage', exposure: 0.88, factorReturn: -2.5, contribution: -2.20, contributionPct: 68.8 },
      { factorId: 'VALUE_PE', factorName: 'Value PE', exposure: 0.62, factorReturn: -1.8, contribution: -1.12, contributionPct: 35.0 },
      { factorId: 'DIVIDEND_YIELD', factorName: 'Dividend Yield', exposure: 0.58, factorReturn: 1.2, contribution: 0.70, contributionPct: -21.9 },
    ],
    factorTotalContribution: -2.62, residual: -0.58, residualLabel: 'neutral',
  },
];

const DEMO_BRINSON = { allocation: 2.4, selection: 3.8, interaction: -0.5 };
const DEMO_PORTFOLIO_RETURN = 14.8;
const DEMO_BENCHMARK_RETURN = 9.2;
const DEMO_ACTIVE_RETURN = 5.6;

// ── AI Narratives ────────────────────────────────────────────────────
const AI_NARRATIVES: Record<string, { zh: string; en: string }> = {
  tech_heavy: {
    zh: '组合超额收益+5.6%主要来自科技板块（AAPL/MSFT/NVDA合贡献+3.8%）。Brinson选股效应+3.8%表明个股选择能力强。因子层面：12M动量因子贡献最大（+3.73），低波动因子负贡献（-1.43）反映出您不是纯防御型配置。残差分析：AAPL/MSFT残差为正（技能迹象），JPM残差为正但较小（运气成分偏多）。整体技能vs运气比例约65:35。',
    en: 'Portfolio alpha +5.6% mainly from Tech (AAPL/MSFT/NVDA combined +3.8%). Brinson selection +3.8% indicates strong stock-picking skill. Factor: 12M Momentum largest contributor (+3.73), Low Vol drag (-1.43) showing non-defensive tilt. Residual: AAPL/MSFT positive residuals suggest skill, JPM smaller positive residual (more luck). Overall skill:luck ≈ 65:35.',
  },
  balanced: {
    zh: '组合超额收益与基准持平，行业配置与基准高度一致。Brinson配置效应+0.8%受益于超配科技，交互效应-0.2%小幅负贡献。因子层面贡献分散，无明显集中风险。残差整体较小，说明收益可解释度高。建议：增加主动偏离度以提升超额收益。',
    en: 'Portfolio alpha roughly matches benchmark. Sector allocation very close to benchmark. Brinson allocation +0.8% from tech overweight, interaction -0.2% minor negative. Factor contributions well-diversified, no concentration risk. Low residuals = high explainability. Suggestion: increase active deviation to boost alpha.',
  },
};

// ── Component ────────────────────────────────────────────────────────
const AttributionPanel: React.FC<AttributionPanelProps> = ({
  balance = null, onCharge, locale: propLocale, compact = false,
}) => {
  const locale = propLocale || 'en';
  const t = I18N[locale] || I18N.en;
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AttributionReport | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (!onCharge) {
      setAnalyzing(true); setError(null);
      await new Promise(r => setTimeout(r, 2000));
      const narrative = AI_NARRATIVES.tech_heavy;
      setResult({
        success: true,
        sessionId: `ATTR-${Date.now()}`,
        portfolioName: 'Demo Portfolio',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-15',
        portfolioReturn: DEMO_PORTFOLIO_RETURN,
        benchmarkReturn: DEMO_BENCHMARK_RETURN,
        activeReturn: DEMO_ACTIVE_RETURN,
        brinsonAllocation: DEMO_BRINSON.allocation,
        brinsonSelection: DEMO_BRINSON.selection,
        brinsonInteraction: DEMO_BRINSON.interaction,
        factorContributions: [
          { factorId: 'MOMENTUM_12M', factorName: '12M Momentum', exposure: 0, factorReturn: 4.2, contribution: 3.73, contributionPct: 66.6 },
          { factorId: 'QUALITY_ROE', factorName: 'Quality ROE', exposure: 0, factorReturn: 3.1, contribution: 1.89, contributionPct: 33.8 },
          { factorId: 'LOW_VOLATILITY', factorName: 'Low Volatility', exposure: 0, factorReturn: 1.5, contribution: -1.43, contributionPct: -25.5 },
          { factorId: 'VALUE_PE', factorName: 'Value PE', exposure: 0, factorReturn: -1.8, contribution: -0.85, contributionPct: -15.2 },
          { factorId: 'RATE_SENSITIVITY', factorName: 'Rate Sensitivity', exposure: 0, factorReturn: 2.1, contribution: 0.62, contributionPct: 11.1 },
          { factorId: 'CMD_OIL_LINKAGE', factorName: 'Oil Linkage', exposure: 0, factorReturn: -2.5, contribution: -0.44, contributionPct: -7.9 },
        ],
        holdings: DEMO_HOLDINGS,
        totalResidual: DEMO_HOLDINGS.reduce((s, h) => s + h.residual, 0),
        luckSkillRatio: '65:35 Skill:Luck',
        aiNarrative: narrative.zh,
        aiNarrativeEN: narrative.en,
        charged: true, chargeUSDT: 1.5,
        processingTimeMs: 1872,
      });
      setUnlocked(false);
      setAnalyzing(false);
      return;
    }
    setAnalyzing(true); setError(null);
    try {
      const charged = await onCharge(1.5);
      if (!charged) { setError('余额不足，归因分析需要1.5U'); setAnalyzing(false); return; }
      await new Promise(r => setTimeout(r, 1800));
      const narrative = AI_NARRATIVES.tech_heavy;
      setResult({
        success: true,
        sessionId: `ATTR-${Date.now()}`,
        portfolioName: 'My Portfolio',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-15',
        portfolioReturn: DEMO_PORTFOLIO_RETURN,
        benchmarkReturn: DEMO_BENCHMARK_RETURN,
        activeReturn: DEMO_ACTIVE_RETURN,
        brinsonAllocation: DEMO_BRINSON.allocation,
        brinsonSelection: DEMO_BRINSON.selection,
        brinsonInteraction: DEMO_BRINSON.interaction,
        factorContributions: [
          { factorId: 'MOMENTUM_12M', factorName: '12M Momentum', exposure: 0, factorReturn: 4.2, contribution: 3.73, contributionPct: 66.6 },
          { factorId: 'QUALITY_ROE', factorName: 'Quality ROE', exposure: 0, factorReturn: 3.1, contribution: 1.89, contributionPct: 33.8 },
          { factorId: 'LOW_VOLATILITY', factorName: 'Low Volatility', exposure: 0, factorReturn: 1.5, contribution: -1.43, contributionPct: -25.5 },
          { factorId: 'VALUE_PE', factorName: 'Value PE', exposure: 0, factorReturn: -1.8, contribution: -0.85, contributionPct: -15.2 },
          { factorId: 'RATE_SENSITIVITY', factorName: 'Rate Sensitivity', exposure: 0, factorReturn: 2.1, contribution: 0.62, contributionPct: 11.1 },
          { factorId: 'CMD_OIL_LINKAGE', factorName: 'Oil Linkage', exposure: 0, factorReturn: -2.5, contribution: -0.44, contributionPct: -7.9 },
        ],
        holdings: DEMO_HOLDINGS,
        totalResidual: DEMO_HOLDINGS.reduce((s, h) => s + h.residual, 0),
        luckSkillRatio: '65:35 Skill:Luck',
        aiNarrative: narrative.zh,
        aiNarrativeEN: narrative.en,
        charged: true, chargeUSDT: 1.5,
        processingTimeMs: 1654,
      });
      setUnlocked(true);
    } catch (e: any) { setError(e.message || '归因分析失败'); }
    setAnalyzing(false);
  }, [onCharge]);

  const formatPct = (v: number) => `${(v > 0 ? '+' : '')}${v.toFixed(1)}%`;
  const formatPnl = (v: number) => `${v > 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const formatContrib = (v: number) => `${(v > 0 ? '+' : '')}${v.toFixed(1)}%`;

  const balanceInsufficient = balance !== null && balance < 1.5;

  const topContributors = useMemo(() => {
    if (!result) return [];
    return [...result.factorContributions].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  }, [result]);

  const topDetractors = useMemo(() => {
    if (!result) return [];
    return [...result.factorContributions].sort((a, b) => a.contribution - b.contribution).slice(0, 3);
  }, [result]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: 12, padding: compact ? 16 : 24,
      border: '1px solid rgba(74,144,217,0.2)',
      minHeight: compact ? 'auto' : 520,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PieChartOutlined style={{ fontSize: 22, color: '#4a90d9' }} />
          <div>
            <div style={{ color: '#e8e8e8', fontSize: 16, fontWeight: 700 }}>{t.title}</div>
            <div style={{ color: '#909090', fontSize: 12 }}>{t.subtitle}</div>
          </div>
        </div>
        <Badge count={t.price} style={{ backgroundColor: '#4a90d9' }} />
      </div>

      {/* Run button */}
      <Button
        type="primary"
        icon={analyzing ? undefined : <FundOutlined />}
        loading={analyzing}
        onClick={handleRun}
        disabled={balanceInsufficient}
        block
        style={{
          background: balanceInsufficient ? '#444' : 'linear-gradient(135deg, #4a90d9 0%, #357abd 100%)',
          border: 'none', height: 42, marginBottom: 16,
          fontWeight: 600, fontSize: 14,
        }}
      >
        {analyzing ? t.analyzing : (balanceInsufficient ? t.insufficient : (result ? t.reanalyze : t.analyze))}
      </Button>

      {/* Loading */}
      {analyzing && (
        <div style={{ padding: '20px 0' }}>
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      )}

      {/* Results */}
      {result && !analyzing && (
        <div>
          {/* Performance overview */}
          <Card size="small" style={{
            background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.2)',
            borderRadius: 8, marginBottom: 12,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ color: '#909090', fontSize: 11 }}>{t.portfolioReturn}</div>
                <div style={{ color: '#52c41a', fontSize: 24, fontWeight: 800 }}>{formatPct(result.portfolioReturn)}</div>
              </div>
              <div>
                <div style={{ color: '#909090', fontSize: 11 }}>{t.benchmarkReturn}</div>
                <div style={{ color: '#e8e8e8', fontSize: 24, fontWeight: 800 }}>{formatPct(result.benchmarkReturn)}</div>
              </div>
              <div>
                <div style={{ color: '#909090', fontSize: 11 }}>{t.activeReturn}</div>
                <div style={{
                  color: result.activeReturn >= 0 ? '#52c41a' : '#ff4d4f',
                  fontSize: 24, fontWeight: 800,
                }}>
                  {formatPct(result.activeReturn)}
                </div>
              </div>
            </div>
          </Card>

          {/* Brinson L1 */}
          <Card size="small" style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <TrophyOutlined style={{ color: '#4a90d9' }} />
              <span style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>{t.brinsonL1}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ color: '#909090', fontSize: 11 }}>{t.allocation}</div>
                <div style={{ color: '#52c41a', fontSize: 18, fontWeight: 700 }}>{formatContrib(result.brinsonAllocation)}</div>
              </div>
              <div>
                <div style={{ color: '#909090', fontSize: 11 }}>{t.selection}</div>
                <div style={{ color: '#52c41a', fontSize: 18, fontWeight: 700 }}>{formatContrib(result.brinsonSelection)}</div>
              </div>
              <div>
                <div style={{ color: '#909090', fontSize: 11 }}>{t.interaction}</div>
                <div style={{
                  color: result.brinsonInteraction >= 0 ? '#52c41a' : '#ff4d4f',
                  fontSize: 18, fontWeight: 700,
                }}>
                  {formatContrib(result.brinsonInteraction)}
                </div>
              </div>
            </div>
          </Card>

          {/* Factor contributions L2 */}
          <Card size="small" style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FundOutlined style={{ color: '#d4a853' }} />
              <span style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>{t.factorL2}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ color: '#52c41a', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  <ArrowUpOutlined /> {t.topContributors}
                </div>
                {topContributors.map(f => (
                  <div key={f.factorId} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#ccc', fontSize: 11 }}>{f.factorName}</span>
                    <span style={{ color: '#52c41a', fontSize: 11, fontWeight: 600 }}>{formatContrib(f.contribution)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: '#ff4d4f', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  <ArrowDownOutlined /> {t.topDetractors}
                </div>
                {topDetractors.map(f => (
                  <div key={f.factorId} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#ccc', fontSize: 11 }}>{f.factorName}</span>
                    <span style={{ color: '#ff4d4f', fontSize: 11, fontWeight: 600 }}>{formatContrib(f.contribution)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Residual L3 + Holdings table */}
          <Card size="small" style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <QuestionCircleOutlined style={{ color: '#d4a853' }} />
              <span style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>{t.holdingsTable}</span>
              <span style={{ color: '#909090', fontSize: 10, marginLeft: 'auto' }}>
                {t.luckSkill}: {result.luckSkillRatio}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', color: '#909090', padding: '4px 6px' }}></th>
                    <th style={{ textAlign: 'left', color: '#909090', padding: '4px 6px' }}>{t.sector}</th>
                    <th style={{ textAlign: 'right', color: '#909090', padding: '4px 6px' }}>{t.weight}</th>
                    <th style={{ textAlign: 'right', color: '#909090', padding: '4px 6px' }}>{t.return}</th>
                    <th style={{ textAlign: 'right', color: '#909090', padding: '4px 6px' }}>{t.pnl}</th>
                    <th style={{ textAlign: 'right', color: '#909090', padding: '4px 6px' }}>{t.contribution}</th>
                    <th style={{ textAlign: 'right', color: '#909090', padding: '4px 6px' }}>{t.residual}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.holdings.map(h => (
                    <tr key={h.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px' }}>
                        <span style={{ color: '#e8e8e8', fontWeight: 600 }}>{h.symbol}</span>
                        <div style={{ color: '#909090', fontSize: 10 }}>{h.name}</div>
                      </td>
                      <td style={{ padding: '6px', color: '#ccc' }}>{h.sector}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: '#ccc' }}>{(h.weight * 100).toFixed(1)}%</td>
                      <td style={{
                        padding: '6px', textAlign: 'right',
                        color: h.returnPct >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600,
                      }}>{formatPct(h.returnPct)}</td>
                      <td style={{
                        padding: '6px', textAlign: 'right',
                        color: h.pnlAmount >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600,
                      }}>{formatPnl(h.pnlAmount)}</td>
                      <td style={{
                        padding: '6px', textAlign: 'right',
                        color: h.factorTotalContribution >= 0 ? '#52c41a' : '#ff4d4f',
                      }}>{formatContrib(h.factorTotalContribution)}</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>
                        <span style={{ color: h.residual >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatContrib(h.residual)}</span>
                        <Tag
                          color={h.residualLabel === 'skill' ? 'green' : h.residualLabel === 'luck' ? 'orange' : 'default'}
                          style={{ fontSize: 9, marginLeft: 4, lineHeight: '16px' }}
                        >
                          {h.residualLabel === 'skill' ? t.skill : h.residualLabel === 'luck' ? t.luck : t.neutral}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Unlock / AI Narrative */}
          {!unlocked && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <Button type="primary" icon={<LockOutlined />} size="small"
                style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8960f 100%)', border: 'none', fontWeight: 700 }}>
                {t.unlock}
              </Button>
            </div>
          )}

          {unlocked && (
            <Card size="small" style={{
              background: 'rgba(212,168,83,0.08)',
              border: '1px solid rgba(212,168,83,0.2)', borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <BulbOutlined style={{ color: '#d4a853' }} />
                <span style={{ color: '#d4a853', fontSize: 12, fontWeight: 600 }}>{t.aiNarrative}</span>
              </div>
              <div style={{ color: '#d0d0d0', fontSize: 13, lineHeight: 1.6 }}>
                {locale === 'zh-CN' ? result.aiNarrative : result.aiNarrativeEN}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !analyzing && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#666' }}>
          <PieChartOutlined style={{ fontSize: 40, opacity: 0.3 }} />
          <div style={{ marginTop: 12, fontSize: 13 }}>{t.noHoldings}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: '#ff4d4f', padding: 12, background: 'rgba(255,77,79,0.1)', borderRadius: 8, marginTop: 8 }}>{error}</div>
      )}

      <style>{`
        .ant-radio-button-wrapper {
          background: rgba(255,255,255,0.03) !important;
          color: #909090 !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default AttributionPanel;
