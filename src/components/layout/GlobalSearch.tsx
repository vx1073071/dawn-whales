// @ts-nocheck
// ── R123-M03 GlobalSearch — 全局搜索框 (Ctrl+K) ──────────────────────────
// PM: 输入代码 → 自动补全 → 回车 → 所有面板同步切换标的
// 支持: 币安/US/HK/CN 多市场代码补全

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Input, Modal } from 'antd';
import { SearchOutlined, RiseOutlined, FallOutlined, StarOutlined, SwapOutlined } from '@ant-design/icons';
import { useChartStore } from '../../store/ChartStore';

// ═══════════ Types ═══════════

interface SearchResult {
  symbol: string;
  name: string;
  market: 'crypto' | 'us' | 'hk' | 'forex';
  price?: number;
  changePct?: number;
  volume?: number;
  starred?: boolean;
}

// ═══════════ Mock popular symbols ═══════════

const POPULAR_SYMBOLS: SearchResult[] = [
  // Crypto
  { symbol: 'BTC-USDT', name: 'Bitcoin', market: 'crypto', price: 97234, changePct: 2.3, volume: 45.2e9, starred: true },
  { symbol: 'ETH-USDT', name: 'Ethereum', market: 'crypto', price: 3821, changePct: -1.2, volume: 18.7e9 },
  { symbol: 'SOL-USDT', name: 'Solana', market: 'crypto', price: 187.5, changePct: 5.1, volume: 3.2e9 },
  { symbol: 'BNB-USDT', name: 'BNB', market: 'crypto', price: 612, changePct: 0.8, volume: 1.5e9 },
  { symbol: 'XRP-USDT', name: 'Ripple', market: 'crypto', price: 2.45, changePct: -0.5, volume: 8.3e9, starred: true },
  { symbol: 'DOGE-USDT', name: 'Dogecoin', market: 'crypto', price: 0.172, changePct: 12.4, volume: 2.1e9 },
  { symbol: 'ADA-USDT', name: 'Cardano', market: 'crypto', price: 0.89, changePct: 3.1, volume: 1.2e9 },
  { symbol: 'AVAX-USDT', name: 'Avalanche', market: 'crypto', price: 42.3, changePct: -2.1, volume: 0.8e9 },
  // US Stocks
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'us', price: 218.5, changePct: 0.7, volume: 52e6 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'us', price: 962.3, changePct: 3.2, volume: 38e6 },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'us', price: 248.9, changePct: -1.8, volume: 72e6 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'us', price: 435.2, changePct: 0.3, volume: 21e6 },
  // HK Stocks
  { symbol: '00700', name: '腾讯控股', market: 'hk', price: 382.6, changePct: 1.5, volume: 28e6 },
  { symbol: '09988', name: '阿里巴巴-SW', market: 'hk', price: 78.3, changePct: -0.8, volume: 35e6 },
  { symbol: '09961', name: '携程集团-S', market: 'hk', price: 512.4, changePct: 2.1, volume: 2e6 },
  // Forex
  { symbol: 'EUR-USD', name: '欧元/美元', market: 'forex', price: 1.085, changePct: -0.12, volume: 0 },
  { symbol: 'GBP-USD', name: '英镑/美元', market: 'forex', price: 1.274, changePct: 0.05, volume: 0 },
  { symbol: 'USD-JPY', name: '美元/日元', market: 'forex', price: 157.3, changePct: 0.33, volume: 0 },
];

const MARKET_ICONS: Record<string, string> = {
  crypto: '₿', us: '$', hk: 'HK$', forex: '💱',
};

// ═══════════ Component ═══════════

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<any>(null);

  const setSymbol = useChartStore((s) => s.setSymbol);
  const setMarket = useChartStore((s) => s.setMarket);

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setSelectedIdx(0);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Fuzzy search
  const results = useMemo(() => {
    if (!query.trim()) return POPULAR_SYMBOLS;
    const q = query.toLowerCase().trim();
    return POPULAR_SYMBOLS.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    );
  }, [query]);

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0); }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    setSymbol(result.symbol);
    setMarket(result.market);
    setOpen(false);
    setQuery('');
  }, [setSymbol, setMarket]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIdx]) handleSelect(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [results, selectedIdx, handleSelect]);

  // Format volume
  const fmtVol = (v: number) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toString();
  };

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      closable={true}
      maskClosable={true}
      centered
      width={480}
      styles={{
        content: { background: '#0d1117', border: '1px solid #30363d', padding: 0, borderRadius: 12 },
        header: { display: 'none' },
        mask: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div style={{ fontFamily: 'monospace' }}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1c2333]">
          <SearchOutlined className="text-[#484f58] text-sm" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索股票/加密货币/外汇..."
            bordered={false}
            className="bg-transparent text-[#e6edf3] text-sm flex-1"
            autoFocus
          />
          <kbd className="text-[9px] text-[#484f58] bg-[#161b22] px-1.5 py-0.5 rounded border border-[#30363d]">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {results.map((r, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <div
                key={r.symbol}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors
                  ${isSelected ? 'bg-[#3b82f610]' : 'hover:bg-[#161b22]'}`}
              >
                {/* Star */}
                <span className="w-3 text-center shrink-0">
                  {r.starred ? <StarOutlined className="text-[#f59e0b] text-[10px]" /> : null}
                </span>

                {/* Market icon */}
                <span className="text-[10px] w-4 text-center shrink-0 opacity-60">
                  {MARKET_ICONS[r.market]}
                </span>

                {/* Symbol + Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-[#c9d1d9] text-xs font-bold truncate">{r.symbol}</div>
                  <div className="text-[#484f58] text-[10px] truncate">{r.name}</div>
                </div>

                {/* Price */}
                {r.price != null && (
                  <div className="text-right shrink-0">
                    <div className="text-[#c9d1d9] text-xs font-mono">
                      {r.price < 1 ? r.price.toFixed(4) : r.price < 1000 ? r.price.toFixed(2) : r.price.toLocaleString()}
                    </div>
                    {r.changePct != null && (
                      <div className={`text-[10px] font-mono flex items-center gap-0.5 ${r.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {r.changePct >= 0 ? <RiseOutlined /> : <FallOutlined />}
                        {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                )}

                {/* Volume */}
                {r.volume != null && r.volume > 0 && (
                  <div className="text-[9px] text-[#484f58] w-10 text-right shrink-0">
                    {fmtVol(r.volume)}
                  </div>
                )}

                {/* Shortcut hint */}
                {isSelected && (
                  <span className="text-[9px] text-[#484f58] bg-[#161b22] px-1 rounded">⏎</span>
                )}
              </div>
            );
          })}

          {results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <span className="text-[#484f58] text-xs">未找到匹配的标的</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[#1c2333] text-[9px] text-[#484f58]">
          <span>↑↓ 导航</span>
          <span>⏎ 选择</span>
          <span>Esc 关闭</span>
          <span className="ml-auto">Ctrl+K 随时打开</span>
        </div>
      </div>
    </Modal>
  );
}
