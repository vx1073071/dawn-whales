/**
 * R273 KRX/TWSE 韩台数据源 v5.0
 * 
 * Korea Exchange (KRX) + Taiwan Stock Exchange (TWSE):
 *   三大法人买卖超 (Foreign/Investment Trust/Dealer)
 *   外资期货未平仓 (Foreign inst futures OI)
 *   融资融券余额 (Margin trading balance)
 *   韩国: KOSPI/KOSDAQ 指数 + 外资持股
 *   台湾: 加权指数/柜买指数 + 外资汇出入
 *   跨国法人比较
 */
import { EventEmitter } from 'events';

// ── Common Types ───────────────────────────────────────────────────────────

export interface InstitutionalFlow {
  symbol: string;               // index or stock code
  name: string;
  market: 'KRX' | 'TWSE';
  date: string;
  foreignNet: number;           // 外资 buy - sell (KRW bn / TWD mn)
  foreignBuy: number;
  foreignSell: number;
  invTrustNet: number;          // 投信 buy - sell
  invTrustBuy: number;
  invTrustSell: number;
  dealerNet: number;            // 自营商 buy - sell (dealer proprietary)
  dealerBuy: number;
  dealerSell: number;
  dealerHedgeNet?: number;      // 自营商避险 (TWSE specific)
  totalNet: number;             // sum of all three
  timestamp: number;
}

export interface ForeignFuturesOI {
  symbol: string;
  market: 'KRX' | 'TWSE';
  date: string;
  longOI: number;               // contracts
  shortOI: number;
  netOI: number;                // long - short
  oiChange: number;             // vs prev day
  timestamp: number;
}

export interface MarginTrading {
  symbol: string;
  market: 'KRX' | 'TWSE';
  date: string;
  marginBuyBalance: number;     // 融资余额 (KRW 100mn / TWD mn)
  marginSellBalance: number;    // 融券余额 (short selling balance)
  marginBuyNew: number;         // 当日融资买进
  marginSellNew: number;        // 当日融券卖出
  marginBuyRepay: number;       // 融资偿还
  marginSellRepay: number;      // 融券偿还
  marginRatio: number;          // buy / sell
  shortRatio: number;           // sell / (buy + sell) × 100
  timestamp: number;
}

export interface MarketIndex {
  index: string;
  name: string;
  market: 'KRX' | 'TWSE';
  value: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  turnover: number;
  timestamp: number;
}

export interface KrxTwseSignal {
  signalId: string;
  market: 'KRX' | 'TWSE';
  symbol: string;
  type: 'foreign_surge' | 'foreign_exit' | 'trust_surge' | 'dealer_surge' | 'oi_flip' | 'margin_extreme' | 'divergence';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageCn: string;
  data: unknown;
  createdAt: number;
}

export interface KrxTwseSummary {
  date: string;
  krxIndex: MarketIndex | null;
  twseIndex: MarketIndex | null;
  krxFlow: InstitutionalFlow | null;
  twseFlow: InstitutionalFlow | null;
  krxMargin: MarginTrading | null;
  twseMargin: MarginTrading | null;
  signals: KrxTwseSignal[];
  updatedAt: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const KRX_INDICES = [
  { index: 'KOSPI', name: 'KOSPI' },
  { index: 'KOSDAQ', name: 'KOSDAQ' },
  { index: 'KOSPI200', name: 'KOSPI 200' },
];

const TWSE_INDICES = [
  { index: 'TAIEX', name: 'Weighted Index' },
  { index: 'TPEX', name: 'TPEx (OTC)' },
  { index: 'TAIEX_FUT', name: 'TAIEX Futures' },
];

// ── Data Source ────────────────────────────────────────────────────────────

export class KrxTwseDataSource extends EventEmitter {
  private krxFlow_: InstitutionalFlow[] = [];
  private twseFlow_: InstitutionalFlow[] = [];
  private krxFutOI_: ForeignFuturesOI[] = [];
  private twseFutOI_: ForeignFuturesOI[] = [];
  private krxMargin_: MarginTrading[] = [];
  private twseMargin_: MarginTrading[] = [];
  private krxIndex_: MarketIndex | null = null;
  private twseIndex_: MarketIndex | null = null;
  private signals_: KrxTwseSignal[] = [];
  private summary_: KrxTwseSummary | null = null;

