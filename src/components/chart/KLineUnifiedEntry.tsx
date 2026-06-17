import { useState, useCallback, useEffect } from 'react';

// ── K-line Unified Entry + Shortcut System ── ML#3+ML#4 R271 (7h)
// Combined: unified K-line wrapper + global keyboard shortcuts

type TimeFrame = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

interface KLineUnifiedEntryProps {
  symbol: string;
  defaultTimeframe?: TimeFrame;
}

// ── Global Shortcut Registry ──
const SHORTCUTS = [
  // Tab switching
  { key: '1', action: 'switchTab', target: 'kline', label: 'K线' },
  { key: '2', action: 'switchTab', target: 'tick', label: '分时图' },
  { key: '3', action: 'switchTab', target: 'footprint', label: '脚印图' },
  { key: '4', action: 'switchTab', target: 'dom', label: 'DOM' },
  { key: '5', action: 'switchTab', target: 'volume', label: '成交量' },
  { key: '6', action: 'switchTab', target: 'indicators', label: '指标' },
  { key: '7', action: 'switchTab', target: 'drawing', label: '画线' },
  { key: '8', action: 'switchTab', target: 'ai', label: 'AI' },
  // Timeframe
  { key: 'q', action: 'timeframe', target: '1m', label: '1分钟' },
  { key: 'w', action: 'timeframe', target: '5m', label: '5分钟' },
  { key: 'e', action: 'timeframe', target: '15m', label: '15分钟' },
  { key: 'r', action: 'timeframe', target: '1h', label: '1小时' },
  { key: 't', action: 'timeframe', target: '4h', label: '4小时' },
  { key: 'd', action: 'reset', target: '', label: '重置视图' },
  // Drawing tools
  { key: 'h', action: 'drawing', target: 'horiz_line', label: '水平线' },
  { key: 'f', action: 'drawing', target: 'fib_retrace', label: '斐波回撤' },
  { key: 'g', action: 'drawing', target: 'gann_fan', label: '江恩扇' },
  { key: 'l', action: 'toggleL2', target: '', label: 'L2订单簿' },
  { key: 'o', action: 'order', target: '', label: '下单面板' },
  { key: 's', action: 'splitView', target: '', label: '分屏' },
  { key: 'c', action: 'crosshair', target: '', label: '十字线' },
  { key: 'z', action: 'undo', target: '', label: '撤销画线' },
  { key: 'y', action: 'redo', target: '', label: '重做画线' },
  // Navigation
  { key: 'ArrowLeft', action: 'prevPeriod', target: '', label: '上一周期' },
  { key: 'ArrowRight', action: 'nextPeriod', target: '', label: '下一周期' },
  { key: 'ArrowUp', action: 'zoomIn', target: '', label: '放大' },
  { key: 'ArrowDown', action: 'zoomOut', target: '', label: '缩小' },
  { key: 'Escape', action: 'escape', target: '', label: '取消/关闭' },
  { key: ' ', action: 'play', target: '', label: '播放/暂停' },
];

