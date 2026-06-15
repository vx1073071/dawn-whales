// ── R215 ML P1: AITotalCostCard — 模板详情页顶部AI增值功能总费用展示 ──────────
// U1: Shows the total AI service cost upfront so user knows before clicking
// Lists each AI trigger point with individual cost + cumulative total
// 9-language i18n + package suggestion when applicable

import React, { useMemo } from 'react';

export interface AITriggerCost {
  id: string;
  label: string;
  description: string;
  costUSDT: number;
  icon?: string;
  category?: 'analysis' | 'backtest' | 'optimize' | 'signal' | 'data' | 'support';
}

interface AITotalCostCardProps {
  triggers: AITriggerCost[];
  onPackageClick?: () => void;
  locale?: string;
  compact?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '💰 AI 增值功能总费用',
    subtitle: '本模板的全部 AI 服务合计',
    total: '合计',
    free: '免费',
    items: '项服务',
    saveTip: '套餐购买可省',
    packageBtn: '查看套餐',
    perUse: '/次',
    perDay: '/天',
    perMonth: '/月',
    expandable: '展开明细',
    collapse: '收起',
    budget: '本月预算建议',
    budgetTip: '建议预留此额度',
    popHint: '4.5U/月是常见用量',
  },
  en: {
    title: '💰 Total AI Service Cost',
    subtitle: 'All AI services for this template',
    total: 'Total',
    free: 'Free',
    items: 'services',
    saveTip: 'Save with package',
    packageBtn: 'View Package',
    perUse: '/use',
    perDay: '/day',
    perMonth: '/month',
    expandable: 'Show details',
    collapse: 'Hide',
    budget: 'Monthly Budget',
    budgetTip: 'Recommended reserve',
    popHint: '4.5U/mo is typical',
  },
  ja: { title: '💰 AI追加サービス総費用', subtitle: 'このテンプレートの全AIサービス', total: '合計', free: '無料', items: '件', saveTip: 'パッケージで節約', packageBtn: 'パッケージを見る', perUse: '/回', perDay: '/日', perMonth: '/月', expandable: '詳細', collapse: '閉じる', budget: '月額予算', budgetTip: '推奨額', popHint: '4.5U/月が一般的' },
  ko: { title: '💰 AI 부가서비스 총비용', subtitle: '이 템플릿의 모든 AI 서비스', total: '합계', free: '무료', items: '개', saveTip: '패키지로 절약', packageBtn: '패키지 보기', perUse: '/회', perDay: '/일', perMonth: '/월', expandable: '상세', collapse: '닫기', budget: '월 예산', budgetTip: '권장 금액', popHint: '4.5U/월이 일반적' },
  fr: { title: '💰 Coût Total IA', subtitle: 'Tous les services IA pour ce modèle', total: 'Total', free: 'Gratuit', items: 'services', saveTip: 'Économisez avec le pack', packageBtn: 'Voir Pack', perUse: '/usage', perDay: '/jour', perMonth: '/mois', expandable: 'Détails', collapse: 'Masquer', budget: 'Budget mensuel', budgetTip: 'Recommandé', popHint: '4.5U/mois typique' },
  it: { title: '💰 Costo Totale IA', subtitle: 'Tutti i servizi IA per questo template', total: 'Totale', free: 'Gratis', items: 'servizi', saveTip: 'Risparmia con il pacchetto', packageBtn: 'Vedi Pacchetto', perUse: '/uso', perDay: '/giorno', perMonth: '/mese', expandable: 'Dettagli', collapse: 'Nascondi', budget: 'Budget mensile', budgetTip: 'Consigliato', popHint: '4.5U/mese tipico' },
  de: { title: '💰 KI-Gesamtkosten', subtitle: 'Alle KI-Dienste für diese Vorlage', total: 'Gesamt', free: 'Kostenlos', items: 'Dienste', saveTip: 'Mit Paket sparen', packageBtn: 'Paket ansehen', perUse: '/Nutzung', perDay: '/Tag', perMonth: '/Monat', expandable: 'Details', collapse: 'Ausblenden', budget: 'Monatsbudget', budgetTip: 'Empfohlen', popHint: '4.5U/Monat typisch' },
  es: { title: '💰 Coste Total IA', subtitle: 'Todos los servicios IA para esta plantilla', total: 'Total', free: 'Gratis', items: 'servicios', saveTip: 'Ahorra con paquete', packageBtn: 'Ver Paquete', perUse: '/uso', perDay: '/día', perMonth: '/mes', expandable: 'Detalles', collapse: 'Ocultar', budget: 'Presupuesto mensual', budgetTip: 'Recomendado', popHint: '4.5U/mes típico' },
};

// ── Category Colors ─────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  analysis: '#3b82f6', backtest: '#22c55e', optimize: '#f59e0b',
  signal: '#ef4444', data: '#8b5cf6', support: '#06b6d4',
};

// ── Component ───────────────────────────────────────────────────────
const AITotalCostCard: React.FC<AITotalCostCardProps> = ({
  triggers, onPackageClick, locale: pl, compact = false,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const stats = useMemo(() => {
    const total = triggers.reduce((sum, x) => sum + (x.costUSDT || 0), 0);
    const nonFree = triggers.filter(x => x.costUSDT > 0);
    const savings = total * 0.17; // 17% package savings
    const monthlyBudget = total * 0.5; // half of one-time as monthly hint
    return { total, count: triggers.length, paidCount: nonFree.length, savings, monthlyBudget };
  }, [triggers]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '2px solid #f59e0b', borderRadius: 12,
      padding: compact ? 14 : 20, marginBottom: compact ? 8 : 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: '#92400e' }}>
            {t.title}
          </div>
          <div style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>
            {t.subtitle} · {stats.count} {t.items}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: compact ? 20 : 26, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>
            {stats.total.toFixed(1)} <span style={{ fontSize: 12, color: '#92400e' }}>USDT</span>
          </div>
          <div style={{ fontSize: 10, color: '#a16207', marginTop: 2 }}>
            {t.total} · {stats.paidCount} {t.items}
          </div>
        </div>
      </div>

      {/* ── Trigger Detail List ─────────────────────────────────── */}
      {!compact && (
        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          {triggers.map((tr, i) => {
            const cat = tr.category || 'analysis';
            const color = CAT_COLORS[cat] || '#64748b';
            return (
              <div key={tr.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: i < triggers.length - 1 ? '1px dashed rgba(146,64,14,0.2)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{tr.icon || '⚙️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{tr.label}</div>
                    <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tr.description}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4,
                    background: `${color}20`, color: color, fontWeight: 600,
                  }}>
                    {cat}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tr.costUSDT === 0 ? '#22c55e' : '#dc2626', minWidth: 50, textAlign: 'right' }}>
                    {tr.costUSDT === 0 ? t.free : `${tr.costUSDT}U`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Savings + Budget Hint + Package ─────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#92400e' }}>
          <span>💡 {t.saveTip} <strong>{stats.savings.toFixed(1)}U</strong></span>
          <span style={{ color: '#a16207' }}>·</span>
          <span>📊 {t.budget}: <strong>{stats.monthlyBudget.toFixed(1)}U</strong>/月</span>
        </div>
        {onPackageClick && (
          <button onClick={onPackageClick} style={{
            background: '#dc2626', color: '#fff', border: 'none',
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 2px 6px rgba(220,38,38,0.2)',
          }}>
            🎁 {t.packageBtn}
          </button>
        )}
      </div>
    </div>
  );
};

export default AITotalCostCard;
