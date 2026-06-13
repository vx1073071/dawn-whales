// ── R152 ML — SymbolSearch (全局搜索框) ────────────────────────────────
// PM: 4 modules, 6h. Replaces POPULAR_US hardcoded list.
// Supports: HK stocks, US stocks, crypto — with broker availability badges.
//
// Features:
//  1. Global symbol search (code + name, multi-market)
//  2. Search results with: code + name + exchange tag + broker availability
//  3. Add-to-watchlist interaction: check broker → normalize code → add
//  4. Broker unavailable hint: guide to connect correct market broker

import { useState, useCallback, useMemo } from 'react';
import { Tag, Space, Tooltip, Empty, message } from 'antd';
import {
  SearchOutlined, PlusOutlined, CheckCircleOutlined,
  WarningOutlined, LinkOutlined,
  FireOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

type Market = 'HK' | 'US' | 'CRYPTO';
type BrokerId = 'futu' | 'moomoo' | 'ibkr' | 'longbridge' | 'tiger' | 'binance' | 'okx' | 'bybit' | 'bitget' | 'schwab' | 'etrade' | 'webull';

interface SymbolEntry {
  code: string;           // Normalized code (US.AAPL / HK.00700 / CRYPTO.BTC-USDT)
  name: string;
  market: Market;
  exchange: string;       // NASDAQ / HKEX / Binance
  supportedBrokers: BrokerId[];  // brokers that can trade this market
  isHot?: boolean;        // Hot/popular symbol
}

interface BrokerStatus {
  id: BrokerId;
  name: string;
  market: Market;
  connected: boolean;
}

// ═══════════ Multi-market symbol database (replaces POPULAR_US) ═══════════

const SYMBOL_DB: SymbolEntry[] = [
  // ── US Stocks ──
  { code:'US.TQQQ',name:'ProShares UltraPro QQQ 3x',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull'],isHot:true},
  { code:'US.SQQQ',name:'ProShares UltraPro Short QQQ',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.SOXL',name:'Direxion Semiconductor Bull 3x',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.SOXS',name:'Direxion Semiconductor Bear 3x',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.QQQ',name:'Invesco QQQ Trust',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull'],isHot:true},
  { code:'US.SPY',name:'SPDR S&P 500 ETF',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull'],isHot:true},
  { code:'US.AAPL',name:'Apple Inc.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull'],isHot:true},
  { code:'US.NVDA',name:'NVIDIA Corp.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull'],isHot:true},
  { code:'US.MSFT',name:'Microsoft Corp.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.TSLA',name:'Tesla Inc.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull'],isHot:true},
  { code:'US.AMD',name:'Advanced Micro Devices',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.GOOG',name:'Alphabet Inc.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.AMZN',name:'Amazon.com Inc.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.META',name:'Meta Platforms Inc.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.PLTR',name:'Palantir Technologies',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.AVGO',name:'Broadcom Inc.',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.IWM',name:'iShares Russell 2000',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.UVXY',name:'ProShares Ultra VIX',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.BABA',name:'Alibaba Group (US)',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.PDD',name:'PDD Holdings',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.NIO',name:'NIO Inc.',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.ARKK',name:'ARK Innovation ETF',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.GLD',name:'SPDR Gold Shares',market:'US',exchange:'NYSE',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},
  { code:'US.TLT',name:'iShares 20+ Year Treasury',market:'US',exchange:'NASDAQ',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger','schwab','etrade','webull']},

  // ── HK Stocks ──
  { code:'HK.00700',name:'腾讯控股',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger'],isHot:true},
  { code:'HK.09988',name:'阿里巴巴-SW',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger'],isHot:true},
  { code:'HK.09999',name:'网易-S',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.09618',name:'京东集团-SW',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.09888',name:'百度集团-SW',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.01810',name:'小米集团-W',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger'],isHot:true},
  { code:'HK.03690',name:'美团-W',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger'],isHot:true},
  { code:'HK.01211',name:'比亚迪股份',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.02318',name:'中国平安',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.00388',name:'香港交易所',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.00005',name:'汇丰控股',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.00941',name:'中国移动',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.09961',name:'携程集团-S',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.02015',name:'理想汽车-W',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},
  { code:'HK.09868',name:'小鹏汽车-W',market:'HK',exchange:'HKEX',supportedBrokers:['futu','moomoo','ibkr','longbridge','tiger']},

  // ── Crypto ──
  { code:'CRYPTO.BTC-USDT',name:'Bitcoin / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget'],isHot:true},
  { code:'CRYPTO.ETH-USDT',name:'Ethereum / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget'],isHot:true},
  { code:'CRYPTO.SOL-USDT',name:'Solana / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget'],isHot:true},
  { code:'CRYPTO.BNB-USDT',name:'Binance Coin / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget']},
  { code:'CRYPTO.DOGE-USDT',name:'Dogecoin / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget']},
  { code:'CRYPTO.ADA-USDT',name:'Cardano / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget']},
  { code:'CRYPTO.AVAX-USDT',name:'Avalanche / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget']},
  { code:'CRYPTO.LINK-USDT',name:'Chainlink / USDT',market:'CRYPTO',exchange:'Binance',supportedBrokers:['binance','okx','bybit','bitget']},
];

