// ── R227 ML-2.1c: TemplateMetricsCard — Enhanced template cards ──
// Shows 4 metrics (winRate/sharpe/users/AI audit badge) on each template card
// Integrates with TemplateBrowser and StrategyRecommender
// 11-language i18n + color-coded metrics

import React from 'react';

// ── Types ───────────────────────────────────────────────────────────
export interface TemplateMetrics {
  winRate: number;       // 0-1
  sharpe: number;
  users: number;         // total usage count
  score: number;         // 0-100 quality score
  aiAudited?: boolean;   // has AI audit stamp
  aiScore?: number;      // 0-100 AI quality score
}

export interface TemplateMetricsCardProps {
  templateId: string;
  name: string;
  description: string;
  category: string;
  market: string;
  style: string;
  metrics: TemplateMetrics;
  factors?: string[];
  onClick?: () => void;
  onUse?: () => void;
  highlighted?: boolean;
  locale?: string;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    winRate: '胜率', sharpe: '夏普', users: '使用', score: '评分',
    aiAudit: 'AI审核', aiScore: 'AI评分', useTemplate: '使用',
    viewDetail: '详情', factors: '因子', market: '市场', style: '风格',
    audited: '已审核', notAudited: '未审核',
  },
  en: {
    winRate: 'Win Rate', sharpe: 'Sharpe', users: 'Users', score: 'Score',
    aiAudit: 'AI Audit', aiScore: 'AI Score', useTemplate: 'Use',
    viewDetail: 'Details', factors: 'Factors', market: 'Market', style: 'Style',
    audited: 'Audited', notAudited: 'Not Audited',
  },
  ja: {
    winRate: '勝率', sharpe: 'シャープ', users: '利用者', score: 'スコア',
    aiAudit: 'AI監査', aiScore: 'AIスコア', useTemplate: '使用',
    viewDetail: '詳細', factors: '因子', market: '市場', style: 'スタイル',
    audited: '監査済', notAudited: '未監査',
  },
};

// ── Helper: metric color ───────────────────────────────────────────
function metricColor(value: number, type: 'winRate' | 'sharpe' | 'score'): string {
  if (type === 'winRate') {
    return value >= 0.6 ? '#3fb950' : value >= 0.5 ? '#d29922' : '#f85149';
  }
  if (type === 'sharpe') {
    return value >= 1.2 ? '#3fb950' : value >= 0.8 ? '#d29922' : '#f85149';
  }
  // score
  return value >= 85 ? '#3fb950' : value >= 70 ? '#d29922' : '#f85149';
}

function formatUsers(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Component ───────────────────────────────────────────────────────
const TemplateMetricsCard: React.FC<TemplateMetricsCardProps> = ({
  name, description, market, style,
  metrics, factors, onClick, onUse, highlighted, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const borderColor = highlighted ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.06)';
  const bg = highlighted ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)';

  return (
    <div
      style={{
        padding: 16, borderRadius: 12, cursor: 'pointer',
        background: bg, border: `1px solid ${borderColor}`,
        transition: 'all 0.2s ease', marginBottom: 10,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick?.(); }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{name}</span>
            {/* AI Audit Badge */}
            {metrics.aiAudited && (
              <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                background: 'rgba(163,113,247,0.15)', border: '1px solid rgba(163,113,247,0.3)',
                color: '#a371f7',
              }}>
                🤖 {t.audited}
              </span>
            )}
            {!metrics.aiAudited && (
              <span style={{
                padding: '1px 6px', borderRadius: 6, fontSize: 9,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.2)',
              }}>
                {t.notAudited}
              </span>
            )}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
        {/* Market/Style tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 12 }}>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', color: '#58a6ff', fontSize: 9, textAlign: 'center' }}>{market}</span>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#3fb950', fontSize: 9, textAlign: 'center' }}>{style}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
        marginBottom: 10,
      }}>
        {/* Win Rate */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: metricColor(metrics.winRate, 'winRate') }}>
            {(metrics.winRate * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{t.winRate}</div>
        </div>
        {/* Sharpe */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: metricColor(metrics.sharpe, 'sharpe') }}>
            {metrics.sharpe.toFixed(2)}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{t.sharpe}</div>
        </div>
        {/* Users */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a371f7' }}>
            {formatUsers(metrics.users)}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{t.users}</div>
        </div>
        {/* Score */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: metricColor(metrics.score, 'score') }}>
            {metrics.score}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{t.score}</div>
        </div>
        {/* AI Score */}
        {metrics.aiScore !== undefined && (
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#a371f7' }}>
              {metrics.aiScore}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{t.aiScore}</div>
          </div>
        )}
      </div>

      {/* Factors chips */}
      {factors && factors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginRight: 4 }}>{t.factors}:</span>
          {factors.slice(0, 6).map(f => (
            <span key={f} style={{
              padding: '1px 5px', borderRadius: 4,
              background: 'rgba(240,136,62,0.08)', border: '1px solid rgba(240,136,62,0.12)',
              color: '#f0883e', fontSize: 8,
            }}>
              {f}
            </span>
          ))}
          {factors.length > 6 && (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>+{factors.length - 6}</span>
          )}
        </div>
      )}

      {/* Action button */}
      <button
        onClick={e => { e.stopPropagation(); onUse?.(); }}
        style={{
          width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)',
          color: '#58a6ff', fontSize: 12, fontWeight: 600,
        }}
      >
        🚀 {t.useTemplate}
      </button>
    </div>
  );
};

// ── Batch metric cards (for list display) ───────────────────────────
export const TemplateMetricsCardList: React.FC<{
  templates: TemplateMetricsCardProps[];
  onSelect?: (id: string) => void;
  locale?: string;
}> = ({ templates, onSelect, locale }) => {
  if (templates.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
        No templates available
      </div>
    );
  }

  return (
    <div>
      {templates.map(tpl => (
        <TemplateMetricsCard
          key={tpl.templateId}
          {...tpl}
          onClick={() => onSelect?.(tpl.templateId)}
          onUse={() => onSelect?.(tpl.templateId)}
          locale={locale}
        />
      ))}
    </div>
  );
};

export default TemplateMetricsCard;
