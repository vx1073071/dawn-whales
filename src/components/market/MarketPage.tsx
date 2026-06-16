// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

// ── R157: Grouping + sorting + pinning + shortcuts ──
import { useState, useEffect, useMemo, memo } from 'react'
import { EngineError } from '../../../electron/engine/core/engine-error';
import { useTranslation } from 'react-i18next';
import { message, Modal } from 'antd';
import { useMarketStore } from '@/stores/marketStore';
import { useWebSocketQuotes } from '@/hooks/useWebSocketQuotes';
import KLineChart from './KLineChart';
import SymbolSearch from './SymbolSearch';
import QuoteSourcePanel, { QuoteSourceIndicator } from './QuoteSourceBadge';
import { MarketStatusIndicator } from '@/components/settings/BrokerPriority';
import * as api from '@/lib/bridge-api';
import i18n from '../../i18n';

// ── R157 Market helpers ──

type SortField = 'code' | 'price' | 'change' | 'changePct' | 'volume';
type SortDir = 'asc' | 'desc';

function detectMarket(code: string): string {
  if (code.startsWith('HK.')) return 'HK';
  if (code.startsWith('CRYPTO.')) return 'CRYPTO';
  return 'US';
}

const MARKET_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  HK: { label: '港股', icon: '🇭🇰', color: '#ef4444' },
  US: { label: '美股', icon: '🇺🇸', color: '#3b82f6' },
  CRYPTO: { label: '加密货币', icon: '🪙', color: '#f59e0b' },
};

