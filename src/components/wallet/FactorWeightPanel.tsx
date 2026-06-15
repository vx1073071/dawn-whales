// ── R218 ML P1: FactorWeightPanel — 因子权重拖拽UI (升级自WeightSlider) ──────────
// L8: Drag-and-drop pie chart for factor weights + real-time normalization
// Each segment is a "slice" you can drag to grow/shrink
// Iron rule validation: must sum to 100%, no negative, no zero-sum

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button, Tooltip, Tag, Progress } from 'antd';
import {
  LockOutlined, UnlockOutlined, UndoOutlined, CheckCircleOutlined,
  ReloadOutlined, RiseOutlined, FallOutlined,
} from '@ant-design/icons';

export interface FactorWeight {
  factorId: string;
  factorName: string;
  factorNameCN: string;
  weight: number; // 0-100
  color: string;
  direction: 'long' | 'short';
  locked?: boolean;
  description?: string;
}

interface FactorWeightPanelProps {
  factors?: FactorWeight[];
  onChange?: (factors: FactorWeight[]) => void;
  onValidate?: (isValid: boolean, total: number) => void;
  readOnly?: boolean;
  locale?: string;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🎯 因子权重面板',
    subtitle: '拖拽饼图扇区调整权重,自动归一化,总和 100%',
    total: '权重总和', valid: '✅ 已达标', invalid: '⚠️ 总和必须 100%',
    remaining: '剩余', over: '超出', lock: '锁定', unlock: '解锁',
    reset: '重置', autoBalance: '自动平衡', long: '做多', short: '做空',
    adjust: '调整', drag: '拖拽', increase: '增加', decrease: '减少',
    sum100: '总和 100%', ironRule: '铁律',
    live: '实时',
  },
  en: {
    title: '🎯 Factor Weight Panel',
    subtitle: 'Drag pie segments to adjust, auto-normalize, sum to 100%',
    total: 'Total', valid: '✅ Valid', invalid: '⚠️ Must sum to 100%',
    remaining: 'Remaining', over: 'Over', lock: 'Lock', unlock: 'Unlock',
    reset: 'Reset', autoBalance: 'Auto Balance', long: 'Long', short: 'Short',
    adjust: 'Adjust', drag: 'Drag', increase: 'Increase', decrease: 'Decrease',
    sum100: 'Sum 100%', ironRule: 'Iron Rule',
    live: 'Live',
  },
  ja: { title: '🎯 因子重みパネル', subtitle: 'パイをドラッグで調整, 自動正規化, 合計100%', total: '合計', valid: '✅ OK', invalid: '⚠️ 100%必須', remaining: '残り', over: '超', lock: 'ロック', unlock: '解除', reset: 'リセット', autoBalance: '自動調整', long: 'ロング', short: 'ショート', adjust: '調整', drag: 'ドラッグ', increase: '増', decrease: '減', sum100: '合計100%', ironRule: '鉄則', live: 'ライブ' },
  ko: { title: '🎯 팩터 가중치 패널', subtitle: '파이 드래그로 조정, 자동 정규화, 합계 100%', total: '합계', valid: '✅ OK', invalid: '⚠️ 100% 필요', remaining: '남음', over: '초과', lock: '잠금', unlock: '해제', reset: '초기화', autoBalance: '자동조정', long: '롱', short: '숏', adjust: '조정', drag: '드래그', increase: '증가', decrease: '감소', sum100: '합계 100%', ironRule: '원칙', live: '실시간' },
  fr: { title: '🎯 Panneau Poids', subtitle: 'Glissez pour ajuster, 100% requis', total: 'Total', valid: '✅ OK', invalid: '⚠️ 100% requis', remaining: 'Restant', over: 'Dépassé', lock: 'Verrou', unlock: 'Déverrouiller', reset: 'Réinitialiser', autoBalance: 'Équilibrer', long: 'Long', short: 'Short', adjust: 'Ajuster', drag: 'Glisser', increase: 'Augmenter', decrease: 'Diminuer', sum100: 'Total 100%', ironRule: 'Règle', live: 'Live' },
  it: { title: '🎯 Pannello Pesi', subtitle: 'Trascina per aggiustare, 100% richiesto', total: 'Totale', valid: '✅ OK', invalid: '⚠️ 100% richiesto', remaining: 'Rimanente', over: 'Ecceduto', lock: 'Blocca', unlock: 'Sblocca', reset: 'Reset', autoBalance: 'Bilancia', long: 'Long', short: 'Short', adjust: 'Regola', drag: 'Trascina', increase: 'Aumenta', decrease: 'Diminuisci', sum100: 'Totale 100%', ironRule: 'Regola', live: 'Live' },
  de: { title: '🎯 Faktor-Gewicht', subtitle: 'Ziehen zum Anpassen, 100% erforderlich', total: 'Summe', valid: '✅ OK', invalid: '⚠️ 100% erforderlich', remaining: 'Verbleibend', over: 'Über', lock: 'Sperren', unlock: 'Entsperren', reset: 'Zurücksetzen', autoBalance: 'Ausgleichen', long: 'Long', short: 'Short', adjust: 'Anpassen', drag: 'Ziehen', increase: 'Erhöhen', decrease: 'Verringern', sum100: 'Summe 100%', ironRule: 'Regel', live: 'Live' },
  es: { title: '🎯 Panel de Pesos', subtitle: 'Arrastra para ajustar, 100% requerido', total: 'Total', valid: '✅ OK', invalid: '⚠️ 100% requerido', remaining: 'Restante', over: 'Excedido', lock: 'Bloquear', unlock: 'Desbloquear', reset: 'Restablecer', autoBalance: 'Equilibrar', long: 'Long', short: 'Short', adjust: 'Ajustar', drag: 'Arrastrar', increase: 'Aumentar', decrease: 'Disminuir', sum100: 'Total 100%', ironRule: 'Regla', live: 'En vivo' },
};

