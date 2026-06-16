// @ts-nocheck
// QUANT MOO — 前端去Mock: 行情数据桥接层 (Frontend De-Mock Bridge)
// R261 ML#1 P0-03 — 统一数据获取hook + 三种模式适配 (8h)

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──
export interface MarketQuote {
  symbol: string; name: string; market: string;
  price: number; change: number; changePct: number;
  open?: number; high?: number; low?: number; prevClose?: number;
  volume?: number; turnover?: number;
  bid?: number; ask?: number; spread?: number;
  status: 'trading' | 'pre' | 'post' | 'closed' | 'lunch';
  lastUpdate: number;
  source: 'yahoo' | 'binance' | 'futu' | 'moomoo' | 'eastmoney' | 'ibkr' | 'mock';
}

export interface SectorData {
  sector: string; sectorCN: string;
  changePct: number; volume: number;
  marketCap: number; stockCount: number;
  upCount: number; downCount: number;
  heatScore: number; topPerformer: string;
  topPerformerPct: number;
}

export interface FactorSignal {
  factor: string; category: string;
  signal: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  ic: number; sharpe: number; trend: string;
}

export interface MoverItem {
  symbol: string; name: string; market: string;
  price: number; changePct: number; volume: number;
  reason: string; severity: 'extreme' | 'major' | 'notable' | 'minor';
  catalyst: string; direction: 'up' | 'down';
  timestamp: number; isNew: boolean;
}

export interface AIQuickTake {
  id: string; market: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'cautious' | 'excited';
  headline: string; body: string; confidence: number;
  keyFactors: string[]; timestamp: number;
}

export interface IndexSnapshot {
  index: string; name: string; price: number;
  change: number; changePct: number;
  status: 'open' | 'pre' | 'post' | 'closed';
}

// ── Data Mode ──
export type DataMode = 'mock' | 'hybrid' | 'live';

// ── IPC Bridge Interface (mockable) ──
interface IPCBridge {
  invoke(channel: string, ...args: any[]): Promise<any>;
  on(channel: string, callback: (...args: any[]) => void): void;
  off(channel: string, callback: (...args: any[]) => void): void;
}

// Detect environment
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
const getBridge = (): IPCBridge | null => {
  if (isElectron) return (window as any).electronAPI as IPCBridge;
  return null;
};

// ── Mock Data Generators ──
const MOCK_SYMBOLS = ['NVDA', 'TSLA', '0700', 'BTC', 'SMCI', 'MSFT', 'ETH', '9988', 'COIN', 'SPX', 'HSI', 'N225'];

function generateMockQuote(symbol: string): MarketQuote {
  const basePrices: Record<string, number> = {
    NVDA: 148.35, TSLA: 342.80, '0700': 485.60, BTC: 98450, SMCI: 892, MSFT: 468.50, ETH: 4520, '9988': 112.30, COIN: 342, SPX: 6047.82, HSI: 24580, N225: 41532,
  };
  const base = basePrices[symbol] || 100;
  const changePct = (Math.random() - 0.4) * 10;
  const price = base * (1 + changePct / 100);
  return {
    symbol, name: symbol, market: symbol === '0700' || symbol === '9988' ? 'HK' : symbol === 'BTC' || symbol === 'ETH' ? 'CRYPTO' : 'US',
    price: +price.toFixed(2), change: +(price - base).toFixed(2), changePct: +changePct.toFixed(2),
    bid: +(price - 0.03).toFixed(2), ask: +(price + 0.03).toFixed(2), spread: 0.06,
    volume: Math.round(1e6 + Math.random() * 80e6), status: 'trading', lastUpdate: Date.now(),
    source: 'mock',
  };
}