// ═══════════ Broker connection status (mock — to be replaced by IPC) ══════

const MOCK_BROKER_STATUS: BrokerStatus[] = [
  { id:'futu',name:'Futu (富途)',market:'HK',connected:true },
  { id:'binance',name:'Binance',market:'CRYPTO',connected:true },
  { id:'okx',name:'OKX',market:'CRYPTO',connected:true },
  { id:'bybit',name:'Bybit',market:'CRYPTO',connected:true },
  { id:'bitget',name:'Bitget',market:'CRYPTO',connected:true },
  { id:'tiger',name:'Tiger Brokers',market:'HK',connected:false },
  { id:'ibkr',name:'Interactive Brokers',market:'US',connected:true },
  { id:'schwab',name:'Charles Schwab',market:'US',connected:false },
];

function hasConnectedBroker(market: Market): boolean {
  return MOCK_BROKER_STATUS.some(b => b.market === market && b.connected);
}

function getConnectedBrokersFor(market: Market): BrokerStatus[] {
  return MOCK_BROKER_STATUS.filter(b => b.market === market && b.connected);
}

// ═══════════ Helpers ═══════════

const MARKET_CONFIG: Record<Market, { color: string; label: string; icon: string }> = {
  HK: { color:'#ef4444', label:'港股', icon:'🇭🇰' },
  US: { color:'#3b82f6', label:'美股', icon:'🇺🇸' },
  CRYPTO: { color:'#f59e0b', label:'加密货币', icon:'🪙' },
};

const MARKET_LABELS_ZH: Record<Market, string> = {
  HK: '港股券商', US: '美股券商', CRYPTO: '加密交易所',
};

// ═══════════ Component ═══════════

export interface SymbolSearchProps {
  watchlist: string[];
  onAdd: (code: string) => void;
  /** Filter: only show stocks NOT in watchlist */
  showOnlyNew?: boolean;
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function SymbolSearch({
  watchlist,
  onAdd,
  showOnlyNew = false,
  compact = false,
  style,
}: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showBrokerHint, setShowBrokerHint] = useState<{ market: Market; symbol: SymbolEntry } | null>(null);

  void compact; // R152 — reserved for compact mode