const KLineUnifiedEntry = ({ symbol, defaultTimeframe = '1D' }: KLineUnifiedEntryProps) => {
  const [timeframe, setTimeframe] = useState<TimeFrame>(defaultTimeframe);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastAction, setLastAction] = useState('');
  const [chartMode, setChartMode] = useState<'candle' | 'line' | 'area' | 'heikin'>('candle');
  const [showL2, setShowL2] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [splitView, setSplitView] = useState(false);

  const timeframes: TimeFrame[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M'];

  const handleShortcut = useCallback((e: KeyboardEvent) => {
    const sc = SHORTCUTS.find(s => s.key.toLowerCase() === e.key.toLowerCase());
    if (!sc) return;
    e.preventDefault();

    switch (sc.action) {
      case 'switchTab':
        setLastAction(`切换到: ${sc.label}`); break;
      case 'timeframe':
        setTimeframe(sc.target as TimeFrame);
        setLastAction(`周期: ${sc.target}`); break;
      case 'reset':
        setLastAction('重置视图'); break;
      case 'drawing':
        setLastAction(`画线: ${sc.label}`); break;
      case 'toggleL2':
        setShowL2(!showL2); setLastAction(showL2 ? '关闭L2' : '打开L2'); break;
      case 'order':
        setShowOrder(!showOrder); setLastAction(showOrder ? '关闭下单' : '打开下单'); break;
      case 'splitView':
        setSplitView(!splitView); setLastAction(splitView ? '单屏' : '分屏'); break;
      case 'crosshair':
        setLastAction('十字线'); break;
      case 'undo': setLastAction('撤销'); break;
      case 'redo': setLastAction('重做'); break;
      case 'play': setLastAction('播放/暂停'); break;
      case 'escape':
        setShowL2(false); setShowOrder(false); setShowShortcuts(false);
        setLastAction('Esc'); break;
      default:
        setLastAction(sc.label || sc.action);
    }
  }, [showL2, showOrder, splitView, showShortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleShortcut]);

  return (
    <div style={{ fontFamily: 'system-ui', fontSize: 12, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: '#f8fafc', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap',
      }}>
        {/* Symbol */}
        <span style={{ fontWeight: 700, fontSize: 14 }}>{symbol}</span>

        {/* Timeframe */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 12 }}>
          {timeframes.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 9, cursor: 'pointer',
              background: timeframe === tf ? '#3b82f6' : '#f1f5f9',
              color: timeframe === tf ? 'white' : '#64748b',
              fontWeight: timeframe === tf ? 600 : 400,
            }}>{tf}</button>
          ))}
        </div>

        {/* Chart Mode */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 8, borderLeft: '1px solid #e5e7eb', paddingLeft: 8 }}>
          {[
            { key: 'candle' as const, icon: '🕯', label: '蜡烛' },
            { key: 'line' as const, icon: '📈', label: '折线' },
            { key: 'area' as const, icon: '📊', label: '面积' },
            { key: 'heikin' as const, icon: '🕯', label: 'Heikin' },
          ].map(m => (
            <button key={m.key} onClick={() => setChartMode(m.key)} style={{
              padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 9, cursor: 'pointer',
              background: chartMode === m.key ? '#64748b' : '#f1f5f9',
              color: chartMode === m.key ? 'white' : '#64748b',
            }} title={m.label}>{m.icon}</button>
          ))}
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, borderLeft: '1px solid #e5e7eb', paddingLeft: 8 }}>
          <button onClick={() => setShowL2(!showL2)} style={{
            padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 9, cursor: 'pointer',
            background: showL2 ? '#3b82f6' : '#f1f5f9', color: showL2 ? 'white' : '#64748b',
          }}>📖 L2</button>
          <button onClick={() => setShowOrder(!showOrder)} style={{
            padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 9, cursor: 'pointer',
            background: showOrder ? '#22c55e' : '#f1f5f9', color: showOrder ? 'white' : '#64748b',
          }}>💳 下单</button>
          <button onClick={() => setSplitView(!splitView)} style={{
            padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 9, cursor: 'pointer',
            background: splitView ? '#f59e0b' : '#f1f5f9', color: splitView ? 'white' : '#64748b',
          }}>🖥 分屏</button>
        </div>

        {/* Shortcut hint */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {lastAction && (
            <span style={{ fontSize: 9, color: '#94a3b8', animation: 'fadeOut 2s' }}>
              {lastAction}
            </span>
          )}
          <button onClick={() => setShowShortcuts(!showShortcuts)} style={{
            padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 9, cursor: 'pointer',
            background: showShortcuts ? '#64748b' : '#f1f5f9', color: showShortcuts ? 'white' : '#64748b',
          }}>⌨</button>
        </div>
      </div>

      {/* Shortcut Cheatsheet */}
      {showShortcuts && (
        <div style={{
          padding: 8, background: '#1e293b', color: '#f1f5f9',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 4, fontSize: 10,
        }}>
          {SHORTCUTS.map((sc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 4px' }}>
              <span style={{ opacity: 0.5 }}>{sc.label}</span>
              <kbd style={{
                background: '#334155', padding: '0 4px', borderRadius: 2, fontSize: 9,
                fontFamily: 'monospace',
              }}>{sc.key === ' ' ? 'SPACE' : sc.key}</kbd>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{
        flex: 1, display: 'flex', background: '#0f172a',
        alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8', fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div>{symbol} · {timeframe} · {chartMode}</div>
          <div style={{ marginTop: 8, fontSize: 11 }}>
            {showShortcuts ? '快捷键面板已打开' : '按 ⌨ 查看快捷键'}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '4px 12px',
        background: '#f8fafc', borderTop: '1px solid #e5e7eb', fontSize: 9, color: '#64748b',
      }}>
        <span>TF: {timeframe} | 模式: {chartMode}</span>
        <span>L2: {showL2 ? 'ON' : 'OFF'} | 下单: {showOrder ? 'ON' : 'OFF'} | 分屏: {splitView ? 'ON' : 'OFF'}</span>
        <span>QUANT MOO v3.1</span>
      </div>
    </div>
  );
};

export { SHORTCUTS };
export default KLineUnifiedEntry;