function generateMockSectors(): SectorData[] {
  return [
    { sector: 'semiconductor', sectorCN: '半导体', changePct: 6.4, volume: 189, marketCap: 5132, stockCount: 5, upCount: 5, downCount: 0, heatScore: 82, topPerformer: 'SMCI', topPerformerPct: 12.1 },
    { sector: 'ai_cloud', sectorCN: 'AI/云', changePct: 1.7, volume: 114, marketCap: 8860, stockCount: 4, upCount: 4, downCount: 0, heatScore: 71, topPerformer: '0700', topPerformerPct: 4.3 },
    { sector: 'crypto', sectorCN: '加密', changePct: 1.68, volume: 67, marketCap: 2612, stockCount: 4, upCount: 3, downCount: 1, heatScore: 75, topPerformer: 'COIN', topPerformerPct: 4.5 },
    { sector: 'energy', sectorCN: '能源', changePct: -1.0, volume: 24, marketCap: 835, stockCount: 2, upCount: 0, downCount: 2, heatScore: 34, topPerformer: 'CVX', topPerformerPct: -0.8 },
    { sector: 'consumer', sectorCN: '消费', changePct: -3.27, volume: 112, marketCap: 1438, stockCount: 3, upCount: 0, downCount: 2, heatScore: 42, topPerformer: 'JD', topPerformerPct: -0.5 },
    { sector: 'finance', sectorCN: '金融', changePct: 0.8, volume: 45, marketCap: 3200, stockCount: 3, upCount: 2, downCount: 1, heatScore: 58, topPerformer: 'JPM', topPerformerPct: 1.2 },
    { sector: 'healthcare', sectorCN: '医疗', changePct: -0.5, volume: 32, marketCap: 2500, stockCount: 3, upCount: 1, downCount: 2, heatScore: 45, topPerformer: 'UNH', topPerformerPct: 0.8 },
    { sector: 'realestate', sectorCN: '房地产', changePct: -1.5, volume: 6, marketCap: 104, stockCount: 1, upCount: 0, downCount: 1, heatScore: 28, topPerformer: 'PLD', topPerformerPct: -1.5 },
    { sector: 'auto', sectorCN: '汽车', changePct: -4.2, volume: 85, marketCap: 1800, stockCount: 3, upCount: 0, downCount: 3, heatScore: 30, topPerformer: 'TSLA', topPerformerPct: -6.2 },
    { sector: 'defense', sectorCN: '军工', changePct: 1.5, volume: 28, marketCap: 950, stockCount: 2, upCount: 2, downCount: 0, heatScore: 62, topPerformer: 'LMT', topPerformerPct: 2.1 },
  ];
}

function generateMockMovers(): MoverItem[] {
  return [
    { symbol: 'NVDA', name: 'NVIDIA', market: 'US', price: 148.35, changePct: 8.5, volume: 82.3, reason: '新AI芯片发布', severity: 'extreme', catalyst: 'earnings', direction: 'up', timestamp: Date.now() - 300000, isNew: true },
    { symbol: 'SMCI', name: 'Super Micro', market: 'US', price: 892, changePct: 12.1, volume: 41.5, reason: 'AI订单暴增', severity: 'extreme', catalyst: 'earnings', direction: 'up', timestamp: Date.now() - 600000, isNew: true },
    { symbol: 'TSLA', name: 'Tesla', market: 'US', price: 342.80, changePct: -6.2, volume: 65.1, reason: '交付不及预期', severity: 'major', catalyst: 'news', direction: 'down', timestamp: Date.now() - 900000, isNew: false },
    { symbol: '0700', name: '腾讯', market: 'HK', price: 485.60, changePct: 4.3, volume: 28.7, reason: '游戏版号获批', severity: 'notable', catalyst: 'sector', direction: 'up', timestamp: Date.now() - 1800000, isNew: false },
    { symbol: '9988', name: '阿里巴巴', market: 'HK', price: 112.30, changePct: -3.1, volume: 35.2, reason: '竞争加剧', severity: 'major', catalyst: 'earnings', direction: 'down', timestamp: Date.now() - 2400000, isNew: false },
    { symbol: 'COIN', name: 'Coinbase', market: 'US', price: 342, changePct: 4.5, volume: 18.2, reason: 'BTC逼近10万', severity: 'notable', catalyst: 'macro', direction: 'up', timestamp: Date.now() - 3600000, isNew: false },
  ];
}

