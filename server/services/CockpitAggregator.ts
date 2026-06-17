// R253 ML#1: CockpitAggregator types — stub pending cross-module fix
// Imports DailyBriefingEngine from electron/engine/news/ — TODO ML

export interface CockpitState {
  marketState: string;
  indices: CockpitIndexSnapshot[];
  briefing: CockpitBriefing | null;
  alerts: CockpitAlert[];
  watchlist: CockpitWatchlistItem[];
  sourceHealth: CockpitSourceHealth[];
  clock: string;
}

export interface CockpitIndexSnapshot {
  ticker: string; name: string; price: number; changePct: number;
  changeAmount: number; currency: string; flag: string;
}

export interface CockpitAlert {
  id: string; level: 'critical' | 'warning' | 'info';
  symbol?: string; message: string; timestamp: number;
}

export interface CockpitWatchlistItem {
  symbol: string; name: string; price: number; changePct: number;
}

export interface CockpitSourceHealth {
  name: string; status: 'online' | 'degraded' | 'offline';
  latency: number; lastCheck: number;
}

export interface CockpitBriefing {
  text: string; textCN: string; confidence: number;
  actions: string[]; actionsCN: string[];
  generatedAt: number;
}
