/**
 * R273 NSE印度数据源 v5.0
 * 
 * National Stock Exchange of India:
 *   F&O (Futures & Options): futOpenInterest/optOI/PCR/IV/cost-of-carry
 *   FII/DII (Foreign/Domestic Institutional Investors): net buy/sell
 *   Market wide position limits (MWPL)
 *   Sectoral indices (Nifty 50/Bank Nifty/IT/Pharma)
 *   Cash market delivery %
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NseFuturesData {
  symbol: string;             // e.g. 'RELIANCE', 'TCS'
  name: string;
  expiry: string;             // YYYY-MM-DD (last Thursday of month)
  futOpenInterest: number;    // futures OI (contracts)
  futOIDelta: number;         // OI change vs prev day
  futVolume: number;
  futTurnover: number;        // INR crore
  futPrice: number;
  spotPrice: number;
  costOfCarry: number;        // (fut - spot) / spot × 100
  rolloverPercent: number;    // % rolled to next expiry
  timestamp: number;
}

export interface NseOptionsData {
  symbol: string;
  name: string;
  expiry: string;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
  pcr: number;                // Put/Call ratio (OI based)
  pcrVolume: number;          // Put/Call ratio (volume based)
  maxPain: number;            // strike with max pain
  ivCall: number;             // ATM IV call side
  ivPut: number;              // ATM IV put side
  ivAvg: number;              // average IV
  timestamp: number;
}

export interface NseFiiDiiData {
  date: string;
  fiiGrossBuy: number;        // INR crore
  fiiGrossSell: number;
  fiiNet: number;
  diiGrossBuy: number;
  diiGrossSell: number;
  diiNet: number;
  fiiIndexFutNet: number;     // Index futures net
  fiiStockFutNet: number;     // Stock futures net
  fiiIndexOptNet: number;     // Index options net
  timestamp: number;
}

export interface NseCashDelivery {
  symbol: string;
  name: string;
  date: string;
  deliveryQty: number;
  tradedQty: number;
  deliveryPercent: number;    // deliveryQty / tradedQty × 100
  deliveryValue: number;      // INR crore
}

export interface NseSectorIndex {
  index: string;              // e.g. 'NIFTY 50', 'BANK NIFTY'
  name: string;
  value: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  timestamp: number;
}

export interface NseSignal {
  signalId: string;
  symbol: string;
  type: 'oi_buildup' | 'oi_unwinding' | 'pcr_extreme' | 'iv_spike' | 'fii_surge' | 'high_delivery' | 'rollover_alert';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageCn: string;
  data: unknown;
  createdAt: number;
}

export interface NseSummary {
  date: string;
  fiiDii: NseFiiDiiData | null;
  niftyLevel: number;
  niftyChange: number;
  marketPcr: number;
  totalFutOpenInterest: number;
  topGainers: NseFuturesData[];  // OI increased most
  topLosers: NseFuturesData[];   // OI decreased most
  signals: NseSignal[];
  activeFutures: number;
  activeOptions: number;
  updatedAt: number;
}

// ── Data Source ────────────────────────────────────────────────────────────

export class NseDataSource extends EventEmitter {
  private futures_: Map<string, NseFuturesData[]> = new Map();
  private options_: Map<string, NseOptionsData[]> = new Map();
  private fiiDii_: NseFiiDiiData[] = [];
  private deliveries_: Map<string, NseCashDelivery[]> = new Map();
  private sectors_: NseSectorIndex[] = [];
  private signals_: NseSignal[] = [];
  private summary_: NseSummary | null = null;

  // Thresholds
  private readonly FII_ALERT_NET = 5000;  // 5000 crore net = alert
  private readonly PCR_EXTREME_HIGH = 1.5;
  private readonly PCR_EXTREME_LOW = 0.5;
  private readonly DELIVERY_HIGH = 70;     // 70% delivery = strong hands
  private readonly OI_CHANGE_ALERT = 20;   // 20% OI change

  // ── FII/DII ────────────────────────────────────────────────────────────

  ingestFiiDii(data: Omit<NseFiiDiiData, 'timestamp'>): NseSignal[] {
    const record: NseFiiDiiData = { ...data, timestamp: Date.now() };
    this.fiiDii_.push(record);
    const signals: NseSignal[] = [];

    if (Math.abs(record.fiiNet) >= this.FII_ALERT_NET) {
      const direction = record.fiiNet > 0 ? 'bought' : 'sold';
      signals.push({
        signalId: `nse_fii_${record.date}_${Date.now()}`,
        symbol: 'NSE', type: 'fii_surge',
        severity: Math.abs(record.fiiNet) >= 10000 ? 'critical' : 'warning',
        message: `FII net ${direction} ₹${Math.abs(record.fiiNet).toLocaleString()}cr`,
        messageCn: `FII净${record.fiiNet > 0 ? '买入' : '卖出'} ₹${Math.abs(record.fiiNet).toLocaleString()}千万卢比`,
        data: record, createdAt: Date.now(),
      });
    }

    if (signals.length > 0) {
      this.signals_.push(...signals);
      this.emit('fii_signal', signals);
    }

    this._updateSummary();
    return signals;
  }

  // ── F&O ────────────────────────────────────────────────────────────────

  ingestFutures(records: NseFuturesData[]): NseSignal[] {
    const signals: NseSignal[] = [];

    for (const rec of records) {
      if (!this.futures_.has(rec.symbol)) this.futures_.set(rec.symbol, []);
      this.futures_.get(rec.symbol)!.push(rec);

      // OI change alert
      const prev = this.futures_.get(rec.symbol)!.length >= 2
        ? this.futures_.get(rec.symbol)![this.futures_.get(rec.symbol)!.length - 2]
        : null;

      if (prev && prev.futOpenInterest > 0) {
        const oiChange = ((rec.futOpenInterest - prev.futOpenInterest) / prev.futOpenInterest) * 100;
        if (Math.abs(oiChange) >= this.OI_CHANGE_ALERT) {
          const direction = oiChange > 0 ? 'build-up' : 'unwinding';
          const priceMove = ((rec.futPrice - prev.futPrice) / prev.futPrice) * 100;
          const type = direction === 'build-up' ? 'oi_buildup' : 'oi_unwinding';

          signals.push({
            signalId: `nse_oi_${rec.symbol}_${Date.now()}`,
            symbol: rec.symbol, type,
            severity: Math.abs(oiChange) >= 50 ? 'critical' : 'warning',
            message: `${rec.symbol} OI ${direction} ${Math.abs(oiChange).toFixed(1)}% | Price ${priceMove >= 0 ? '+' : ''}${priceMove.toFixed(1)}%`,
            messageCn: `${rec.symbol} 持仓${direction === 'build-up' ? '增加' : '减少'} ${Math.abs(oiChange).toFixed(1)}% | 价格${priceMove >= 0 ? '+' : ''}${priceMove.toFixed(1)}%`,
            data: { record: rec, oiChange, priceMove }, createdAt: Date.now(),
          });
        }
      }

      // Rollover alert
      if (rec.rolloverPercent >= 80) {
        signals.push({
          signalId: `nse_roll_${rec.symbol}_${Date.now()}`,
          symbol: rec.symbol, type: 'rollover_alert', severity: 'info',
          message: `${rec.symbol} rollover ${rec.rolloverPercent.toFixed(0)}%`,
          messageCn: `${rec.symbol} 展期率 ${rec.rolloverPercent.toFixed(0)}%`,
          data: rec, createdAt: Date.now(),
        });
      }
    }

    if (signals.length > 0) {
      this.signals_.push(...signals);
      this.emit('fo_signal', signals);
    }

    this._updateSummary();
    return signals;
  }

  ingestOptions(records: NseOptionsData[]): NseSignal[] {
    const signals: NseSignal[] = [];

    for (const rec of records) {
      if (!this.options_.has(rec.symbol)) this.options_.set(rec.symbol, []);
      this.options_.get(rec.symbol)!.push(rec);

      if (rec.pcr >= this.PCR_EXTREME_HIGH) {
        signals.push({
          signalId: `nse_pcr_${rec.symbol}_${Date.now()}`,
          symbol: rec.symbol, type: 'pcr_extreme', severity: 'warning',
          message: `${rec.symbol} PCR ${rec.pcr.toFixed(2)} - bearish extreme`,
          messageCn: `${rec.symbol} PCR ${rec.pcr.toFixed(2)} - 极度看空`,
          data: rec, createdAt: Date.now(),
        });
      } else if (rec.pcr <= this.PCR_EXTREME_LOW) {
        signals.push({
          signalId: `nse_pcr_${rec.symbol}_${Date.now()}`,
          symbol: rec.symbol, type: 'pcr_extreme', severity: 'warning',
          message: `${rec.symbol} PCR ${rec.pcr.toFixed(2)} - bullish extreme`,
          messageCn: `${rec.symbol} PCR ${rec.pcr.toFixed(2)} - 极度看多`,
          data: rec, createdAt: Date.now(),
        });
      }

      if (rec.ivAvg >= 35) {
        signals.push({
          signalId: `nse_iv_${rec.symbol}_${Date.now()}`,
          symbol: rec.symbol, type: 'iv_spike', severity: 'critical',
          message: `${rec.symbol} IV spike to ${rec.ivAvg.toFixed(1)}%`,
          messageCn: `${rec.symbol} 隐含波动率飙升 ${rec.ivAvg.toFixed(1)}%`,
          data: rec, createdAt: Date.now(),
        });
      }
    }

    if (signals.length > 0) { this.signals_.push(...signals); this.emit('fo_signal', signals); }
    return signals;
  }

  // ── Cash Delivery ──────────────────────────────────────────────────────

  ingestDelivery(records: NseCashDelivery[]): NseSignal[] {
    const signals: NseSignal[] = [];
    for (const rec of records) {
      if (!this.deliveries_.has(rec.symbol)) this.deliveries_.set(rec.symbol, []);
      this.deliveries_.get(rec.symbol)!.push(rec);

      if (rec.deliveryPercent >= this.DELIVERY_HIGH) {
        signals.push({
          signalId: `nse_del_${rec.symbol}_${Date.now()}`,
          symbol: rec.symbol, type: 'high_delivery', severity: 'info',
          message: `${rec.symbol} delivery ${rec.deliveryPercent.toFixed(1)}% - strong hands`,
          messageCn: `${rec.symbol} 交割率 ${rec.deliveryPercent.toFixed(1)}% - 资金建仓`,
          data: rec, createdAt: Date.now(),
        });
      }
    }
    if (signals.length > 0) { this.signals_.push(...signals); this.emit('delivery_signal', signals); }
    return signals;
  }

  // ── Sector Indices ────────────────────────────────────────────────────

  ingestSectors(indices: NseSectorIndex[]): void {
    this.sectors_ = indices;
    this._updateSummary();
  }

  // ── Summary ───────────────────────────────────────────────────────────

  private _updateSummary(): void {
    const fiiDii = this.fiiDii_.length > 0 ? this.fiiDii_[this.fiiDii_.length - 1] : null;
    const allFuts: NseFuturesData[] = [];
    for (const recs of this.futures_.values()) allFuts.push(...recs);
    const uniqueSymbols = new Set(allFuts.map(f => f.symbol));

    const latestBySymbol = new Map<string, NseFuturesData>();
    for (const f of allFuts) {
      if (!latestBySymbol.has(f.symbol) || f.timestamp > latestBySymbol.get(f.symbol)!.timestamp) {
        latestBySymbol.set(f.symbol, f);
      }
    }
    const sorted = [...latestBySymbol.values()];
    const topGainers = sorted.sort((a, b) => b.futOIDelta - a.futOIDelta).slice(0, 10);
    const topLosers = sorted.sort((a, b) => a.futOIDelta - b.futOIDelta).slice(0, 10);

    const nifty = this.sectors_.find(s => s.index === 'NIFTY 50');

    this.summary_ = {
      date: new Date().toISOString().slice(0, 10),
      fiiDii,
      niftyLevel: nifty?.value || 0,
      niftyChange: nifty?.changePercent || 0,
      marketPcr: 0,
      totalFutOpenInterest: sorted.reduce((s, f) => s + f.futOpenInterest, 0),
      topGainers, topLosers,
      signals: this.signals_.filter(s => s.createdAt > Date.now() - 86400000),
      activeFutures: uniqueSymbols.size,
      activeOptions: 0,
      updatedAt: Date.now(),
    };
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getSummary(): NseSummary | null { return this.summary_; }

  getFiiDii(limit = 30): NseFiiDiiData[] {
    return this.fiiDii_.slice(-limit);
  }

  getFutures(symbol: string, limit = 30): NseFuturesData[] {
    return (this.futures_.get(symbol) || []).slice(-limit);
  }

  getOptions(symbol: string, limit = 30): NseOptionsData[] {
    return (this.options_.get(symbol) || []).slice(-limit);
  }

  getSignals(symbol?: string, type?: NseSignal['type'], limit = 50): NseSignal[] {
    let results = [...this.signals_];
    if (symbol) results = results.filter(s => s.symbol === symbol);
    if (type) results = results.filter(s => s.type === type);
    return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  getDelivery(symbol: string, limit = 30): NseCashDelivery[] {
    return (this.deliveries_.get(symbol) || []).slice(-limit);
  }

  getSectors(): NseSectorIndex[] { return [...this.sectors_]; }

  getTrackedSymbols(): string[] {
    const symbols = new Set<string>();
    for (const k of this.futures_.keys()) symbols.add(k);
    for (const k of this.options_.keys()) symbols.add(k);
    return [...symbols];
  }

  /** Aggregate market-wide FII/DII flow */
  getFiiFlowStats(days = 30): {
    totalFiiNet: number; totalDiiNet: number;
    fiiAvg: number; diiAvg: number;
    streak: { direction: string; days: number };
  } {
    const slice = this.fiiDii_.slice(-days);
    const totalFii = slice.reduce((s, r) => s + r.fiiNet, 0);
    const totalDii = slice.reduce((s, r) => s + r.diiNet, 0);

    let streakDir = '';
    let streakDays = 0;
    for (let i = slice.length - 1; i >= 0; i--) {
      const dir = slice[i].fiiNet > 0 ? 'buy' : 'sell';
      if (streakDir === '') streakDir = dir;
      if (dir === streakDir) streakDays++;
      else break;
    }

    return {
      totalFiiNet: totalFii, totalDiiNet: totalDii,
      fiiAvg: totalFii / days, diiAvg: totalDii / days,
      streak: { direction: streakDir, days: streakDays },
    };
  }

  reset(): void {
    this.futures_ = new Map();
    this.options_ = new Map();
    this.fiiDii_ = [];
    this.deliveries_ = new Map();
    this.sectors_ = [];
    this.signals_ = [];
    this.summary_ = null;
  }
}

export const nseDataSource = new NseDataSource();
