// ── R218 ML P2: ParamSensitivityHeatmap — 参数敏感性热力图UI ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// L9: Heatmap showing parameter sensitivity to overfitting
// 2D grid: X = parameter A, Y = parameter B, color = backtest Sharpe/sharpe
// Cells with overfit >0.5 highlighted in red
// 9-language i18n + color-coded legend + hover tooltips

import React, { useState, useMemo } from 'react';
import { Tooltip } from 'antd';

export interface SensitivityCell {
  paramA: number;  // X axis
  paramB: number;  // Y axis
  sharpe: number;
  returns: number;  // %
  overfitScore: number;  // 0-1
  isOptimal?: boolean;
}

interface ParamSensitivityHeatmapProps {
  cells?: SensitivityCell[];
  paramAName?: string;
  paramBName?: string;
  paramARange?: [number, number]; // [min, max]
  paramBRange?: [number, number];
  onCellClick?: (cell: SensitivityCell) => void;
  locale?: string;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '🔥 参数敏感性热力图',
    subtitle: '网格搜索展示参数对夏普/过拟合的影响,红色=危险',
    legend: '图例', optimal: '最优', safe: '安全', warn: '警告', danger: '危险',
    overfit: '过拟合', returns: '年化', sharpe: '夏普',
    safeZone: '安全区(过拟合<0.4)', warnZone: '警告区(0.4~0.7)', dangerZone: '危险区(>0.7)',
    paramX: '参数 X', paramY: '参数 Y', current: '当前', clickHint: '👆 点击单元格应用参数',
  },
  en: {
    title: '🔥 Parameter Sensitivity Heatmap',
    subtitle: 'Grid search shows parameter impact on Sharpe/overfit, red=danger',
    legend: 'Legend', optimal: 'Optimal', safe: 'Safe', warn: 'Warn', danger: 'Danger',
    overfit: 'Overfit', returns: 'Returns', sharpe: 'Sharpe',
    safeZone: 'Safe (<0.4)', warnZone: 'Warn (0.4-0.7)', dangerZone: 'Danger (>0.7)',
    paramX: 'Param X', paramY: 'Param Y', current: 'Current', clickHint: '👆 Click cell to apply',
  },
  ja: { title: '🔥 パラメータ感度ヒートマップ', subtitle: 'グリッド検索, 赤=危険', legend: '凡例', optimal: '最適', safe: '安全', warn: '警告', danger: '危険', overfit: '過学習', returns: 'リターン', sharpe: 'シャープ', safeZone: '安全(<0.4)', warnZone: '警告(0.4-0.7)', dangerZone: '危険(>0.7)', paramX: 'パラX', paramY: 'パラY', current: '現在', clickHint: '👆 クリックで適用' },
  ko: { title: '🔥 매개변수 민감도 히트맵', subtitle: '그리드 검색, 빨강=위험', legend: '범례', optimal: '최적', safe: '안전', warn: '경고', danger: '위험', overfit: '과적합', returns: '수익률', sharpe: '샤프', safeZone: '안전(<0.4)', warnZone: '경고(0.4-0.7)', dangerZone: '위험(>0.7)', paramX: '매개X', paramY: '매개Y', current: '현재', clickHint: '👆 클릭하여 적용' },
  fr: { title: '🔥 Heatmap Sensibilité', subtitle: 'Grid search, rouge=danger', legend: 'Légende', optimal: 'Optimal', safe: 'Sûr', warn: 'Averti', danger: 'Danger', overfit: 'Surapprentissage', returns: 'Rendement', sharpe: 'Sharpe', safeZone: 'Sûr (<0.4)', warnZone: 'Averti (0.4-0.7)', dangerZone: 'Danger (>0.7)', paramX: 'Param X', paramY: 'Param Y', current: 'Actuel', clickHint: '👆 Cliquer pour appliquer' },
  it: { title: '🔥 Heatmap Sensibilità', subtitle: 'Grid search, rosso=pericolo', legend: 'Legenda', optimal: 'Ottimale', safe: 'Sicuro', warn: 'Avviso', danger: 'Pericolo', overfit: 'Overfit', returns: 'Rendimento', sharpe: 'Sharpe', safeZone: 'Sicuro (<0.4)', warnZone: 'Avviso (0.4-0.7)', dangerZone: 'Pericolo (>0.7)', paramX: 'Param X', paramY: 'Param Y', current: 'Attuale', clickHint: '👆 Clicca per applicare' },
  de: { title: '🔥 Parameter-Sensitivität', subtitle: 'Grid-Suche, rot=Gefahr', legend: 'Legende', optimal: 'Optimal', safe: 'Sicher', warn: 'Warnung', danger: 'Gefahr', overfit: 'Overfit', returns: 'Rendite', sharpe: 'Sharpe', safeZone: 'Sicher (<0.4)', warnZone: 'Warnung (0.4-0.7)', dangerZone: 'Gefahr (>0.7)', paramX: 'Param X', paramY: 'Param Y', current: 'Aktuell', clickHint: '👆 Klicken zum Anwenden' },
  es: { title: '🔥 Mapa de Sensibilidad', subtitle: 'Búsqueda en cuadrícula, rojo=peligro', legend: 'Leyenda', optimal: 'Óptimo', safe: 'Seguro', warn: 'Aviso', danger: 'Peligro', overfit: 'Sobreajuste', returns: 'Retorno', sharpe: 'Sharpe', safeZone: 'Seguro (<0.4)', warnZone: 'Aviso (0.4-0.7)', dangerZone: 'Peligro (>0.7)', paramX: 'Param X', paramY: 'Param Y', current: 'Actual', clickHint: '👆 Clic para aplicar' },
};

