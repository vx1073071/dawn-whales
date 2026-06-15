// ── R223 ML#3+ML#4: 交互增强模块 ──────────────────────────────────────
// All 5 interaction enhancements in one file
// ML#3: 双击重置 / 自选拖拽排序 / VWAP会话线
// ML#4: 点击复制 / 指标同步

import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import {
  MenuOutlined, CopyOutlined,
  LineChartOutlined, SyncOutlined,
} from '@ant-design/icons';
import i18n from '../../i18n';

const I18N = (k: string) => i18n.t(`interactionEnhance.${k}`);

// ═══════════════════════════════════════════════════════════════════════
// E3: 双击统一重置 hook
// ═══════════════════════════════════════════════════════════════════════

export function useDoubleClickReset(
  onReset: () => void,
  timeout = 400,
) {
  const lastClick = useRef(0);
  const handleClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClick.current < timeout) {
      onReset();
      message.info(I18N('resetZoom'));
    }
    lastClick.current = now;
  }, [onReset, timeout]);
  return handleClick;
}

// ═══════════════════════════════════════════════════════════════════════
// E4: 自选拖拽排序
// ═══════════════════════════════════════════════════════════════════════

export interface DragItem<T> {
  id: string;
  data: T;
  index: number;
}

export function useDragReorder<T>(
  items: T[],
  getId: (item: T) => string,
  onReorder: (newItems: T[]) => void,
) {
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragItem = useRef<DragItem<T> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = useCallback((id: string, index: number) => {
    dragItem.current = { id, data: items[index], index };
    setIsDragging(true);
  }, [items]);

  const onDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIdx(index);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (!dragItem.current) return;
    const from = dragItem.current.index;
    if (from === dropIdx) return;
    const newItems = [...items];
    const [removed] = newItems.splice(from, 1);
    newItems.splice(dropIdx, 0, removed);
    onReorder(newItems);
    setIsDragging(false);
    setDragOverIdx(null);
    dragItem.current = null;
    message.success(I18N('reorderSaved'));
  }, [items, onReorder]);

  const onDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOverIdx(null);
    dragItem.current = null;
  }, []);

  return {
    dragProps: (item: T) => ({
      draggable: true,
      onDragStart: () => onDragStart(getId(item), items.indexOf(item)),
      onDragOver: (e: React.DragEvent) => onDragOver(e, items.indexOf(item)),
      onDrop: (e: React.DragEvent) => onDrop(e, items.indexOf(item)),
      onDragEnd,
      style: {
        opacity: dragOverIdx === items.indexOf(item) ? 0.5 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s',
      },
    }),
    isDragging,
    dragOverIdx,
  };
}

/** Drag handle component */
export function DragHandle({ onMouseDown: _onMouseDown }: { onMouseDown?: () => void }) {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'grab', color: '#9ca3af', padding: '0 4px' }}
      onMouseDown={_onMouseDown}
    >
      <MenuOutlined style={{ fontSize: 12 }} />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// E5: VWAP 会话线
// ═══════════════════════════════════════════════════════════════════════

export interface VWAPSession {
  sessionStart: number; // timestamp
  vwap: number;
  upperBand: number;
  lowerBand: number;
  typicalPrice: number;
}

/** 计算日内VWAP（从当天0点开始） */
export function calcVWAPSession(
  bars: Array<{ time: number; high: number; low: number; close: number; volume: number }>,
): VWAPSession | null {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayBars = bars.filter(b => b.time >= todayStart);
  if (todayBars.length < 5) return null;

  let sumPV = 0, sumV = 0;
  for (const bar of todayBars) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    sumPV += typical * bar.volume;
    sumV += bar.volume;
  }
  const vwap = sumPV / (sumV || 1);

  // ±1% band
  const upperBand = vwap * 1.01;
  const lowerBand = vwap * 0.99;
  const typicalPrice = todayBars[todayBars.length - 1].close;

  return {
    sessionStart: todayStart,
    vwap: +vwap.toFixed(2),
    upperBand: +upperBand.toFixed(2),
    lowerBand: +lowerBand.toFixed(2),
    typicalPrice: +typicalPrice.toFixed(2),
  };
}