  // Thresholds
  private readonly SURGE_MULTIPLE = 3;       // 3× average = surge
  private readonly OI_FLIP_THRESHOLD = 5000; // OI flip > 5000 contracts
  private readonly MARGIN_EXTREME = 80;      // margin ratio > 80× or < 0.2×

  // ── Institutional Flow ─────────────────────────────────────────────────

  ingestFlow(market: 'KRX' | 'TWSE', data: Omit<InstitutionalFlow, 'timestamp'>): KrxTwseSignal[] {
    const record: InstitutionalFlow = { ...data, timestamp: Date.now() };
    const signals: KrxTwseSignal[] = [];

    if (market === 'KRX') {
      this.krxFlow_.push(record);
    } else {
      this.twseFlow_.push(record);
    }

    // Foreign surge detection
    const history = market === 'KRX' ? this.krxFlow_ : this.twseFlow_;
    if (history.length >= 6) {
      const prev5 = history.slice(-6, -1);
      const avgAbsForeign = prev5.reduce((s, r) => s + Math.abs(r.foreignNet), 0) / 5;

      if (avgAbsForeign > 0 && Math.abs(record.foreignNet) > avgAbsForeign * this.SURGE_MULTIPLE) {
        const direction = record.foreignNet > 0 ? 'bought' : 'sold';
        const currency = market === 'KRX' ? 'KRW bn' : 'TWD mn';
        signals.push({
          signalId: `${market}_foreign_${record.date}_${Date.now()}`,
          market, symbol: record.symbol,
          type: record.foreignNet > 0 ? 'foreign_surge' : 'foreign_exit',
          severity: Math.abs(record.foreignNet) > avgAbsForeign * 5 ? 'critical' : 'warning',
          message: `Foreign investors net ${direction} ${Math.abs(record.foreignNet)} ${currency}`,
          messageCn: `外资净${direction === 'bought' ? '买入' : '卖出'} ${Math.abs(record.foreignNet)} ${currency}`,
          data: record, createdAt: Date.now(),
        });
      }

      // Trust surge
      const avgAbsTrust = prev5.reduce((s, r) => s + Math.abs(r.invTrustNet), 0) / 5;
      if (avgAbsTrust > 0 && Math.abs(record.invTrustNet) > avgAbsTrust * this.SURGE_MULTIPLE) {
        signals.push({
          signalId: `${market}_trust_${record.date}_${Date.now()}`,
          market, symbol: record.symbol,
          type: 'trust_surge', severity: 'warning',
          message: `Inv trust net ${record.invTrustNet > 0 ? 'bought' : 'sold'} ${Math.abs(record.invTrustNet)}`,
          messageCn: `投信净${record.invTrustNet > 0 ? '买超' : '卖超'} ${Math.abs(record.invTrustNet)}`,
          data: record, createdAt: Date.now(),
        });
      }
    }

    // Divergence detection (foreign vs dealer opposite direction)
    if (Math.abs(record.foreignNet) > 0 && Math.abs(record.dealerNet) > 0) {
      if ((record.foreignNet > 0 && record.dealerNet < 0) || (record.foreignNet < 0 && record.dealerNet > 0)) {
        if (Math.abs(record.foreignNet) > 1000 && Math.abs(record.dealerNet) > 500) {
          signals.push({
            signalId: `${market}_div_${record.date}_${Date.now()}`,
            market, symbol: record.symbol,
            type: 'divergence', severity: 'info',
            message: `Foreign vs Dealer divergence: ${record.foreignNet} vs ${record.dealerNet}`,
            messageCn: `外资/自营商背离: ${record.foreignNet} vs ${record.dealerNet}`,
            data: record, createdAt: Date.now(),
          });
        }
      }
    }

    if (signals.length > 0) { this.signals_.push(...signals); this.emit('flow_signal', signals); }
    this._updateSummary();
    return signals;
  }

