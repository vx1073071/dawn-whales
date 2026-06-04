// ── Platform Detection Utility ─────────────────────────────────────────────
// Detects whether running in Electron or PWA mode
// Provides unified API interface for both platforms

export type Platform = 'electron' | 'pwa' | 'unknown';

export function detectPlatform(): Platform {
  // Check for Electron
  if (typeof window !== 'undefined' && window.api?.broker) {
    return 'electron';
  }
  
  // Check for PWA (service worker registered)
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    return 'pwa';
  }
  
  return 'unknown';
}

export const PLATFORM = detectPlatform();

// ── Unified API Interface ──────────────────────────────────────────────────
// Abstracts away Electron IPC vs REST API differences

export interface UnifiedAPI {
  // Broker
  getBrokerStatus(): Promise<any>;
  getAccounts(): Promise<any[]>;
  getQuotes(codes: string[]): Promise<any[]>;
  
  // Strategy
  getStrategies(): Promise<any[]>;
  getStrategy(id: string): Promise<any>;
  
  // Backtest
  runBacktest(config: any): Promise<any>;
  runWalkForward(config: any): Promise<any>;
  runParamScan(config: any): Promise<any>;
  
  // Risk
  getRiskStatus(): Promise<any>;
  
  // Marketplace
  getMarketplaceList(sortBy?: string): Promise<any[]>;
  
  // Data Provider
  getFundamental(symbol: string): Promise<any>;
  getCapitalFlow(symbol: string): Promise<any>;
  getMarketRegime(): Promise<any>;
}

// ── Electron Implementation ────────────────────────────────────────────────

class ElectronAPI implements UnifiedAPI {
  async getBrokerStatus() {
    return window.api.broker.getStatus();
  }
  
  async getAccounts() {
    const result = await window.api.broker.getAccounts();
    return result?.success ? result.accounts || [] : [];
  }
  
  async getQuotes(codes: string[]) {
    const result = await window.api.broker.getQuotes(codes);
    return result?.success ? result.quotes || [] : [];
  }
  
  async getStrategies() {
    const result = await window.api.strategy.getAll();
    return result?.success ? result.strategies || [] : [];
  }
  
  async getStrategy(id: string) {
    const result = await window.api.strategy.get(id);
    return result?.success ? result.strategy : null;
  }
  
  async runBacktest(config: any) {
    return window.api.strategy.backtest(config);
  }
  
  async runWalkForward(config: any) {
    return window.api.backtestEnhanced.walkForward(config);
  }
  
  async runParamScan(config: any) {
    return window.api.backtestEnhanced.paramScan(config);
  }
  
  async getRiskStatus() {
    return window.api.risk.getStatusSnapshot();
  }
  
  async getMarketplaceList(sortBy?: string) {
    const result = await window.api.marketplace.list(sortBy);
    return result?.success ? result.strategies || [] : [];
  }
  
  async getFundamental(symbol: string) {
    return window.api.dataProvider.getFundamental(symbol);
  }
  
  async getCapitalFlow(symbol: string) {
    return window.api.dataProvider.getCapitalFlow(symbol);
  }
  
  async getMarketRegime() {
    return window.api.dataProvider.getRegime();
  }
}

// ── PWA REST API Implementation ────────────────────────────────────────────

class PWAAPI implements UnifiedAPI {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  }
  
  private async fetch(path: string, options?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getBrokerStatus() {
    return this.fetch('/broker/status');
  }
  
  async getAccounts() {
    const result = await this.fetch('/broker/accounts');
    return result.accounts || [];
  }
  
  async getQuotes(codes: string[]) {
    const result = await this.fetch('/broker/quotes', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    });
    return result.quotes || [];
  }
  
  async getStrategies() {
    const result = await this.fetch('/strategies');
    return result.strategies || [];
  }
  
  async getStrategy(id: string) {
    const result = await this.fetch(`/strategies/${id}`);
    return result.strategy;
  }
  
  async runBacktest(config: any) {
    return this.fetch('/backtest', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
  
  async runWalkForward(config: any) {
    return this.fetch('/backtest/walk-forward', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
  
  async runParamScan(config: any) {
    return this.fetch('/backtest/param-scan', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }
  
  async getRiskStatus() {
    return this.fetch('/risk/status');
  }
  
  async getMarketplaceList(sortBy?: string) {
    const result = await this.fetch(`/marketplace?sortBy=${sortBy || 'rating'}`);
    return result.strategies || [];
  }
  
  async getFundamental(symbol: string) {
    return this.fetch(`/data/fundamental/${symbol}`);
  }
  
  async getCapitalFlow(symbol: string) {
    return this.fetch(`/data/capital-flow/${symbol}`);
  }
  
  async getMarketRegime() {
    return this.fetch('/data/regime');
  }
}

// ── Export Unified API Instance ─────────────────────────────────────────────

export const api: UnifiedAPI = PLATFORM === 'electron' 
  ? new ElectronAPI() 
  : new PWAAPI();