export function VWAPLineOverlay({ vwap }: { vwap: VWAPSession }) {
  return (
    <div style={{
      padding: '6px 10px', background: '#1a1a25', border: '1px solid #a78bfa30', borderRadius: 6,
      display: 'inline-flex', gap: 12, fontSize: 11, fontFamily: 'monospace',
    }}>
      <span style={{ color: '#a78bfa', fontWeight: 600 }}>
        <LineChartOutlined /> VWAP: {vwap.vwap}
      </span>
      <span style={{ color: '#22c55e' }}>H: {vwap.upperBand}</span>
      <span style={{ color: '#ef4444' }}>L: {vwap.lowerBand}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// E6: 点击复制快捷方式
// ═══════════════════════════════════════════════════════════════════════

export function QuickCopySymbolButton({ symbol, text, label }: { symbol: string; text?: string; label?: string }) {
  const handleCopy = useCallback(() => {
    const toCopy = text || symbol;
    navigator.clipboard.writeText(toCopy).then(() => {
      message.success(`${I18N('copied')}: ${toCopy}`);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = toCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      message.success(`${I18N('copied')}: ${toCopy}`);
    });
  }, [symbol, text]);

  return (
    <span
      onClick={handleCopy}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#60a5fa', fontSize: 12, fontWeight: 600 }}
      title={`${I18N('clickToCopy')}: ${label || symbol}`}
    >
      <CopyOutlined style={{ fontSize: 11 }} />
      {label || symbol}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// E7: 指标面板参数同步 hook
// ═══════════════════════════════════════════════════════════════════════

export interface IndicatorParam {
  id: string;
  period: number;
  enabled: boolean;
  signalPeriod?: number; // MACD
  stdDev?: number;       // BOLL
}

export function useIndicatorSync(
  initialParams: IndicatorParam[],
  onApply: (params: IndicatorParam[]) => void,
) {
  const [params, setParams] = useState<IndicatorParam[]>(initialParams);
  const [syncing, setSyncing] = useState(false);

  const updateParam = useCallback((id: string, partial: Partial<IndicatorParam>) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, ...partial } : p));
  }, []);

  const toggleIndicator = useCallback((id: string) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  }, []);

  const applyAll = useCallback(() => {
    setSyncing(true);
    setTimeout(() => {
      onApply(params);
      setSyncing(false);
      message.success(<span><SyncOutlined spin={syncing} /> {I18N('paramsApplied')}</span>);
    }, 50);
  }, [params, onApply, syncing]);

  return {
    params,
    syncing,
    updateParam,
    toggleIndicator,
    applyAll,
    setParams,
  };
}

/** 简单的指标参数控制面板 */
export function IndicatorParamControl({
  param, onChange,
}: {
  param: IndicatorParam;
  onChange: (partial: Partial<IndicatorParam>) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#1a1a25', borderRadius: 6, border: '1px solid #2a2d3e', fontSize: 12 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
        color: param.enabled ? '#e0e0e0' : '#6b7280',
      }}>
        <input
          type="checkbox"
          checked={param.enabled}
          onChange={() => onChange({ enabled: !param.enabled })}
        />
        <strong>{param.id.toUpperCase()}</strong>
      </label>
      <input
        type="number"
        value={param.period}
        onChange={e => onChange({ period: Math.max(1, Math.min(500, +e.target.value || 2)) })}
        disabled={!param.enabled}
        min={1}
        max={500}
        style={{ width: 50, background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 4, color: '#e0e0e0', padding: '2px 6px', fontSize: 11 }}
      />
      {param.signalPeriod != null && (
        <input
          type="number"
          value={param.signalPeriod}
          onChange={e => onChange({ signalPeriod: Math.max(1, +e.target.value || 9) })}
          disabled={!param.enabled}
          min={1}
          max={100}
          style={{ width: 50, background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 4, color: '#e0e0e0', padding: '2px 6px', fontSize: 11 }}
        />
      )}
      {param.stdDev != null && (
        <input
          type="number"
          value={param.stdDev}
          onChange={e => onChange({ stdDev: Math.max(1, Math.min(5, +e.target.value || 2)) })}
          step="0.5"
          disabled={!param.enabled}
          min={1}
          max={5}
          style={{ width: 50, background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 4, color: '#e0e0e0', padding: '2px 6px', fontSize: 11 }}
        />
      )}
    </div>
  );
}