// ── Core Hook: useMarketData ──
export function useMarketData(mode: DataMode = 'mock') {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize mock data
  useEffect(() => {
    if (mode !== 'mock' && mode !== 'hybrid') return;
    setQuotes(MOCK_SYMBOLS.map(generateMockQuote));

    if (mode === 'mock') {
      timerRef.current = setInterval(() => {
        setQuotes(MOCK_SYMBOLS.map(generateMockQuote));
      }, 3000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode]);

  // Connect to Yahoo WebSocket (live mode)
  useEffect(() => {
    if (mode !== 'live') return;
    // In production: connect to actual Yahoo Finance WS via IPC bridge
    const bridge = getBridge();
    if (bridge) {
      bridge.invoke('quote:subscribe', { symbols: MOCK_SYMBOLS }).then(() => {
        setConnected(true);
      }).catch(() => {
        // Fallback to mock
        setQuotes(MOCK_SYMBOLS.map(generateMockQuote));
      });

      const handler = (data: any) => {
        if (data?.quotes) {
          setQuotes(prev => {
            const map = new Map(prev.map(q => [q.symbol, q]));
            for (const q of data.quotes) map.set(q.symbol, { ...q, source: 'yahoo', lastUpdate: Date.now() });
            return Array.from(map.values());
          });
        }
      };
      bridge.on('quote:update', handler);
      return () => bridge.off('quote:update', handler);
    }
    // No bridge available → fallback to mock
    setQuotes(MOCK_SYMBOLS.map(generateMockQuote));
  }, [mode]);

  return { quotes, connected, mode };
}

// ── Hook: useSectorData ──
export function useSectorData(mode: DataMode = 'mock') {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setSectors(generateMockSectors());
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return { sectors, loading };
}

// ── Hook: useMoversData ──
export function useMoversData(mode: DataMode = 'mock') {
  const [movers, setMovers] = useState<MoverItem[]>([]);

  useEffect(() => {
    setMovers(generateMockMovers());
    if (mode === 'mock') {
      const timer = setInterval(() => {
        setMovers(prev => prev.map(m => ({ ...m, timestamp: Date.now() - Math.random() * 600000 })));
      }, 10000);
      return () => clearInterval(timer);
    }
  }, [mode]);

  return { movers };
}

// ── Hook: useFactors ──
export function useFactors() {
  const [factors, setFactors] = useState<FactorSignal[]>([
    { factor: 'mom_12m1m', category: '动量', signal: 'strong_bull', ic: 0.082, sharpe: 1.45, trend: '加速上行' },
    { factor: 'roe_ttm', category: '质量', signal: 'bull', ic: 0.065, sharpe: 1.12, trend: '稳定' },
    { factor: 'vol_20d', category: '低波', signal: 'bear', ic: -0.044, sharpe: -0.78, trend: '持续走弱' },
    { factor: 'btc_ret_7d', category: '加密', signal: 'strong_bull', ic: 0.095, sharpe: 1.68, trend: '强势' },
  ]);
  return { factors };
}

// ── Hook: useAITakes ──
export function useAITakes() {
  const [takes, setTakes] = useState<AIQuickTake[]>([
    { id: 'ai1', market: 'us', sentiment: 'bullish', headline: '美股强韧: AI芯片+消费韧性', body: 'NVDA新芯片发布带动芯片板块+3.2%。动能因子IC=0.082本周最强。', confidence: 85, keyFactors: ['mom_12m1m', 'roe_ttm'], timestamp: Date.now() - 1800000 },
    { id: 'ai2', market: 'hk', sentiment: 'cautious', headline: '港股承压: 恒指-1.25%', body: '腾讯游戏版号利好+4.3% vs 阿里竞争利空-3.1%。防御为主。', confidence: 72, keyFactors: ['southbound_flow', 'pe_ttm_inv'], timestamp: Date.now() - 3600000 },
    { id: 'ai3', market: 'crypto', sentiment: 'excited', headline: '比特币逼近10万', body: 'BTC ETF连续5日净流入>3.5亿美元。加密因子IC=0.095创年内新高。', confidence: 90, keyFactors: ['btc_ret_7d', 'btc_etf_flow'], timestamp: Date.now() - 7200000 },
  ]);
  return { takes };
}

// ── Hook: useIndexSnapshots ──
export function useIndexSnapshots() {
  const [indices, setIndices] = useState<IndexSnapshot[]>([
    { index: 'SPX', name: 'S&P 500', price: 6047.82, change: 32.15, changePct: 0.53, status: 'open' },
    { index: 'NDX', name: 'Nasdaq 100', price: 21634.50, change: 142.30, changePct: 0.66, status: 'open' },
    { index: 'DJI', name: 'DJIA', price: 43397.20, change: -18.40, changePct: -0.04, status: 'open' },
    { index: 'HSI', name: '恒生指数', price: 24580.90, change: -312.60, changePct: -1.25, status: 'closed' },
    { index: 'N225', name: '日経225', price: 41532.00, change: 285.00, changePct: 0.69, status: 'closed' },
    { index: 'BTC', name: 'Bitcoin', price: 98450.00, change: 1250.00, changePct: 1.29, status: 'open' },
  ]);
  return { indices };
}

// ── Export unified hooks ──
export const useAllMarketData = (mode: DataMode = 'mock') => {
  const { quotes, connected } = useMarketData(mode);
  const { sectors, loading: sectorsLoading } = useSectorData(mode);
  const { movers } = useMoversData(mode);
  const { factors } = useFactors();
  const { takes } = useAITakes();
  const { indices } = useIndexSnapshots();

  return {
    quotes, connected, mode,
    sectors, sectorsLoading,
    movers, factors, takes, indices,
    isLoading: sectorsLoading,
    lastUpdate: quotes.length > 0 ? Math.max(...quotes.map(q => q.lastUpdate)) : 0,
  };
};