  // ── Foreign Futures OI ────────────────────────────────────────────────

  ingestFuturesOI(market: 'KRX' | 'TWSE', data: Omit<ForeignFuturesOI, 'timestamp'>): KrxTwseSignal[] {
    const record: ForeignFuturesOI = { ...data, timestamp: Date.now() };
    const signals: KrxTwseSignal[] = [];

    const arr = market === 'KRX' ? this.krxFutOI_ : this.twseFutOI_;
    arr.push(record);

    // OI flip detection
    const prev = arr.length >= 2 ? arr[arr.length - 2] : null;
    if (prev) {
      const wasLong = prev.netOI > 0;
      const isShort = record.netOI < 0;
      const change = Math.abs(record.netOI - prev.netOI);
      if (wasLong && isShort && change >= this.OI_FLIP_THRESHOLD) {
        signals.push({
          signalId: `${market}_oi_flip_${record.date}_${Date.now()}`,
          market, symbol: record.symbol,
          type: 'oi_flip', severity: 'critical',
          message: `Foreign OI flipped from long to short ${record.netOI} contracts`,
          messageCn: `外资期货OI翻空 ${record.netOI}口`,
          data: record, createdAt: Date.now(),
        });
      } else if (!wasLong && !isShort && prev.netOI < 0 && record.netOI > 0 && change >= this.OI_FLIP_THRESHOLD) {
        signals.push({
          signalId: `${market}_oi_flip_${record.date}_${Date.now()}`,
          market, symbol: record.symbol,
          type: 'oi_flip', severity: 'critical',
          message: `Foreign OI flipped from short to long +${record.netOI} contracts`,
          messageCn: `外资期货OI翻多 +${record.netOI}口`,
          data: record, createdAt: Date.now(),
        });
      }
    }

    if (signals.length > 0) { this.signals_.push(...signals); this.emit('oi_signal', signals); }
    return signals;
  }

  // ── Margin Trading ────────────────────────────────────────────────────

  ingestMargin(market: 'KRX' | 'TWSE', data: Omit<MarginTrading, 'timestamp'>): KrxTwseSignal[] {
    const record: MarginTrading = { ...data, timestamp: Date.now() };
    const signals: KrxTwseSignal[] = [];

    const arr = market === 'KRX' ? this.krxMargin_ : this.twseMargin_;
    arr.push(record);

    if (market === 'KRX') this.krxMargin_ = arr;
    else this.twseMargin_ = arr;

    if (record.marginRatio >= this.MARGIN_EXTREME || record.marginRatio <= 0.2) {
      signals.push({
        signalId: `${market}_margin_${record.date}_${Date.now()}`,
        market, symbol: record.symbol,
        type: 'margin_extreme',
        severity: record.marginRatio >= this.MARGIN_EXTREME ? 'warning' : 'critical',
        message: `${market} margin ratio ${record.marginRatio.toFixed(1)}x (extreme)`,
        messageCn: `${market} 融资融券比 ${record.marginRatio.toFixed(1)}倍`,
        data: record, createdAt: Date.now(),
      });
    }

    if (signals.length > 0) { this.signals_.push(...signals); this.emit('margin_signal', signals); }
    return signals;
  }

  // ── Market Index ──────────────────────────────────────────────────────

  ingestIndex(data: Omit<MarketIndex, 'timestamp'>): void {
    const record: MarketIndex = { ...data, timestamp: Date.now() };
    if (data.market === 'KRX') this.krxIndex_ = record;
    else this.twseIndex_ = record;
    this._updateSummary();
  }

  // ── Summary ───────────────────────────────────────────────────────────

