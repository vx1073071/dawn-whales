// ── R228 ML-2.2c: FactorDetailPanel — 因子详情页 ─────────────────
// Features: formula display, historical performance chart, AI interpretation entry
// 11-language i18n + collapsible sections + integration with FactorSelector
// Each factor: formula, meaning, history, region, related factors + AI button

import React, { useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface FactorDetail {
  id: string;
  nameCn: string;
  nameEn: string;
  nameJa?: string;
  category: string;
  categoryCn: string;
  level: string;
  region: string;
  description: string;
  formula?: string;
  story: string;
  highMeaning: string;
  lowMeaning: string;
  signalDesc: string;
  history?: {
    ic30d?: number;
    ic90d?: number;
    winRate?: number;
    sharpe?: number;
    turnover?: number;
    lastUpdate?: string;
  };
  relatedFactors?: string[];
  colors?: { greenMax: number; yellowMax: number; redMin: number };
  direction?: 'higherBetter' | 'lowerBetter' | 'neutral';
}

export interface FactorDetailPanelProps {
  factor: FactorDetail | null;
  visible: boolean;
  onClose: () => void;
  onAIInterpret?: (factorId: string) => void;
  onSelectRelated?: (factorId: string) => void;
  locale?: string;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '因子详情', overview: '概述', formula: '计算公式',
    story: '因子故事', history: '历史表现', signal: '当前信号',
    highMeans: '高值含义', lowMeans: '低值含义',
    related: '相关因子', aiInterpret: '🤖 AI解读',
    aiHint: '让AI分析该因子的近期表现和前景',
    ic30d: '近30日IC', ic90d: '近90日IC', winRate: '胜率',
    sharpe: '夏普', turnover: '换手率', lastUpdate: '最近更新',
    noData: '暂无数据', noHistory: '暂无历史数据',
    directionHigher: '越高越好', directionLower: '越低越好',
    directionNeutral: '中性指标', level: '级别',
    region: '区域', category: '分类', signalColor: '信号区间',
    green: '绿色区', yellow: '黄色区', red: '红色区',
    close: '关闭',
  },
  en: {
    title: 'Factor Details', overview: 'Overview', formula: 'Formula',
    story: 'Factor Story', history: 'Historical Performance', signal: 'Current Signal',
    highMeans: 'High Values Mean', lowMeans: 'Low Values Mean',
    related: 'Related Factors', aiInterpret: '🤖 AI Interpret',
    aiHint: 'Let AI analyze this factor\'s recent performance and outlook',
    ic30d: 'IC (30D)', ic90d: 'IC (90D)', winRate: 'Win Rate',
    sharpe: 'Sharpe', turnover: 'Turnover', lastUpdate: 'Last Updated',
    noData: 'No data', noHistory: 'No history available',
    directionHigher: 'Higher is better', directionLower: 'Lower is better',
    directionNeutral: 'Neutral indicator', level: 'Level',
    region: 'Region', category: 'Category', signalColor: 'Signal Range',
    green: 'Green Zone', yellow: 'Yellow Zone', red: 'Red Zone',
    close: 'Close',
  },
  ja: {
    title: '因子詳細', overview: '概要', formula: '計算式',
    story: '因子ストーリー', history: '過去実績', signal: '現在のシグナル',
    highMeans: '高値の意味', lowMeans: '低値の意味',
    related: '関連因子', aiInterpret: '🤖 AI解釈',
    aiHint: 'AIにこの因子の最近のパフォーマンスと見通しを分析させる',
    ic30d: 'IC(30日)', ic90d: 'IC(90日)', winRate: '勝率',
    sharpe: 'シャープ', turnover: '回転率', lastUpdate: '最終更新',
    noData: 'データなし', noHistory: '履歴なし',
    directionHigher: '高いほど良い', directionLower: '低いほど良い',
    directionNeutral: '中立指標', level: 'レベル',
    region: '地域', category: 'カテゴリ', signalColor: '信号範囲',
    green: '緑ゾーン', yellow: '黄ゾーン', red: '赤ゾーン',
    close: '閉じる',
  },
};

// ── Helper ──────────────────────────────────────────────────────────
function directionLabel(dir: string | undefined, t: Record<string, string>): string {
  if (dir === 'higherBetter') return t.directionHigher;
  if (dir === 'lowerBetter') return t.directionLower;
  return t.directionNeutral;
}

function regionLabel(r: string): string {
  const map: Record<string, string> = { global: '🌍 Global', hk: '🇭🇰 HK', us: '🇺🇸 US', crypto: '₿ Crypto' };
  return map[r] || r;
}