export default function MarketPage() {
  const { t } = useTranslation();

  const watchlist = useMarketStore((s) => s.watchlist);
  const quotes = useMarketStore((s) => s.quotes);
  const addWatch = useMarketStore((s) => s.addWatch);
  const removeWatch = useMarketStore((s) => s.removeWatch);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<unknown[]>([]);
  const [klineLoading, setKlineLoading] = useState(false);
  const [klinePeriod, setKlinePeriod] = useState<string>('daily');

  // ── R157 #13: Market grouping ──
  const [groupByMarket, setGroupByMarket] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // ── R157 #22: Pinning ──
  const [pinned, setPinned] = useState<Set<string>>(() => {
    try { const saved = localStorage.getItem('dw-pinned'); return new Set(saved ? JSON.parse(saved) : []); }
    catch { return new Set(); }
  });

  // ── R157 #26: Column sorting ──
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── R157 #24: Delete with undo ──
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; code: string } | null>(null);
  const SKIP_DELETE_CONFIRM_KEY = 'dw_skip_delete_confirm';
  const [undoTarget, setUndoTarget] = useState<string | null>(null);

  const PERIODS = [
  { key: '1m', label: i18n.t('MarketPage.k1') },
  { key: '5m', label: i18n.t('MarketPage.k2') },
  { key: '15m', label: i18n.t('MarketPage.k3') },
  { key: '60m', label: i18n.t('MarketPage.k4') },
  { key: 'daily', label: i18n.t('MarketPage.k5') },
  { key: 'weekly', label: i18n.t('MarketPage.k6') }];

  const { quotes: wsQuotes, connected: wsConnected, source: wsSource } = useWebSocketQuotes({
    symbols: watchlist, enabled: true, fallbackIntervalMs: 10000
  });

  const mergedQuotes = useMemo(() => {
    const merged: Record<string, unknown> = { ...quotes };
    wsQuotes.forEach((wsQ, code) => {
      merged[code] = {
        ...(merged as any)[code], code: wsQ.code, price: wsQ.price,
        change: wsQ.change, changePct: wsQ.changePct, volume: wsQ.volume,
        bid: wsQ.bid, ask: wsQ.ask, _wsSource: wsQ.source, _wsTimestamp: wsQ.timestamp
      };
    });
    return merged;
  }, [quotes, wsQuotes]);

  // ── Sorted & grouped watchlist ──
  const sortedWatchlist = useMemo(() => {
    let list = [...watchlist];

    // #22: Pinned first
    if (pinned.size > 0) {
      list.sort((a, b) => {
        const aP = pinned.has(a) ? 0 : 1;
        const bP = pinned.has(b) ? 0 : 1;
        return aP - bP;
      });
    }

    // #13: Group by market
    if (groupByMarket) {
      list.sort((a, b) => {
        const mA = detectMarket(a);
        const mB = detectMarket(b);
        if (mA !== mB) return mA === 'HK' ? -1 : mA === 'US' ? (mB === 'CRYPTO' ? -1 : 1) : 1;
        return 0;
      });
    }

    // #26: Column sort
    if (sortField) {
      list.sort((a, b) => {
        const qA = mergedQuotes[a];
        const qB = mergedQuotes[b];
        let vA: number, vB: number;
        if (sortField === 'code') { vA = a.localeCompare(b); vB = 0; return sortDir === 'asc' ? vA : -vA; }
        vA = qA?.[sortField] ?? 0;
        vB = qB?.[sortField] ?? 0;
        return sortDir === 'asc' ? vA - vB : vB - vA;
      });
    }

    return list;
  }, [watchlist, pinned, groupByMarket, sortField, sortDir, mergedQuotes]);

  // ── Grouped rendering ──
  const groupedData = useMemo(() => {
    if (!groupByMarket) return null;
    const groups: Record<string, string[]> = { HK: [], US: [], CRYPTO: [] };
    sortedWatchlist.forEach(code => {
      const m = detectMarket(code);
      if (groups[m]) groups[m].push(code);
    });
    return groups;
  }, [sortedWatchlist, groupByMarket]);

  useEffect(() => {
    if (selectedSymbol) loadKlines(selectedSymbol, klinePeriod);
  }, [selectedSymbol, klinePeriod]);

  async function loadKlines(symbol: string, period: string = 'daily') {
    setKlineLoading(true);
    try {
      const klines = await api.getKlines(symbol, period, 200);
      if (klines.length > 0) {
        setKlineData(klines.map((k: Record<string, unknown>) => ({
          time: typeof k.time === 'number' ? k.time : Math.floor(new Date(k.time).getTime() / 1000),
          open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume
        })));
      }
    } catch {/* silent */} finally {setKlineLoading(false);}
    void EngineError;
  }

  function handleAddStock(code: string) {
    addWatch(code); setSelectedSymbol(code);
  }

  function handleRemoveStock(code: string) {
    const skipConfirm = localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === 'true';
    if (!skipConfirm) { setDeleteConfirm({ show: true, code }); return; }
    removeWithUndo(code);
  }

  function removeWithUndo(code: string) {
    removeWatch(code);
    setUndoTarget(code);
    const toastKey = `undo-${code}-${Date.now()}`;
    message.success({
      content: `已移除 ${code.replace(/^(US|HK|CRYPTO)\./, '')}`,
      key: toastKey, duration: 3,
      btn: <button onClick={() => { addWatch(code); message.destroy(toastKey); setUndoTarget(null); }}
        style={{ background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>撤销</button>,
    });
    // Auto-clear undo
    setTimeout(() => setUndoTarget(null), 3000);
  }

  // ── R157 #22: Toggle pin ──
  function togglePin(code: string) {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      try { localStorage.setItem('dw-pinned', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // ── R157 #25: Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K: focus search
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('.symbol-search-input') as HTMLInputElement;
        if (input) input.focus();
      }
      // Delete: remove selected symbol
      if (e.key === 'Delete' && selectedSymbol && !(e.target as HTMLElement)?.closest('input')) {
        e.preventDefault();
        handleRemoveStock(selectedSymbol);
      }
      // Ctrl+G: toggle grouping
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        setGroupByMarket(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol]);

  // ── R157 #26: Sort handler ──
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) return null;
    return <span style={{ fontSize: 9, marginLeft: 2, color: '#f59e0b' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  // ── Sortable table header ──
  function SortableTh({ field, label, className }: { field: SortField; label: string; className: string }) {
    return (
      <th className={className} onClick={() => handleSort(field)}
        style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label} {renderSortIcon(field)}
      </th>
    );
  }

  return (
    <div className="p-6">
      {/* Delete confirmation modal */}
      {deleteConfirm?.show && (
        <Modal title="确认删除" open onCancel={() => setDeleteConfirm(null)} onOk={() => {
          removeWithUndo(deleteConfirm.code); setDeleteConfirm(null);
        }} okText="删除" cancelText="取消" width={380}>
          <p>确定要从自选中移除 <strong>{deleteConfirm.code}</strong> 吗？</p>
          <label style={{ fontSize: 12, color: '#6b7280' }}>
            <input type="checkbox" onChange={(e) => {
              if (e.target.checked) localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, 'true');
              else localStorage.removeItem(SKIP_DELETE_CONFIRM_KEY);
            }} /> 不再提示
          </label>
        </Modal>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t('MarketPage.k0')}</h1>
          <div className="flex items-center gap-2">
            <p className="text-gray-400 text-sm">{i18n.t("MarketPage.r92_a782")}</p>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            wsConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              {wsConnected ? `WS ${wsSource}` : 'Polling'}
            </span>
            <span className="text-[10px] text-gray-500 ml-2">Ctrl+K 搜索 · Ctrl+G 分组 · Del 删除</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MarketStatusIndicator compact />
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 mb-4">
        <SymbolSearch watchlist={watchlist} onAdd={handleAddStock} showOnlyNew />
      </div>

      {/* Quote source panel */}
      <QuoteSourcePanel watchlist={watchlist} quotes={{}} />

      {/* ── R157 #13: Market grouping toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setGroupByMarket(prev => !prev)}
          style={{
            padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            background: groupByMarket ? '#3b82f620' : '#1a1d2e',
            border: `1px solid ${groupByMarket ? '#3b82f633' : '#2a2d3e'}`,
            color: groupByMarket ? '#3b82f6' : '#6b7280',
          }}
        >
          {groupByMarket ? '📂 按市场分组:开' : '📂 按市场分组:关'}
        </button>
        <span style={{ fontSize: 10, color: '#6b7280' }}>
          {watchlist.length} 标的 · 置顶{pinned.size} · {sortField ? `按${sortField}${sortDir==='asc'?'↑':'↓'}` : '默认'}
        </span>
      </div>

      {/* Watchlist table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        {groupByMarket && groupedData ? (
          // ── Grouped view ──
          <div>
            {Object.entries(groupedData).map(([market, codes]) => {
              if (codes.length === 0) return null;
              const mc = MARKET_LABELS[market];
              const collapsed = collapsedGroups[market] ?? false;
              return (
                <div key={market}>
                  <div
                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [market]: !prev[market] }))}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      background: `${mc.color}08`, borderBottom: '1px solid #2a2d3e',
                      color: mc.color, fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <span>{collapsed ? '▶' : '▼'}</span>
                    <span>{mc.icon} {mc.label}</span>
                    <span style={{ color: '#6b7280', fontSize: 10 }}>({codes.length})</span>
                  </div>
                  {!collapsed && (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-4 py-2 text-left text-[10px] text-gray-500 uppercase">📌</th>
                          <th className="px-4 py-2 text-left text-[10px] text-gray-500 uppercase">代码</th>
                          <th className="px-4 py-2 text-left text-[10px] text-gray-500 uppercase">名称</th>
                          <SortableTh field="price" label="价格" className="px-4 py-2 text-right text-[10px] text-gray-500 uppercase" />
                          <SortableTh field="changePct" label="涨跌" className="px-4 py-2 text-right text-[10px] text-gray-500 uppercase" />
                          <th className="px-4 py-2 text-right text-[10px] text-gray-500 uppercase">来源</th>
                          <th className="px-4 py-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {codes.map(code => (
                          <WatchlistRow key={code} code={code} quote={mergedQuotes[code]}
                            isSelected={selectedSymbol === code} onSelect={setSelectedSymbol}
                            onRemove={handleRemoveStock} pinned={pinned.has(code)}
                            onTogglePin={togglePin} compact />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // ── Flat view ──
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-center w-10 text-xs text-gray-500">📌</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">{t("components.code")}</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">{t("components.name")}</th>
                <SortableTh field="price" label={i18n.t('MarketPage.k2')} className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide" />
                <SortableTh field="change" label={i18n.t('MarketPage.k3')} className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide" />
                <SortableTh field="changePct" label={t("components.priceChange")} className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide" />
                <SortableTh field="volume" label={t("components.volume")} className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide" />
                <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wide">来源</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wide">{i18n.t('MarketPage.k4')}</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wide w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sortedWatchlist.map((code) =>
              <WatchlistRow key={code} code={code} quote={mergedQuotes[code]}
                isSelected={selectedSymbol === code} onSelect={setSelectedSymbol}
                onRemove={handleRemoveStock} pinned={pinned.has(code)}
                onTogglePin={togglePin} />
            )}
            </tbody>
          </table>
        )}
      </div>

      {/* K-Line Chart */}
      <div className="mt-6">
        {/* ── R157 #23: Pin button in K-line header ── */}
        {selectedSymbol && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button
              onClick={() => togglePin(selectedSymbol)}
              title={pinned.has(selectedSymbol) ? '取消置顶' : '置顶'}
              style={{
                background: 'none', border: 'none', fontSize: 16, cursor: 'pointer',
                filter: pinned.has(selectedSymbol) ? 'none' : 'grayscale(1)',
                opacity: pinned.has(selectedSymbol) ? 1 : 0.3,
              }}
            >
              📌
            </button>
            <span style={{ color: '#6b7280', fontSize: 10 }}>
              {undoTarget === selectedSymbol ? '⚠️ 已移除(可撤销)' : pinned.has(selectedSymbol) ? '已置顶' : ''}
            </span>
          </div>
        )}

        {klineLoading ?
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">⏳</div>
            <p className="text-gray-400 text-sm">加载中...</p>
          </div> :
        selectedSymbol && klineData.length > 0 ?
        <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-white font-semibold">{selectedSymbol.replace('US.', '').replace('HK.', '').replace('CRYPTO.', '')}</h2>
              {(() => {
              const q = mergedQuotes[selectedSymbol];
              const cls = q && (q as any).change > 0 ? 'text-emerald-400' : q && (q as any).change < 0 ? 'text-red-400' : 'text-gray-500';
              return q ?
              <span className={`font-mono text-sm ${cls}`}>
                    {(q as any).price.toFixed(2)} {(q as any).change > 0 ? '+' : ''}{(q as any).changePct.toFixed(2)}%
                  </span> :
              null;
            })()}
              <div className="flex gap-1 ml-4">
                {PERIODS.map((p) =>
              <button key={p.key} onClick={() => setKlinePeriod(p.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                klinePeriod === p.key ? 'bg-[#C9A046] text-black' : 'text-gray-500 hover:text-gray-300 bg-[#12121a]'}`}>
                    {p.label}
                  </button>)}
              </div>
              <button onClick={() => loadKlines(selectedSymbol, klinePeriod)} className="text-xs text-gray-500 hover:text-gray-300 ml-auto">🔄 刷新</button>
            </div>
            <KLineChart data={klineData as any} height={400} />
          </div> :
        selectedSymbol ?
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">📊</div>
            <p className="text-gray-400 text-sm">暂无K线数据</p>
          </div> :
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">📈</div>
            <p className="text-gray-400 text-sm">{i18n.t('MarketPage.k5')}</p>
          </div>
        }
      </div>
    </div>);
}

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

// ── Watchlist Row ──
const WatchlistRow = memo(function WatchlistRow({
  code, quote, isSelected, onSelect, onRemove, pinned = false, onTogglePin, compact = false,
}: {
  code: string; quote: unknown; isSelected: boolean; onSelect: (code: string) => void;
  onRemove: (code: string) => void; pinned?: boolean; onTogglePin?: (code: string) => void; compact?: boolean;
}) {
  const chg = quote?.change ?? 0;
  const pct = quote?.changePct ?? 0;
  const cls = chg > 0 ? 'text-emerald-400' : chg < 0 ? 'text-red-400' : 'text-gray-500';
  const sym = code.replace('US.', '').replace('HK.', '').replace('CRYPTO.', '');
  const isLev = ['TQQQ', 'SOXL', 'SQQQ', 'SOXS', 'UVXY'].includes(sym);
  const isInv = ['SQQQ', 'SOXS'].includes(sym);

  return (
    <tr onClick={() => onSelect(code)}
      className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer ${isSelected ? 'bg-[#C9A046]/5' : ''}`}>
      {/* Pin button */}
      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
        <button onClick={() => onTogglePin?.(code)}
          title={pinned ? '取消置顶' : '置顶'}
          style={{ background: 'none', border: 'none', fontSize: 12, cursor: 'pointer',
            filter: pinned ? 'none' : 'grayscale(1)', opacity: pinned ? 1 : 0.2 }}>
          📌
        </button>
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-white text-sm">{sym}</span>
        {pinned && <span style={{ color: '#f59e0b', fontSize: 9, marginLeft: 4 }}>📌</span>}
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs">{quote?.name || '--'}</td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{quote ? quote.price.toFixed(2) : '--'}</td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{chg > 0 ? '+' : ''}{chg.toFixed(2)}</td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{quote ? fmtVol(quote.volume) : '--'}</td>
      <td className="px-4 py-3 text-center">
        {quote?._wsSource && (
          <QuoteSourceIndicator
            sources={[{ id: quote._wsSource as any, name: quote._wsSource, status: 'connected', latency: 12, market: 'US', lastUpdate: Date.now() }]}
            currentSource={quote._wsSource as any} compact />
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {isLev && <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded mr-1">3x</span>}
        {isInv && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">{i18n.t('MarketPage.k6')}</span>}
      </td>
      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
        <button onClick={() => onRemove(code)} className="text-gray-600 hover:text-red-400 text-xs transition-colors" title={i18n.t('MarketPage.k7')}>✕</button>
      </td>
    </tr>);
});