  private _updateSummary(): void {
    this.summary_ = {
      date: new Date().toISOString().slice(0, 10),
      krxIndex: this.krxIndex_,
      twseIndex: this.twseIndex_,
      krxFlow: this.krxFlow_.length > 0 ? this.krxFlow_[this.krxFlow_.length - 1] : null,
      twseFlow: this.twseFlow_.length > 0 ? this.twseFlow_[this.twseFlow_.length - 1] : null,
      krxMargin: this.krxMargin_.length > 0 ? this.krxMargin_[this.krxMargin_.length - 1] : null,
      twseMargin: this.twseMargin_.length > 0 ? this.twseMargin_[this.twseMargin_.length - 1] : null,
      signals: this.signals_.filter(s => s.createdAt > Date.now() - 86400000),
      updatedAt: Date.now(),
    };
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getSummary(): KrxTwseSummary | null { return this.summary_; }

  getFlow(market: 'KRX' | 'TWSE', limit = 30): InstitutionalFlow[] {
    const arr = market === 'KRX' ? this.krxFlow_ : this.twseFlow_;
    return arr.slice(-limit);
  }

  getFuturesOI(market: 'KRX' | 'TWSE', limit = 30): ForeignFuturesOI[] {
    const arr = market === 'KRX' ? this.krxFutOI_ : this.twseFutOI_;
    return arr.slice(-limit);
  }

  getMargin(market: 'KRX' | 'TWSE', limit = 30): MarginTrading[] {
    const arr = market === 'KRX' ? this.krxMargin_ : this.twseMargin_;
    return arr.slice(-limit);
  }

  getSignals(market?: 'KRX' | 'TWSE', type?: KrxTwseSignal['type'], limit = 50): KrxTwseSignal[] {
    let results = [...this.signals_];
    if (market) results = results.filter(s => s.market === market);
    if (type) results = results.filter(s => s.type === type);
    return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  getIndex(market: 'KRX' | 'TWSE'): MarketIndex | null {
    return market === 'KRX' ? this.krxIndex_ : this.twseIndex_;
  }

  /** Compare institutional flows across markets */
  compareMarkets(): {
    krx: { foreignNet: number; trustNet: number; dealerNet: number; daysActive: number };
    twse: { foreignNet: number; trustNet: number; dealerNet: number; daysActive: number };
  } {
    const krxRecent = this.krxFlow_.slice(-5);
    const twseRecent = this.twseFlow_.slice(-5);

    return {
      krx: {
        foreignNet: krxRecent.reduce((s, r) => s + r.foreignNet, 0),
        trustNet: krxRecent.reduce((s, r) => s + r.invTrustNet, 0),
        dealerNet: krxRecent.reduce((s, r) => s + r.dealerNet, 0),
        daysActive: this.krxFlow_.length,
      },
      twse: {
        foreignNet: twseRecent.reduce((s, r) => s + r.foreignNet, 0),
        trustNet: twseRecent.reduce((s, r) => s + r.invTrustNet, 0),
        dealerNet: twseRecent.reduce((s, r) => s + r.dealerNet, 0),
        daysActive: this.twseFlow_.length,
      },
    };
  }

  /** Get foreign flow streak */
  getForeignStreak(market: 'KRX' | 'TWSE'): { direction: string; days: number } {
    const arr = market === 'KRX' ? this.krxFlow_ : this.twseFlow_;
    let dir = '';
    let days = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      const d = arr[i].foreignNet > 0 ? 'buy' : 'sell';
      if (dir === '') dir = d;
      if (d === dir) days++;
      else break;
    }
    return { direction: dir, days };
  }

  reset(): void {
    this.krxFlow_ = [];
    this.twseFlow_ = [];
    this.krxFutOI_ = [];
    this.twseFutOI_ = [];
    this.krxMargin_ = [];
    this.twseMargin_ = [];
    this.krxIndex_ = null;
    this.twseIndex_ = null;
    this.signals_ = [];
    this.summary_ = null;
  }
}

export const krxTwseDataSource = new KrxTwseDataSource();