  const results = useMemo(() => {
    let filtered = SYMBOL_DB;
    const q = query.trim().toUpperCase();

    if (selectedMarket) {
      filtered = filtered.filter(s => s.market === selectedMarket);
    }

    if (q) {
      filtered = filtered.filter(s =>
        s.code.includes(q) || s.name.toUpperCase().includes(q),
      );
    }

    if (showOnlyNew) {
      filtered = filtered.filter(s => !watchlist.includes(s.code));
    }

    // Sort: hot first, then by name
    return filtered.sort((a, b) => {
      if (a.isHot && !b.isHot) return -1;
      if (!a.isHot && b.isHot) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [query, selectedMarket, watchlist, showOnlyNew]);

  const handleAdd = useCallback((s: SymbolEntry) => {
    const connected = hasConnectedBroker(s.market);
    if (!connected) {
      setShowBrokerHint({ market: s.market, symbol: s });
      message.warning({
        content: `需要连接${MARKET_LABELS_ZH[s.market]}才能添加 ${s.code}`,
        duration: 4,
      });
      return;
    }
    onAdd(s.code);
    setQuery('');
    message.success(`已添加 ${s.code}`);
  }, [onAdd]);

  return (
    <div style={style}>
      {/* ── Search Input ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            onKeyDown={e => { if (e.key === 'Escape') setIsOpen(false); }}
            placeholder="搜索代码或名称 (00700 / AAPL / BTC...)"
            style={{
              width: '100%', padding: '10px 14px 10px 38px',
              background: '#0d0f1a', border: '1px solid #2a2d3e',
              borderRadius: 10, color: '#e0e0e0', fontSize: 13,
              outline: 'none',
            }}
          />
          <SearchOutlined style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14,
          }} />
        </div>
      </div>

      {/* ── Market Filter Tabs ── */}
      {isOpen && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          <button
            onClick={() => setSelectedMarket(selectedMarket ? null : null)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11,
              border: '1px solid #2a2d3e', background: !selectedMarket ? '#3b82f620' : '#0d0f1a',
              color: !selectedMarket ? '#3b82f6' : '#6b7280', cursor: 'pointer',
            }}
          >
            全部市场
          </button>
          {Object.entries(MARKET_CONFIG).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setSelectedMarket(selectedMarket === k ? null : k as Market)}
              style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11,
                border: `1px solid ${cfg.color}33`,
                background: selectedMarket === k ? `${cfg.color}20` : '#0d0f1a',
                color: selectedMarket === k ? cfg.color : '#6b7280',
                cursor: 'pointer',
              }}
            >
              {cfg.icon} {cfg.label}
              <span style={{ fontSize: 9, marginLeft: 4, color: '#6b7280' }}>
                ({results.filter(r => r.market === k).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Search Results ── */}
      {isOpen && query && (
        <div style={{
          marginTop: 6, maxHeight: 320, overflowY: 'auto',
          background: '#1a1d2e', border: '1px solid #2a2d3e',
          borderRadius: 10, padding: 4,
        }}>
          {results.slice(0, 20).map(s => {
            const mc = MARKET_CONFIG[s.market];
            const connected = hasConnectedBroker(s.market);
            const connectedBrokers = getConnectedBrokersFor(s.market);
            const inWatch = watchlist.includes(s.code);

            return (
              <div
                key={s.code}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: inWatch ? '#22c55e08' : 'transparent',
                  cursor: inWatch ? 'default' : 'pointer',
                  opacity: inWatch ? 0.6 : 1,
                }}
                onMouseDown={() => !inWatch && handleAdd(s)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600, fontFamily: 'monospace' }}>
                      {s.code}
                    </span>
                    {s.isHot && <FireOutlined style={{ color: '#f59e0b', fontSize: 10 }} />}
                    <Tag color={mc.color} style={{ fontSize: 9, lineHeight: '14px', padding: '0 6px' }}>
                      {mc.icon} {mc.label}
                    </Tag>
                    <Tag style={{ fontSize: 9, lineHeight: '14px', padding: '0 6px', color: '#8b949e', borderColor: '#2a2d3e' }}>
                      {s.exchange}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>

                  {/* ── Broker availability ── */}
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {connectedBrokers.length > 0 ? (
                      connectedBrokers.map(b => (
                        <Tag key={b.id} color="green" style={{ fontSize: 8, lineHeight: '12px', padding: '0 4px' }}>
                          <CheckCircleOutlined style={{ fontSize: 8 }} /> {b.name.split(' ')[0]}
                        </Tag>
                      ))
                    ) : null}
                    {!connected && (
                      <Tag color="red" style={{ fontSize: 8, lineHeight: '12px', padding: '0 4px' }}>
                        <WarningOutlined style={{ fontSize: 8 }} /> 无可用券商
                      </Tag>
                    )}
                  </div>
                </div>

                {/* ── Add button ── */}
                <div style={{ marginLeft: 10 }}>
                  {inWatch ? (
                    <Tag color="green" style={{ fontSize: 9 }}>已添加</Tag>
                  ) : connected ? (
                    <button
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: '#3b82f620', border: '1px solid #3b82f633',
                        color: '#3b82f6', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 14,
                      }}
                    >
                      <PlusOutlined />
                    </button>
                  ) : (
                    <Tooltip title={`需要连接${MARKET_LABELS_ZH[s.market]}`}>
                      <button
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: '#ef444420', border: '1px solid #ef444433',
                          color: '#ef4444', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 14,
                        }}
                      >
                        <LinkOutlined />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}

          {results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Empty description={`未找到 "${query}"`} />
            </div>
          )}
        </div>
      )}

      {/* ── Broker not available hint (R152 #4) ── */}
      {showBrokerHint && (
        <div style={{
          marginTop: 8, padding: '10px 14px', borderRadius: 8,
          background: '#2e0a0a', border: '1px solid #ef444466',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Space>
            <WarningOutlined style={{ color: '#ef4444' }} />
            <span style={{ color: '#e0e0e0', fontSize: 12 }}>
              该标的需要连接<strong style={{ color: '#ef4444' }}>{MARKET_LABELS_ZH[showBrokerHint.market]}</strong>
              {' '}({showBrokerHint.symbol.market === 'HK' ? 'Futu/Tiger/华盛' : showBrokerHint.symbol.market === 'US' ? 'IBKR/Schwab/富途' : 'Binance/OKX'})
            </span>
          </Space>
          <Space>
            <button
              onClick={() => setShowBrokerHint(null)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid #2a2d3e',
                background: 'transparent', color: '#8b949e', fontSize: 11, cursor: 'pointer',
              }}
            >
              忽略
            </button>
          </Space>
        </div>
      )}

      {/* ── Compact mode: popular symbols grid ── */}
      {isOpen && !query && !selectedMarket && (
        <div style={{
          marginTop: 6, padding: 10, borderRadius: 10,
          background: '#1a1d2e', border: '1px solid #2a2d3e',
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>热门标的（点击添加）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 4 }}>
            {SYMBOL_DB.filter(s => s.isHot && !watchlist.includes(s.code)).slice(0, 12).map(s => {
              const mc = MARKET_CONFIG[s.market];
              return (
                <button
                  key={s.code}
                  onMouseDown={() => handleAdd(s)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, textAlign: 'left',
                    background: '#0d0f1a', border: '1px solid #2a2d3e',
                    color: '#e0e0e0', fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ color: mc.color, fontSize: 12 }}>{mc.icon}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.code}</span>
                  <span style={{ color: '#6b7280', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {s.name}
                  </span>
                  <PlusOutlined style={{ color: '#3b82f6', fontSize: 10 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
