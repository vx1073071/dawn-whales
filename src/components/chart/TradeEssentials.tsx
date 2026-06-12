// ── R121 PM: 交易标配组件 — 主题切换 + 条件单 + 券商健康 + 资金曲线 + 多股对比 + 现价线 ──
// Owner: 不需要 delegate, PM 一个人做

import { useState, useMemo, useCallback } from 'react';
import { BRAND_COLORS, getSavedTheme, saveTheme, type AppTheme } from '../../lib/chart/brand-colors';
import type { NormalizedSeries } from '../../lib/chart/brand-colors';

// ═══════════════════════════════════════════════════════════════════════
// 1. 深色/浅色主题切换按钮
// ═══════════════════════════════════════════════════════════════════════

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>(getSavedTheme);

  const toggle = useCallback(() => {
    setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; saveTheme(n); return n; });
  }, []);

  return (
    <button onClick={toggle} style={{
      background: 'transparent', border: '1px solid #555', borderRadius: 4,
      color: '#ccc', cursor: 'pointer', padding: '4px 8px', fontSize: 12,
    }}>
      {theme === 'dark' ? '☀️ 浅色' : '🌙 深色'}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. 条件单面板 (止损/止盈/追踪止损/OCO)
// ═══════════════════════════════════════════════════════════════════════

export type OrderType = 'stop_loss' | 'take_profit' | 'trailing_stop' | 'oco';

export interface ConditionalOrder {
  id: string;
  symbol: string;
  brokerId: string;
  type: OrderType;
  side: 'buy' | 'sell';
  qty: number;
  triggerPrice: number;
  limitPrice?: number;
  trailingPct?: number;     // 追踪止损回撤%
  ocoTakeProfit?: number;   // OCO止盈价
  ocoStopLoss?: number;     // OCO止损价
  status: 'active' | 'triggered' | 'cancelled';
  createdAt: number;
}

const ORDER_STORAGE = 'dw_conditional_orders';

export function ConditionalOrderPanel({ symbol, currentPrice, brokerId }: {
  symbol: string; currentPrice: number; brokerId: string;
}) {
  const [orders, setOrders] = useState<ConditionalOrder[]>(() => {
    try { return JSON.parse(localStorage.getItem(ORDER_STORAGE) || '[]'); }
    catch { return []; }
  });
  const [type, setType] = useState<OrderType>('stop_loss');
  const [qty, setQty] = useState('');
  const [trigger, setTrigger] = useState('');
  const [trailing, setTrailing] = useState('5');
  const [ocoTP, setOcoTP] = useState('');
  const [ocoSL, setOcoSL] = useState('');

  const addOrder = useCallback(() => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    const order: ConditionalOrder = {
      id: `co_${Date.now()}`, symbol, brokerId, type, side: 'sell', qty: q,
      triggerPrice: parseFloat(trigger) || 0,
      trailingPct: type === 'trailing_stop' ? parseFloat(trailing) : undefined,
      ocoTakeProfit: type === 'oco' ? parseFloat(ocoTP) : undefined,
      ocoStopLoss: type === 'oco' ? parseFloat(ocoSL) : undefined,
      status: 'active', createdAt: Date.now(),
    };
    const updated = [...orders, order];
    setOrders(updated);
    localStorage.setItem(ORDER_STORAGE, JSON.stringify(updated));
    setQty(''); setTrigger('');
  }, [qty, trigger, type, trailing, ocoTP, ocoSL, orders, symbol, brokerId]);

  const cancelOrder = useCallback((id: string) => {
    const updated = orders.map(o => o.id === id ? { ...o, status: 'cancelled' as const } : o);
    setOrders(updated);
    localStorage.setItem(ORDER_STORAGE, JSON.stringify(updated));
  }, [orders]);

  return (
    <div style={{ padding: 8, color: '#ccc', fontSize: 12, background: '#1a1d2e', borderRadius: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>条件单 — {symbol} @ {currentPrice}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {(['stop_loss', 'take_profit', 'trailing_stop', 'oco'] as OrderType[]).map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            padding: '2px 8px', cursor: 'pointer', fontSize: 11,
            background: type === t ? '#3b82f6' : '#2a2e39', color: '#ccc',
            border: 'none', borderRadius: 4,
          }}>
            {{ stop_loss: '止损', take_profit: '止盈', trailing_stop: '追踪', oco: 'OCO' }[t]}
          </button>
        ))}
      </div>
      <input placeholder="数量" value={qty} onChange={e => setQty(e.target.value)} style={{ width: 80, marginRight: 6, padding: 4, fontSize: 12, background: '#131722', color: '#ccc', border: '1px solid #333', borderRadius: 4 }} />
      <input placeholder="触发价" value={trigger} onChange={e => setTrigger(e.target.value)} style={{ width: 80, marginRight: 6, padding: 4, fontSize: 12, background: '#131722', color: '#ccc', border: '1px solid #333', borderRadius: 4 }} />
      {type === 'trailing_stop' && (
        <input placeholder="回撤%" value={trailing} onChange={e => setTrailing(e.target.value)} style={{ width: 60, marginRight: 6, padding: 4, fontSize: 12, background: '#131722', color: '#ccc', border: '1px solid #333', borderRadius: 4 }} />
      )}
      {type === 'oco' && (
        <>
          <input placeholder="止盈价" value={ocoTP} onChange={e => setOcoTP(e.target.value)} style={{ width: 80, marginRight: 6, padding: 4, fontSize: 12, background: '#131722', color: '#ccc', border: '1px solid #333', borderRadius: 4 }} />
          <input placeholder="止损价" value={ocoSL} onChange={e => setOcoSL(e.target.value)} style={{ width: 80, marginRight: 6, padding: 4, fontSize: 12, background: '#131722', color: '#ccc', border: '1px solid #333', borderRadius: 4 }} />
        </>
      )}
      <button onClick={addOrder} style={{ padding: '4px 12px', background: '#22c55e', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
        下单
      </button>
      {orders.filter(o => o.symbol === symbol && o.brokerId === brokerId && o.status === 'active').length > 0 && (
        <div style={{ marginTop: 8 }}>
          {orders.filter(o => o.symbol === symbol && o.brokerId === brokerId && o.status === 'active').map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222' }}>
              <span style={{ color: o.type === 'stop_loss' ? BRAND_COLORS.down : o.type === 'take_profit' ? BRAND_COLORS.up : '#f59e0b' }}>
                {{ stop_loss: '🛑', take_profit: '💰', trailing_stop: '📉', oco: '🔗' }[o.type]} {o.qty} @ {o.triggerPrice}
              </span>
              <button onClick={() => cancelOrder(o.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>取消</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 3. 券商API健康仪表盘
// ═══════════════════════════════════════════════════════════════════════

export interface BrokerHealthStatus {
  brokerId: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency: number;       // ms
  errorRate: number;      // %
  rateLimit: { used: number; total: number };
  lastHeartbeat: number;
  uptime: number;         // %
}

export function BrokerHealthDashboard({ brokers }: { brokers: BrokerHealthStatus[] }) {
  const [sortBy, setSortBy] = useState<'latency' | 'error' | 'name'>('latency');

  const sorted = useMemo(() => {
    return [...brokers].sort((a, b) => {
      if (sortBy === 'latency') return a.latency - b.latency;
      if (sortBy === 'error') return a.errorRate - b.errorRate;
      return a.name.localeCompare(b.name);
    });
  }, [brokers, sortBy]);

  return (
    <div style={{ padding: 8, color: '#ccc', fontSize: 12, background: '#1a1d2e', borderRadius: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>券商状态
        <span style={{ marginLeft: 12, fontSize: 11 }}>
          {['latency', 'error', 'name'].map(k => (
            <button key={k} onClick={() => setSortBy(k as typeof sortBy)} style={{
              background: sortBy === k ? '#3b82f6' : '#2a2e39', color: '#ccc',
              border: 'none', borderRadius: 3, padding: '2px 6px', marginLeft: 4, cursor: 'pointer', fontSize: 10,
            }}>{{ latency: '延迟', error: '错误率', name: '名称' }[k]}</button>
          ))}
        </span>
      </div>
      {sorted.map(b => (
        <div key={b.brokerId} style={{ display: 'flex', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #222' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, display: 'inline-block', marginRight: 6,
            background: b.status === 'online' ? '#22c55e' : b.status === 'degraded' ? '#f59e0b' : '#ef4444',
          }} />
          <span style={{ width: 80 }}>{b.name}</span>
          <span style={{ width: 50, color: b.latency < 100 ? '#22c55e' : b.latency < 500 ? '#f59e0b' : '#ef4444' }}>{b.latency}ms</span>
          <span style={{ width: 45, color: b.errorRate < 1 ? '#22c55e' : '#f59e0b' }}>{b.errorRate.toFixed(1)}%</span>
          <span style={{ width: 80 }}>{b.rateLimit.used}/{b.rateLimit.total}</span>
          <span style={{ color: b.uptime > 99 ? '#22c55e' : '#f59e0b' }}>{b.uptime.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 4. 资金曲线面板
// ═══════════════════════════════════════════════════════════════════════

import type { PnLPoint } from '../../lib/chart/brand-colors';
import { computePnLStats } from '../../lib/chart/brand-colors';

export function EquityCurvePanel({ curve }: { curve: PnLPoint[] }) {
  const stats = useMemo(() => computePnLStats(curve), [curve]);
  if (curve.length === 0) return null;

  const h = 120, w = 300;
  const maxVal = Math.max(...curve.map(p => p.equity), 1);
  const minVal = Math.min(...curve.map(p => p.equity), 0);
  const range = maxVal - minVal || 1;
  const points = curve.map((p, i) => `${(i / (curve.length - 1)) * w},${h - ((p.equity - minVal) / range) * h}`).join(' ');

  return (
    <div style={{ padding: 8, color: '#ccc', fontSize: 12, background: '#1a1d2e', borderRadius: 8 }}>
      <div style={{ fontWeight: 700 }}>资金曲线</div>
      <svg width={w} height={h} style={{ margin: '4px 0' }}>
        <polyline points={points} fill="none" stroke={stats.totalReturn >= 0 ? '#ef4444' : '#22c55e'} strokeWidth={1.5} />
        <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="#333" strokeDasharray="2,2" />
      </svg>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: stats.totalReturn >= 0 ? '#ef4444' : '#22c55e' }}>收益 {stats.totalReturn.toFixed(2)}%</span>
        <span>回撤 {stats.maxDrawdown.toFixed(1)}%</span>
        <span>夏普 {stats.sharpeRatio.toFixed(2)}</span>
        <span>胜率 {stats.winRate.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 5. 多股对比面板
// ═══════════════════════════════════════════════════════════════════════

export function MultiComparePanel({ series }: { series: NormalizedSeries[] }) {
  if (series.length === 0) return null;

  return (
    <div style={{ padding: 8, color: '#ccc', fontSize: 12, background: '#1a1d2e', borderRadius: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>多股对比 (归一化100)</div>
      {series.map(s => (
        <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', marginRight: 6, background: s.color }} />
          <span style={{ flex: 1 }}>{s.name}</span>
          <span style={{ color: s.changePct >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
            {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 6. 买卖打点 + 成本线 + 现价线 配置 (供 KLineChartPro 使用)
// ═══════════════════════════════════════════════════════════════════════

export interface TradeMarker {
  time: number;
  price: number;
  side: 'buy' | 'sell';
  size: number;
  text?: string;
}

export interface PositionLines {
  /** 成本线(均价) */
  costBasis: number;
  /** 现价线 */
  currentPrice: number;
  /** 盈亏百分比 */
  pnlPct: number;
  /** 买卖标记点 */
  markers: TradeMarker[];
}

/** 生成K线图叠加数据 (供 lightweight-charts markers API) */
export function buildTradeMarkers(markers: TradeMarker[]) {
  return markers.map(m => ({
    time: (m.time / 1000) as import('lightweight-charts').Time,
    position: m.side === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
    color: m.side === 'buy' ? '#ef4444' : '#22c55e',
    shape: m.side === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
    text: m.text || `${m.size}`,
    size: 2,
  }));
}

/** 成本线 / 现价线 生成 (水平线数据) */
export function buildPositionLines(pos: PositionLines) {
  return [
    {
      price: pos.costBasis,
      color: '#a78bfa',
      lineWidth: 1,
      lineStyle: 2, // dashed
      axisLabelVisible: true,
      title: `成本 ¥${pos.costBasis.toFixed(2)}`,
    },
    {
      price: pos.currentPrice,
      color: BRAND_COLORS.neutral,
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: `现价 ¥${pos.currentPrice.toFixed(2)}`,
    },
  ];
}
