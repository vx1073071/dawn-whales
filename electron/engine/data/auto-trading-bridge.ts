/**
 * R280+ Claw(PM): 自动交易接策略模板桥接
 * 
 * 策略模板信号 → ConditionalOrderEngine → OrderTicketPanel
 * 策略→自动下单最后一公里
 * 
 * 定价: 策略执行服务费 (按v17.9费率: 股票0.1%/加密0.1%最低2积分)
 */
import { EventEmitter } from 'events';

export interface StrategySignal {
  signalId: string;
  templateId: string;
  templateName: string;
  symbol: string;
  action: 'buy' | 'sell' | 'close';
  quantity: number;
  signalStrength: number;  // 0-100
  factors: { factorId: string; factorName: string; currentValue: number; threshold: number; direction: 'long' | 'short' }[];
  confidence: number;
  timestamp: number;
}

export interface AutoTradeConfig {
  strategyId: string;
  enabled: boolean;
  maxCapital: number;
  maxPositionCount: number;
  maxSinglePosition: number;
  stopLoss: number;
  takeProfit: number;
  allowedMarkets: string[];
  tradingHours: { start: string; end: string };
  requireConfirmation: boolean;  // true=用户确认后才下单
}

export interface TradeExecution {
  executionId: string;
  signalId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop';
  quantity: number;
  price: number;
  fee: number;
  status: 'pending' | 'submitted' | 'filled' | 'rejected' | 'error';
  timestamp: number;
}

export class AutoTradingBridge extends EventEmitter {
  private static instance: AutoTradingBridge;
  private configs: Map<string, AutoTradeConfig> = new Map();
  private executions: TradeExecution[] = [];
  private execSeq = 0;

  static getInstance(): AutoTradingBridge {
    if (!this.instance) this.instance = new AutoTradingBridge();
    return this.instance;
  }

  /** 注册策略→自动交易 */
  registerStrategy(config: AutoTradeConfig): void {
    this.configs.set(config.strategyId, config);
    this.emit('strategy:registered', config);
  }

  /** 接收策略信号 → 生成订单 */
  async processSignal(signal: StrategySignal): Promise<TradeExecution> {
    const config = this.configs.get(signal.templateId);
    if (!config || !config.enabled) {
      return this.rejectExecution(signal.signalId, '策略未启用');
    }

    // 风控检查
    if (signal.signalStrength < 40) {
      return this.rejectExecution(signal.signalId, `信号强度不足 (${signal.signalStrength}/100)`);
    }
    if (!config.allowedMarkets.includes(this.extractMarket(signal.symbol))) {
      return this.rejectExecution(signal.signalId, `市场不在允许范围: ${signal.symbol}`);
    }

    // 生成订单
    const execution: TradeExecution = {
      executionId: `TX-${++this.execSeq}`,
      signalId: signal.signalId,
      symbol: signal.symbol,
      side: signal.action === 'close' ? 'sell' : signal.action,
      orderType: signal.signalStrength > 80 ? 'market' : 'limit',
      quantity: Math.min(signal.quantity, config.maxSinglePosition),
      price: 0, // filled by ConditionalOrderEngine
      fee: signal.quantity * 0.001 * 2, // 0.1% × 2积分 (v17.9)
      status: config.requireConfirmation ? 'pending' : 'submitted',
      timestamp: Date.now(),
    };

    this.executions.push(execution);

    if (config.requireConfirmation) {
      this.emit('trade:needs_confirmation', execution);
    } else {
      this.emit('trade:submitted', execution);
      // ConditionalOrderEngine picks up via IPC
    }

    return execution;
  }

  /** 用户确认后执行 */
  confirmExecution(executionId: string): TradeExecution | null {
    const ex = this.executions.find(e => e.executionId === executionId);
    if (!ex || ex.status !== 'pending') return null;
    ex.status = 'submitted';
    this.emit('trade:confirmed', ex);
    return ex;
  }

  /** 获取策略的自动交易状态 */
  getStrategyStatus(strategyId: string): { active: boolean; signals: number; executions: number; totalPnL: number } {
    const config = this.configs.get(strategyId);
    const strategySignals = this.executions.filter(e => {
      const sig = this.executions.find(x => x.signalId === e.signalId);
      return sig?.signalId?.startsWith(strategyId);
    });
    return {
      active: config?.enabled ?? false,
      signals: strategySignals.length,
      executions: strategySignals.filter(e => e.status === 'filled').length,
      totalPnL: 0, // from position engine
    };
  }

  private rejectExecution(signalId: string, reason: string): TradeExecution {
    const ex: TradeExecution = {
      executionId: `TX-${++this.execSeq}`, signalId, symbol: '', side: 'buy',
      orderType: 'market', quantity: 0, price: 0, fee: 0,
      status: 'rejected', timestamp: Date.now(),
    };
    this.emit('trade:rejected', { ...ex, reason });
    return ex;
  }

  private extractMarket(symbol: string): string {
    if (symbol.endsWith('.HK')) return 'HK';
    if (symbol.endsWith('.T')) return 'JP';
    if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'IN';
    if (symbol.endsWith('.KS')) return 'KR';
    if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) return 'TW';
    if (symbol.endsWith('.SA')) return 'BR';
    return 'US';
  }

  getExecutions(limit = 50): TradeExecution[] {
    return this.executions.slice(-limit);
  }

  reset(): void {
    this.configs.clear();
    this.executions = [];
    this.execSeq = 0;
    this.removeAllListeners();
  }
}