function cellColor(score: number): string {
  if (score < 0.4) return `rgba(34, 197, 94, ${0.3 + score * 0.5})`;
  if (score < 0.7) return `rgba(245, 158, 11, ${0.4 + (score - 0.4) * 1.5})`;
  return `rgba(239, 68, 68, ${0.5 + Math.min(0.5, (score - 0.7) * 1.5)})`;
}

function sharpeColor(sharpe: number): string {
  if (sharpe >= 2) return '#22c55e';
  if (sharpe >= 1.5) return '#84cc16';
  if (sharpe >= 1) return '#f59e0b';
  if (sharpe >= 0.5) return '#fb923c';
  return '#ef4444';
}

function generateDemoCells(rows: number, cols: number, xRange: [number, number], yRange: [number, number]): SensitivityCell[] {
  const cells: SensitivityCell[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const paramA = xRange[0] + (j / (cols - 1)) * (xRange[1] - xRange[0]);
      const paramB = yRange[1] - (i / (rows - 1)) * (yRange[1] - yRange[0]);
      // Simulate: peak at moderate values, drop at extremes
      const ax = (paramA - 5) / 5;
      const ay = (paramB - 5) / 5;
      const dist = Math.sqrt(ax * ax + ay * ay);
      const sharpe = Math.max(0, 2.5 - dist * 0.4 + (Math.random() - 0.5) * 0.4);
      const returns = Math.max(0, 18 - dist * 3 + (Math.random() - 0.5) * 4);
      // Overfit: low at moderate, high at extreme
      const overfit = Math.min(1, Math.max(0, dist * 0.4 + (Math.random() - 0.5) * 0.1));
      cells.push({
        paramA: Math.round(paramA * 10) / 10,
        paramB: Math.round(paramB * 10) / 10,
        sharpe: Math.round(sharpe * 100) / 100,
        returns: Math.round(returns * 10) / 10,
        overfitScore: Math.round(overfit * 100) / 100,
        isOptimal: dist < 0.5 && overfit < 0.3,
      });
    }
  }
  return cells;
}

