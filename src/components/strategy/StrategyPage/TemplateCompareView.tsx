// ── R216 ML P4: TemplateCompareView — 模板对比工具 ──────────
// P6: 2 templates side-by-side comparison
// Columns: 4 Golden Rules + Factors + Risk + Returns + AI Cost + Markets
// 9-language i18n + winner highlights per row + score-based recommendation

import React, { useState, useMemo } from 'react';
import { Button, Tag, Empty, Skeleton } from 'antd';
import {
  TrophyOutlined, SwapOutlined,
} from '@ant-design/icons';

export interface CompareTemplate {
  id: string;
  name: string;
  nameCN: string;
  oneLiner: string;
  category: string;
  marketTags: string[];
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  humanLine?: string;
  stopLossRule?: string;
  marketScope?: string[];
  failureCheck?: string;
  factors?: { factorName: string; weight: number; direction: 'long' | 'short' }[];
  aiTotalCost?: number; // USDT
  estimatedReturn?: number; // 0-100
  estimatedMaxLoss?: number; // 0-100
  sharpeRatio?: number;
  factorCount?: number;
}

interface TemplateCompareViewProps {
  templateA?: CompareTemplate | null;
  templateB?: CompareTemplate | null;
  availableTemplates?: CompareTemplate[];
  onPickA?: (id: string) => void;
  onPickB?: (id: string) => void;
  onSelectTemplate?: (id: string) => void;
  locale?: string;
  loading?: boolean;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🆚 模板对比',
    subtitle: '选 2 个模板并排对比,找出最适合你的',
    a: 'A', b: 'B',
    pickA: '选择模板 A', pickB: '选择模板 B', swap: '交换',
    basic: '基本信息', ironLaws: '四铁律', factors: '核心因子',
    risk: '风险与收益', cost: 'AI 增值费用', markets: '适用市场',
    name: '策略名', riskLevel: '风险等级', difficulty: '难度',
    oneLiner: '一句话', marketScope: '市场范围', stopLoss: '止损规则',
    failureCheck: '失效自检', factorCount: '因子数', annualReturn: '年化收益',
    maxLoss: '最大亏损', sharpe: '夏普', aiTotalCost: 'AI 总费用',
    winner: '优', recommend: '推荐', recommendReason: '综合评分更高',
    empty: '请选择 2 个模板开始对比',
    removeBtn: '移除', same: '相同',
    noData: '无数据',
  },
  en: {
    title: '🆚 Template Comparison',
    subtitle: 'Pick 2 templates to compare side by side',
    a: 'A', b: 'B',
    pickA: 'Select Template A', pickB: 'Select Template B', swap: 'Swap',
    basic: 'Basics', ironLaws: '4 Golden Rules', factors: 'Core Factors',
    risk: 'Risk & Return', cost: 'AI Service Cost', markets: 'Markets',
    name: 'Strategy', riskLevel: 'Risk Level', difficulty: 'Difficulty',
    oneLiner: 'Tagline', marketScope: 'Markets', stopLoss: 'Stop-Loss',
    failureCheck: 'Failure Check', factorCount: 'Factors', annualReturn: 'Annual Return',
    maxLoss: 'Max Loss', sharpe: 'Sharpe', aiTotalCost: 'AI Total Cost',
    winner: 'Win', recommend: 'Recommended', recommendReason: 'Higher overall score',
    empty: 'Pick 2 templates to start',
    removeBtn: 'Remove', same: 'Same',
    noData: 'N/A',
  },
  ja: { title: '🆚 テンプレート比較', subtitle: '2つのテンプレートを並べて比較', a: 'A', b: 'B', pickA: 'A を選択', pickB: 'B を選択', swap: '入れ替え', basic: '基本情報', ironLaws: '4つの鉄則', factors: 'コア因子', risk: 'リスクとリターン', cost: 'AI サービス料', markets: '対象市場', name: '戦略名', riskLevel: 'リスクレベル', difficulty: '難易度', oneLiner: '一言', marketScope: '市場範囲', stopLoss: '損切り', failureCheck: '失敗チェック', factorCount: '因子数', annualReturn: '年率リターン', maxLoss: '最大損失', sharpe: 'シャープ', aiTotalCost: 'AI 総費用', winner: '勝', recommend: '推奨', recommendReason: '総合スコアが高い', empty: '2つ選択してください', removeBtn: '削除', same: '同じ', noData: 'なし' },
  ko: { title: '🆚 템플릿 비교', subtitle: '2개 템플릿을 나란히 비교', a: 'A', b: 'B', pickA: 'A 선택', pickB: 'B 선택', swap: '교환', basic: '기본', ironLaws: '4대 원칙', factors: '핵심 팩터', risk: '리스크와 수익', cost: 'AI 서비스 비용', markets: '시장', name: '전략명', riskLevel: '리스크 레벨', difficulty: '난이도', oneLiner: '한 줄', marketScope: '시장 범위', stopLoss: '스탑로스', failureCheck: '실패 체크', factorCount: '팩터 수', annualReturn: '연간 수익', maxLoss: '최대 손실', sharpe: '샤프', aiTotalCost: 'AI 총 비용', winner: '승', recommend: '추천', recommendReason: '종합 점수 더 높음', empty: '2개 선택하세요', removeBtn: '제거', same: '동일', noData: '없음' },
  fr: { title: '🆚 Comparaison', subtitle: 'Comparez 2 modèles côte à côte', a: 'A', b: 'B', pickA: 'Choisir A', pickB: 'Choisir B', swap: 'Échanger', basic: 'Infos', ironLaws: '4 Règles d\'or', factors: 'Facteurs', risk: 'Risque & Rendement', cost: 'Coût IA', markets: 'Marchés', name: 'Stratégie', riskLevel: 'Risque', difficulty: 'Difficulté', oneLiner: 'Slogan', marketScope: 'Marchés', stopLoss: 'Stop-Loss', failureCheck: 'Échec', factorCount: 'Facteurs', annualReturn: 'Rendement annuel', maxLoss: 'Perte max', sharpe: 'Sharpe', aiTotalCost: 'Coût IA total', winner: 'Gagnant', recommend: 'Recommandé', recommendReason: 'Score global plus élevé', empty: 'Choisissez 2 modèles', removeBtn: 'Retirer', same: 'Idem', noData: 'N/D' },
  it: { title: '🆚 Confronto', subtitle: 'Confronta 2 template fianco a fianco', a: 'A', b: 'B', pickA: 'Seleziona A', pickB: 'Seleziona B', swap: 'Scambia', basic: 'Info', ironLaws: '4 Regole d\'oro', factors: 'Fattori', risk: 'Rischio & Rendimento', cost: 'Costo IA', markets: 'Mercati', name: 'Strategia', riskLevel: 'Rischio', difficulty: 'Difficoltà', oneLiner: 'Slogan', marketScope: 'Mercati', stopLoss: 'Stop-Loss', failureCheck: 'Fallimento', factorCount: 'Fattori', annualReturn: 'Rendimento annuo', maxLoss: 'Perdita max', sharpe: 'Sharpe', aiTotalCost: 'Costo IA tot', winner: 'Vincitore', recommend: 'Consigliato', recommendReason: 'Punteggio più alto', empty: 'Scegli 2 template', removeBtn: 'Rimuovi', same: 'Uguale', noData: 'N/D' },
  de: { title: '🆚 Vorlagenvergleich', subtitle: '2 Vorlagen nebeneinander vergleichen', a: 'A', b: 'B', pickA: 'Wähle A', pickB: 'Wähle B', swap: 'Tauschen', basic: 'Basis', ironLaws: '4 Goldene Regeln', factors: 'Kernfaktoren', risk: 'Risiko & Rendite', cost: 'KI-Kosten', markets: 'Märkte', name: 'Strategie', riskLevel: 'Risiko', difficulty: 'Schwierigkeit', oneLiner: 'Slogan', marketScope: 'Märkte', stopLoss: 'Stop-Loss', failureCheck: 'Ausfall', factorCount: 'Faktoren', annualReturn: 'Jahresrendite', maxLoss: 'Max-Verlust', sharpe: 'Sharpe', aiTotalCost: 'KI-Gesamtkosten', winner: 'Gewinnt', recommend: 'Empfohlen', recommendReason: 'Höherer Gesamtscore', empty: 'Wähle 2 Vorlagen', removeBtn: 'Entfernen', same: 'Gleich', noData: 'N/V' },
  es: { title: '🆚 Comparación', subtitle: 'Compara 2 plantillas lado a lado', a: 'A', b: 'B', pickA: 'Elegir A', pickB: 'Elegir B', swap: 'Intercambiar', basic: 'Básico', ironLaws: '4 Reglas de oro', factors: 'Factores', risk: 'Riesgo y Retorno', cost: 'Costo IA', markets: 'Mercados', name: 'Estrategia', riskLevel: 'Riesgo', difficulty: 'Dificultad', oneLiner: 'Lema', marketScope: 'Mercados', stopLoss: 'Stop-Loss', failureCheck: 'Fallo', factorCount: 'Factores', annualReturn: 'Retorno anual', maxLoss: 'Pérdida máx', sharpe: 'Sharpe', aiTotalCost: 'Costo IA total', winner: 'Gana', recommend: 'Recomendado', recommendReason: 'Mayor puntuación global', empty: 'Elige 2 plantillas', removeBtn: 'Quitar', same: 'Igual', noData: 'N/D' },
};