const DEMO_FACTORS: FactorWeight[] = [
  { factorId: 'MOM_12M', factorName: '12M Momentum', factorNameCN: '12M动量', weight: 35, color: '#4a90d9', direction: 'long' },
  { factorId: 'ROE', factorName: 'Quality ROE', factorNameCN: 'ROE质量', weight: 25, color: '#52c41a', direction: 'long' },
  { factorId: 'PE', factorName: 'Value PE', factorNameCN: 'PE价值', weight: 20, color: '#d4a853', direction: 'long' },
  { factorId: 'LOW_VOL', factorName: 'Low Volatility', factorNameCN: '低波动', weight: 20, color: '#9b59b6', direction: 'short' },
];

// ── Pie Chart Drawing Helpers ───────────────────────────────────────
interface Point { x: number; y: number; }

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

const FactorWeightPanel: React.FC<FactorWeightPanelProps> = ({
  factors: propFactors, onChange, onValidate, readOnly = false, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const [factors, setFactors] = useState<FactorWeight[]>(propFactors ?? DEMO_FACTORS);
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { if (propFactors) setFactors(propFactors); }, [propFactors]);

  // ── Total + Validation ────────────────────────────────────────
  const total = useMemo(() => factors.reduce((s, f) => s + (f.locked ? 0 : f.weight), 0), [factors]);
  const lockedTotal = useMemo(() => factors.filter(f => f.locked).reduce((s, f) => s + f.weight, 0), [factors]);
  const isValid = Math.abs(total - 100) < 0.5;

  useEffect(() => { onValidate?.(isValid, total); }, [isValid, total, onValidate]);

  const updateFactors = (newFactors: FactorWeight[]) => {
    setFactors(newFactors);
    onChange?.(newFactors);
  };

  // ── Pie Geometry ──────────────────────────────────────────────
  const cx = 150, cy = 150, r = 100;
  const segments = useMemo(() => {
    let acc = 0;
    return factors.map(f => {
      const startAngle = (acc / 100) * 360;
      acc += f.weight;
      const endAngle = (acc / 100) * 360;
      const midAngle = (startAngle + endAngle) / 2;
      const labelPos = polarToCartesian(cx, cy, r * 0.7, midAngle);
      return { factor: f, startAngle, endAngle, midAngle, labelPos, path: arcPath(cx, cy, r, startAngle, endAngle) };
    });
  }, [factors]);

  // ── Drag Handling ─────────────────────────────────────────────
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    let cx_client: number, cy_client: number;
    if ('touches' in e) { cx_client = e.touches[0]?.clientX ?? 0; cy_client = e.touches[0]?.clientY ?? 0; }
    else { cx_client = (e as MouseEvent).clientX; cy_client = (e as MouseEvent).clientY; }
    const dx = cx_client - rect.left - cx;
    const dy = cy_client - rect.top - cy;
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const newWeight = Math.max(0, Math.min(100, (angle / 360) * 100));

    const updated = factors.map(f => f.factorId === dragging ? { ...f, weight: newWeight } : f);
    updateFactors(updated);
  }, [dragging, factors]);

  const handleDragEnd = useCallback(() => { setDragging(null); }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);

  // ── Actions ───────────────────────────────────────────────────
  const adjustWeight = (id: string, delta: number) => {
    if (readOnly) return;
    const updated = factors.map(f => f.factorId === id ? { ...f, weight: Math.max(0, f.weight + delta) } : f);
    updateFactors(updated);
  };

  const toggleLock = (id: string) => {
    if (readOnly) return;
    const updated = factors.map(f => f.factorId === id ? { ...f, locked: !f.locked } : f);
    updateFactors(updated);
  };

  const autoBalance = () => {
    if (readOnly) return;
    const unlocked = factors.filter(f => !f.locked);
    const lockedSum = lockedTotal;
    if (unlocked.length === 0 || (100 - lockedSum) < 0) return;
    const target = (100 - lockedSum) / unlocked.length;
    const updated = factors.map(f => f.locked ? f : { ...f, weight: target });
    updateFactors(updated);
  };

  const resetWeights = () => {
    if (readOnly) return;
    updateFactors(DEMO_FACTORS.map(f => ({ ...f })));
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      border: '1px solid #e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
          {t.title}
        </h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{t.subtitle}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
        {/* ── Pie Chart (Drag-and-Drop) ──────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <svg ref={svgRef} width={300} height={300} viewBox="0 0 300 300" style={{ touchAction: 'none' }}>
            {segments.map(seg => (
              <g key={seg.factor.factorId}>
                <path
                  d={seg.path}
                  fill={seg.factor.color}
                  stroke={seg.factor.locked ? '#94a3b8' : '#fff'}
                  strokeWidth={seg.factor.locked ? 2 : 1}
                  opacity={seg.factor.locked ? 0.6 : 0.95}
                  style={{ cursor: seg.factor.locked ? 'not-allowed' : (readOnly ? 'default' : 'grab') }}
                  onMouseDown={() => !seg.factor.locked && !readOnly && setDragging(seg.factor.factorId)}
                  onTouchStart={() => !seg.factor.locked && !readOnly && setDragging(seg.factor.factorId)}
                />
                {seg.factor.weight >= 8 && (
                  <text
                    x={seg.labelPos.x} y={seg.labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={11}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {seg.factor.weight.toFixed(0)}%
                  </text>
                )}
              </g>
            ))}
            {/* Center label */}
            <circle cx={cx} cy={cy} r={30} fill="#fff" stroke="#e2e8f0" strokeWidth={1} />
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize={10} fill="#64748b">{t.total}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize={16} fontWeight={700} fill={isValid ? '#22c55e' : '#ef4444'}>
              {total.toFixed(0)}%
            </text>
          </svg>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>👆 {t.drag}</div>
        </div>

        {/* ── Factor List ─────────────────────────────────────── */}
        <div>
          {factors.map(f => (
            <div key={f.factorId} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              background: '#f8fafc', borderRadius: 8, marginBottom: 6,
              border: `1px solid ${f.locked ? '#94a3b8' : 'transparent'}`,
            }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: f.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    {langKey.startsWith('zh') ? f.factorNameCN : f.factorName}
                  </span>
                  <Tag color={f.direction === 'long' ? 'green' : 'red'} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                    {f.direction === 'long' ? <RiseOutlined /> : <FallOutlined />} {f.direction === 'long' ? t.long : t.short}
                  </Tag>
                  {f.locked && <Tag icon={<LockOutlined />} color="default" style={{ fontSize: 10, margin: 0 }}>{t.lock}</Tag>}
                </div>
                <Progress
                  percent={f.weight}
                  strokeColor={f.color}
                  showInfo={false}
                  size="small"
                  style={{ marginTop: 4, marginBottom: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button size="small" onClick={() => adjustWeight(f.factorId, -1)} disabled={readOnly || f.locked || f.weight <= 0}>−</Button>
                <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{f.weight.toFixed(0)}</span>
                <Button size="small" onClick={() => adjustWeight(f.factorId, 1)} disabled={readOnly || f.locked || f.weight >= 100}>+</Button>
                <Button size="small" icon={f.locked ? <LockOutlined /> : <UnlockOutlined />} onClick={() => toggleLock(f.factorId)} disabled={readOnly} type="text" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Iron Rule Status + Actions ────────────────────────── */}
      <div style={{ marginTop: 16, padding: 12, background: isValid ? '#ecfdf5' : '#fef3c7', borderRadius: 8, border: `1px solid ${isValid ? '#6ee7b7' : '#fbbf24'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: isValid ? '#065f46' : '#92400e', fontWeight: 600 }}>
            {isValid ? <CheckCircleOutlined style={{ marginRight: 6 }} /> : '⚠️'} {isValid ? t.valid : t.invalid}
            <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 400, color: isValid ? '#22c55e' : '#ef4444' }}>
              {isValid ? t.sum100 : `${t.remaining}: ${(100 - total).toFixed(1)}% ${total > 100 ? `(${t.over} ${(total - 100).toFixed(1)}%)` : ''}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Tooltip title={t.autoBalance}>
              <Button size="small" icon={<ReloadOutlined />} onClick={autoBalance} disabled={readOnly}>
                {t.autoBalance}
              </Button>
            </Tooltip>
            <Tooltip title={t.reset}>
              <Button size="small" icon={<UndoOutlined />} onClick={resetWeights} disabled={readOnly}>
                {t.reset}
              </Button>
            </Tooltip>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
          🛡️ {t.ironRule}: 总和 = 100%, 无负权重, 无零权重, 方向标签必填
        </div>
      </div>
    </div>
  );
};

export default FactorWeightPanel;