const ParamSensitivityHeatmap: React.FC<ParamSensitivityHeatmapProps> = ({
  cells: propCells, paramAName = 'stopLossPct', paramBName = 'takeProfitPct',
  paramARange = [1, 10], paramBRange = [5, 30], onCellClick, locale: pl,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  const cells = useMemo(() => propCells ?? generateDemoCells(8, 8, paramARange, paramBRange), [propCells, paramARange, paramBRange]);
  const [hovered, setHovered] = useState<SensitivityCell | null>(null);

  // Group cells by Y (row) for rendering
  const uniqueYs = useMemo(() => Array.from(new Set(cells.map(c => c.paramB))).sort((a, b) => b - a), [cells]);
  const uniqueXs = useMemo(() => Array.from(new Set(cells.map(c => c.paramA))).sort((a, b) => a - b), [cells]);

  const getCell = (x: number, y: number) => cells.find(c => c.paramA === x && c.paramB === y);

  const optimal = useMemo(() => cells.find(c => c.isOptimal), [cells]);

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

      {/* ── Heatmap ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, marginBottom: 16 }}>
        {/* Y axis label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, color: '#64748b' }}>
            {paramBName} {t.paramY}
          </span>
        </div>

        <div>
          {/* Heatmap grid */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${uniqueXs.length}, 1fr)`, gap: 2, marginBottom: 4 }}>
            {uniqueXs.map(x => (
              <div key={x} style={{ textAlign: 'center', fontSize: 9, color: '#94a3b8' }}>{x}</div>
            ))}
          </div>
          {uniqueYs.map(y => (
            <div key={y} style={{ display: 'grid', gridTemplateColumns: `repeat(${uniqueXs.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
              {uniqueXs.map(x => {
                const cell = getCell(x, y);
                if (!cell) return <div key={x} />;
                return (
                  <Tooltip
                    key={x}
                    title={
                      <div>
                        <div>{paramAName}={x}, {paramBName}={y}</div>
                        <div>📊 Sharpe: {cell.sharpe}</div>
                        <div>📈 Returns: {cell.returns}%</div>
                        <div>{cell.overfitScore > 0.7 ? '🚨 ' : cell.overfitScore > 0.4 ? '⚠️ ' : '✅ '}Overfit: {(cell.overfitScore * 100).toFixed(0)}%</div>
                      </div>
                    }
                  >
                    <div
                      onClick={() => onCellClick?.(cell)}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        aspectRatio: '1', background: cellColor(cell.overfitScore),
                        borderRadius: 3, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        border: cell.isOptimal ? '2px solid #22c55e' : '1px solid #e2e8f0',
                        position: 'relative', padding: 2,
                        transition: 'transform 0.1s',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: sharpeColor(cell.sharpe) }}>
                        {cell.sharpe.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 8, color: '#1e293b' }}>{cell.returns.toFixed(0)}%</div>
                      {cell.isOptimal && <div style={{ position: 'absolute', top: 1, right: 1, fontSize: 8 }}>⭐</div>}
                      {cell.overfitScore > 0.7 && <div style={{ position: 'absolute', bottom: 1, right: 1, fontSize: 8 }}>🚨</div>}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ))}
          {/* X axis label */}
          <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 8 }}>
            {paramAName} {t.paramX}
          </div>
        </div>
      </div>

      {/* ── Legend + Optimal Info ───────────────────────────────── */}
      <div style={{
        background: '#f8fafc', borderRadius: 8, padding: 12,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        fontSize: 11,
      }}>
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>⭐ {t.optimal}</div>
          <div style={{ color: '#22c55e' }}>
            {optimal ? `${paramAName}=${optimal.paramA}, ${paramBName}=${optimal.paramB}` : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>✅ {t.safe}</div>
          <div style={{ color: '#64748b' }}>{t.safeZone}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>⚠️ {t.warn}</div>
          <div style={{ color: '#64748b' }}>{t.warnZone}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>🚨 {t.danger}</div>
          <div style={{ color: '#64748b' }}>{t.dangerZone}</div>
        </div>
      </div>

      {/* ── Hover Detail ────────────────────────────────────────── */}
      {hovered && (
        <div style={{ marginTop: 12, padding: 10, background: '#f0f9ff', borderRadius: 8, fontSize: 11 }}>
          <strong style={{ color: '#0369a1' }}>📊 {paramAName}={hovered.paramA}, {paramBName}={hovered.paramB}</strong>
          <div style={{ marginTop: 4, color: '#0c4a6e' }}>
            Sharpe: <strong style={{ color: sharpeColor(hovered.sharpe) }}>{hovered.sharpe}</strong> · Returns: <strong>{hovered.returns}%</strong> · Overfit: <strong style={{ color: hovered.overfitScore > 0.7 ? '#ef4444' : hovered.overfitScore > 0.4 ? '#f59e0b' : '#22c55e' }}>{(hovered.overfitScore * 100).toFixed(0)}%</strong>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>{t.clickHint}</div>
    </div>
  );
};

export default ParamSensitivityHeatmap;