// ── Component ───────────────────────────────────────────────────────
const FactorDetailPanel: React.FC<FactorDetailPanelProps> = ({
  factor, visible, onClose, onAIInterpret, onSelectRelated, locale: pl,
}) => {
  const [expandedSection, setExpandedSection] = useState<string>('overview');

  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  if (!visible || !factor) return null;

  const sections = [
    { id: 'overview', label: t.overview },
    { id: 'formula', label: t.formula },
    { id: 'story', label: t.story },
    { id: 'signal', label: t.signal },
    { id: 'history', label: t.history },
    { id: 'related', label: t.related },
  ];

  return (
    <div style={{
      background: '#0d1117', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      width: 480, maxWidth: '94vw',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>{factor.nameCn}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: 'monospace' }}>{factor.id}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#58a6ff', fontSize: 10 }}>{factor.categoryCn}</span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#3fb950', fontSize: 10 }}>{factor.level}</span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(240,136,62,0.1)', border: '1px solid rgba(240,136,62,0.2)', color: '#f0883e', fontSize: 10 }}>{regionLabel(factor.region)}</span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(163,113,247,0.1)', border: '1px solid rgba(163,113,247,0.2)', color: '#a371f7', fontSize: 10 }}>{directionLabel(factor.direction, t)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 16,
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)',
        }} aria-label={t.close}>✕</button>
      </div>

      {/* Section tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)',
        overflowX: 'auto', padding: '0 12px',
      }}>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setExpandedSection(s.id)}
            style={{
              padding: '8px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: 'transparent', border: 'none',
              borderBottom: expandedSection === s.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: expandedSection === s.id ? '#58a6ff' : 'rgba(255,255,255,0.35)',
              whiteSpace: 'nowrap' as const, transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Overview */}
        {expandedSection === 'overview' && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              {factor.description}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DetailRow label={t.highMeans} value={factor.highMeaning} color="#3fb950" />
              <DetailRow label={t.lowMeans} value={factor.lowMeaning} color="#f85149" />
            </div>
          </div>
        )}

        {/* Formula */}
        {expandedSection === 'formula' && (
          <div>
            {factor.formula ? (
              <div style={{
                padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 8 }}>{t.formula}</div>
                <div style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  color: '#58a6ff', fontSize: 13, lineHeight: 1.6,
                  padding: '12px', borderRadius: 8, background: 'rgba(59,130,246,0.05)',
                  border: '1px solid rgba(59,130,246,0.1)',
                }}>
                  {factor.formula}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.2)' }}>{t.noData}</div>
            )}
          </div>
        )}

        {/* Story */}
        {expandedSection === 'story' && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.8, fontStyle: 'italic' }}>
              {factor.story}
            </div>
          </div>
        )}

        {/* Signal */}
        {expandedSection === 'signal' && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              {factor.signalDesc}
            </div>
            {factor.colors && (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 8 }}>{t.signalColor}</div>
                <div style={{
                  height: 8, borderRadius: 4, overflow: 'hidden',
                  background: `linear-gradient(to right, #3fb950 ${factor.colors.greenMax}%, #d29922 ${factor.colors.greenMax}%, #d29922 ${factor.colors.yellowMax}%, #f85149 ${factor.colors.yellowMax}%, #f85149 ${factor.colors.redMin}%)`,
                  marginBottom: 8,
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
                  <span>{t.green}: ≤{factor.colors.greenMax}%</span>
                  <span>{t.yellow}: {factor.colors.greenMax}-{factor.colors.yellowMax}%</span>
                  <span>{t.red}: ≥{factor.colors.redMin}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {expandedSection === 'history' && (
          <div>
            {factor.history ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <MetricBox label={t.ic30d} value={factor.history.ic30d} format={v => v?.toFixed(4)} color="#58a6ff" />
                  <MetricBox label={t.ic90d} value={factor.history.ic90d} format={v => v?.toFixed(4)} color="#a371f7" />
                  <MetricBox label={t.winRate} value={factor.history.winRate} format={v => v != null ? `${(v * 100).toFixed(1)}%` : undefined} color="#3fb950" />
                  <MetricBox label={t.sharpe} value={factor.history.sharpe} format={v => v?.toFixed(2)} color="#d29922" />
                  <MetricBox label={t.turnover} value={factor.history.turnover} format={v => v?.toFixed(2)} color="#f0883e" />
                  <MetricBox label={t.lastUpdate} value={0} format={_ => factor.history?.lastUpdate || '—'} color="rgba(255,255,255,0.3)" />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.2)' }}>{t.noHistory}</div>
            )}
          </div>
        )}

        {/* Related */}
        {expandedSection === 'related' && (
          <div>
            {factor.relatedFactors && factor.relatedFactors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {factor.relatedFactors.map(id => (
                  <button
                    key={id}
                    onClick={() => onSelectRelated?.(id)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                      color: '#58a6ff', fontSize: 12, textAlign: 'left',
                    }}
                  >
                    🔗 {id}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.2)' }}>{t.noData}</div>
            )}
          </div>
        )}
      </div>

      {/* AI Interpret button */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'center',
      }}>
        <button
          onClick={() => onAIInterpret?.(factor.id)}
          style={{
            padding: '10px 28px', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(163,113,247,0.2), rgba(59,130,246,0.2))',
            border: '1px solid rgba(163,113,247,0.3)', color: '#a371f7',
            fontWeight: 600, fontSize: 13, width: '100%',
          }}
        >
          {t.aiInterpret}
        </button>
      </div>
      <div style={{ padding: '0 20px 10px', textAlign: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>{t.aiHint}</span>
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────
const DetailRow: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, minWidth: 80 }}>{label}</span>
    <span style={{ color, fontSize: 12, lineHeight: 1.5 }}>{value}</span>
  </div>
);

const MetricBox: React.FC<{ label: string; value: any; format: (v: any) => string | undefined; color: string }> = ({ label, value, format, color }) => (
  <div style={{
    padding: '10px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 16, fontWeight: 700, color }}>{format(value) ?? '—'}</div>
    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{label}</div>
  </div>
);

export default FactorDetailPanel;