const RISK_EMOJI: Record<string, string> = { conservative: '🛡️', balanced: '⚖️', aggressive: '⚡' };

// ── Helper: score a template (0-100) ───────────────────────────────
function scoreTemplate(t: CompareTemplate): number {
  let s = 50;
  if (t.sharpeRatio !== undefined) s += Math.min(20, t.sharpeRatio * 10);
  if (t.estimatedReturn !== undefined) s += Math.min(15, t.estimatedReturn * 0.3);
  if (t.estimatedMaxLoss !== undefined) s -= Math.min(20, t.estimatedMaxLoss * 0.4);
  if (t.aiTotalCost !== undefined) s -= Math.min(5, t.aiTotalCost * 0.3);
  if (t.factorCount !== undefined) {
    s += (t.factorCount >= 3 && t.factorCount <= 5) ? 5 : 0;
  }
  return Math.max(0, Math.min(100, s));
}

const TemplateCompareView: React.FC<TemplateCompareViewProps> = ({
  templateA: propA, templateB: propB, availableTemplates = [],
  onPickA, onPickB, onSelectTemplate, locale: pl, loading = false,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [a, setA] = useState<CompareTemplate | null>(propA ?? null);
  const [b, setB] = useState<CompareTemplate | null>(propB ?? null);
  const [showPickerA, setShowPickerA] = useState(false);
  const [showPickerB, setShowPickerB] = useState(false);

  const scoreA = a ? scoreTemplate(a) : 0;
  const scoreB = b ? scoreTemplate(b) : 0;
  const winner = a && b ? (scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie') : null;

  const compareRows = useMemo(() => {
    if (!a || !b) return [];
    return [
      { key: 'name', section: t.basic, label: t.name, a: pl?.startsWith('zh') ? a.nameCN : a.name, b: pl?.startsWith('zh') ? b.nameCN : b.name },
      { key: 'risk', section: t.basic, label: t.riskLevel, a: `${RISK_EMOJI[a.riskLevel]} ${a.riskLevel}`, b: `${RISK_EMOJI[b.riskLevel]} ${b.riskLevel}`, winner: a.riskLevel === 'conservative' ? null : a.riskLevel === 'balanced' ? 'tie' : 'B' },
      { key: 'diff', section: t.basic, label: t.difficulty, a: a.difficulty, b: b.difficulty },
      { key: 'one', section: t.ironLaws, label: t.oneLiner, a: a.oneLiner, b: b.oneLiner },
      { key: 'ms', section: t.ironLaws, label: t.marketScope, a: (a.marketScope || a.marketTags).join(', '), b: (b.marketScope || b.marketTags).join(', ') },
      { key: 'sl', section: t.ironLaws, label: t.stopLoss, a: a.stopLossRule || t.noData, b: b.stopLossRule || t.noData },
      { key: 'fc', section: t.ironLaws, label: t.failureCheck, a: a.failureCheck || t.noData, b: b.failureCheck || t.noData },
      { key: 'factors', section: t.factors, label: t.factorCount, a: a.factorCount ?? (a.factors?.length ?? 0), b: b.factorCount ?? (b.factors?.length ?? 0), isNum: true, lowerBetter: false },
      { key: 'return', section: t.risk, label: t.annualReturn, a: a.estimatedReturn, b: b.estimatedReturn, isNum: true, suffix: '%', color: 'green' },
      { key: 'loss', section: t.risk, label: t.maxLoss, a: a.estimatedMaxLoss, b: b.estimatedMaxLoss, isNum: true, suffix: '%', color: 'red', lowerBetter: true },
      { key: 'sharpe', section: t.risk, label: t.sharpe, a: a.sharpeRatio, b: b.sharpeRatio, isNum: true, decimal: true },
      { key: 'cost', section: t.cost, label: t.aiTotalCost, a: a.aiTotalCost, b: b.aiTotalCost, isNum: true, suffix: 'U', lowerBetter: true, color: 'red' },
    ];
  }, [a, b, t, pl]);

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;

  if (!a && !b) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <SwapOutlined style={{ fontSize: 40, marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{t.title}</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>{t.subtitle}</div>
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button type="primary" onClick={() => setShowPickerA(true)}>{t.pickA}</Button>
          <Button onClick={() => setShowPickerB(true)}>{t.pickB}</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ── Title + Actions ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>{t.title}</h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => { const tmp = a; setA(b); setB(tmp); }}>
            ⇄ {t.swap}
          </Button>
        </div>
      </div>

      {/* ── Header Row (A vs B) ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.5fr', gap: 12, marginBottom: 16 }}>
        <div />
        <CompareColumn tmpl={a} side="A" score={scoreA} winner={winner === 'A'} recommended={winner === 'A'}
          onPick={() => setShowPickerA(true)} onRemove={() => setA(null)} onSelect={() => a && onSelectTemplate?.(a.id)}
          pickLabel={t.pickA} removeLabel={t.removeBtn} recommendLabel={t.recommend} reasonLabel={t.recommendReason} />
        <CompareColumn tmpl={b} side="B" score={scoreB} winner={winner === 'B'} recommended={winner === 'B'}
          onPick={() => setShowPickerB(true)} onRemove={() => setB(null)} onSelect={() => b && onSelectTemplate?.(b.id)}
          pickLabel={t.pickB} removeLabel={t.removeBtn} recommendLabel={t.recommend} reasonLabel={t.recommendReason} />
      </div>

      {/* ── Comparison Rows ─────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {(['basic', 'ironLaws', 'factors', 'risk', 'cost', 'markets'] as const).map(section => {
          const rows = compareRows.filter(r => r.section === t[section as keyof typeof t] || r.section === section);
          if (rows.length === 0) return null;
          return (
            <div key={section}>
              <div style={{ background: '#f8fafc', padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                {(t as any)[section] || section}
              </div>
              {rows.map(row => {
                const aWin = row.isNum && row.a !== undefined && row.b !== undefined &&
                  (row.lowerBetter ? (row.a as number) < (row.b as number) : (row.a as number) > (row.b as number));
                const bWin = row.isNum && row.a !== undefined && row.b !== undefined &&
                  (row.lowerBetter ? (row.b as number) < (row.a as number) : (row.b as number) > (row.a as number));
                return (
                  <div key={row.key} style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.5fr',
                    padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 12,
                  }}>
                    <div style={{ color: '#64748b' }}>{row.label}</div>
                    <Cell value={row.a} win={aWin ?? false} isNum={row.isNum} suffix={row.suffix} decimal={row.decimal} color={row.color} same={row.a === row.b} sameLabel={t.same} />
                    <Cell value={row.b} win={bWin ?? false} isNum={row.isNum} suffix={row.suffix} decimal={row.decimal} color={row.color} same={row.a === row.b} sameLabel={t.same} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Picker Modal (simplified) ────────────────────────────── */}
      {(showPickerA || showPickerB) && availableTemplates.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10004,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }} onClick={() => { setShowPickerA(false); setShowPickerB(false); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: 20, maxWidth: 400, width: '90%', maxHeight: '70vh', overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 12px' }}>{showPickerA ? t.pickA : t.pickB}</h3>
            {availableTemplates.map(tmpl => (
              <div key={tmpl.id} onClick={() => {
                if (showPickerA) { setA(tmpl); onPickA?.(tmpl.id); setShowPickerA(false); }
                else { setB(tmpl); onPickB?.(tmpl.id); setShowPickerB(false); }
              }} style={{
                padding: 10, borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13,
              }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                 onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <strong>{pl?.startsWith('zh') ? tmpl.nameCN : tmpl.name}</strong>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{tmpl.oneLiner}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CompareColumn: React.FC<{
  tmpl: CompareTemplate | null; side: string; score: number;
  winner?: boolean; recommended?: boolean;
  onPick: () => void; onRemove: () => void; onSelect: () => void;
  pickLabel: string; removeLabel: string; recommendLabel: string; reasonLabel: string;
}> = ({ tmpl, side, score, winner, recommended, onPick, onRemove, onSelect, pickLabel, removeLabel, recommendLabel, reasonLabel }) => (
  <div style={{
    background: winner ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#f8fafc',
    border: winner ? '2px solid #f59e0b' : '1px solid #e2e8f0',
    borderRadius: 12, padding: 16, textAlign: 'center',
  }}>
    {tmpl ? (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Tag color={winner ? 'gold' : 'default'}>{side}</Tag>
          {recommended && <Tag color="gold" icon={<TrophyOutlined />}>{recommendLabel}</Tag>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{tmpl.nameCN}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{tmpl.oneLiner}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: winner ? '#f59e0b' : '#3b82f6' }}>{score.toFixed(0)}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>综合分</span>
        </div>
        {recommended && <div style={{ fontSize: 10, color: '#92400e', marginBottom: 8 }}>🏆 {reasonLabel}</div>}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Button size="small" type="primary" onClick={onSelect}>使用</Button>
          <Button size="small" onClick={onRemove}>{removeLabel}</Button>
        </div>
      </>
    ) : (
      <>
        <Tag color="default">{side}</Tag>
        <Empty description={pickLabel} style={{ margin: '12px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Button type="primary" size="small" onClick={onPick}>{pickLabel}</Button>
      </>
    )}
  </div>
);

const Cell: React.FC<{
  value: any; win: boolean; isNum?: boolean; suffix?: string; decimal?: boolean;
  color?: string; same?: boolean; sameLabel?: string;
}> = ({ value, win, isNum, suffix, decimal, color, same, sameLabel }) => {
  if (value === undefined || value === null) return <div style={{ color: '#94a3b8' }}>—</div>;
  let display = value;
  if (isNum && typeof value === 'number') {
    display = decimal ? value.toFixed(2) : value.toFixed(0);
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      color: win ? (color || '#22c55e') : '#1e293b',
      fontWeight: win ? 700 : 500,
    }}>
      {win && <TrophyOutlined style={{ color: '#f59e0b' }} />}
      {isNum && typeof value === 'number' && value > 0 && color === 'red' ? <span style={{ color: win ? '#ef4444' : '#dc2626' }}>{display}{suffix}</span> : <span>{display}{suffix || ''}</span>}
      {same && <Tag style={{ marginLeft: 4, fontSize: 10 }}>{sameLabel}</Tag>}
    </div>
  );
};

export default TemplateCompareView;
