// ── Strategy Execute Handler — 自然语言 → 策略 → 回测 → 结果 ─────────
// R18 P1: Strategy Engine + NL Parser 集成
// IPC Handler: strategy:execute
//
// 功能：
// 1. 接受自然语言输入
// 2. 使用 NL Parser 解析策略
// 3. 创建策略
// 4. 运行回测
// 5. 返回结果（如果回测成功，可选启动模拟交易）

import { parseNaturalLanguage } from '../engine/agents/nl-parser';
import { StrategyEngine } from '../engine/analysis/strategy-engine';
import { RiskEngine } from '../engine/risk/risk-engine';
import { BacktestEngine } from '../engine/backtest/backtest-engine';
import log from 'electron-log';
import i18n from '../../src/i18n';

export interface StrategyExecuteRequest {
  /** 自然语言策略描述 */
  input: string;
  /** 回测配置 */
  backtest?: {
    /** K线数据 */
    klines: any[];
    /** 初始资金 */
    initialCapital?: number;
  };
  /** 是否自动启动模拟交易（回测成功後） */
  autoSimulate?: boolean;
}

export interface StrategyExecuteResponse {
  success: boolean;
  /** 解析结果 */
  parsed?: {
    name: string;
    description: string;
    strategy: unknown;
    symbol: string;
  };
  /** 创建的策略ID */
  strategyId?: string;
  /** 回测结果 */
  backtest?: unknown;
  /** 错误信息 */
  error?: string;
}

/**
 * 处理 strategy:execute IPC 请求
 */
export async function handleStrategyExecute(
  request: StrategyExecuteRequest,
  dependencies: {
    strategyEngine: StrategyEngine;
    riskEngine: RiskEngine;
    backtestEngine: BacktestEngine;
  }
): Promise<StrategyExecuteResponse> {
  const { input, backtest, autoSimulate } = request;
  const { strategyEngine, riskEngine } = dependencies;

  try {
    // 1. 自然语言解析
    log.info(`[StrategyExecute] Parsing: "${input}"`);
    const parsed = parseNaturalLanguage(input);
    
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error || i18n.t('strategyExecuteHandler.k1'),
      };
    }

    log.info(`[StrategyExecute] Parsed: ${parsed.strategy.type} - ${parsed.name}`);

    // 2. 创建策略
    const strategyId = strategyEngine.createStrategy({
      name: parsed.name,
      description: parsed.description,
      symbol: parsed.symbol || 'US.TQQQ',
      strategy: parsed.strategy,
    });

    log.info(`[StrategyExecute] Created strategy: ${strategyId}`);

    // 3. 运行回测（如果提供了回测数据）
    let backtestResult = null;
    if (backtest && backtest.klines && backtest.klines.length > 0) {
      log.info(`[StrategyExecute] Running backtest with ${backtest.klines.length} bars...`);
      
      const result = await strategyEngine.runBacktest(strategyId, backtest.klines);
      
      if (result.success) {
        backtestResult = result.result;
        log.info(`[StrategyExecute] Backtest done: ${backtestResult.totalReturn}% return, ${backtestResult.totalTrades} trades`);
        
        // 4. 可选：自动启动模拟交易
        if (autoSimulate && backtestResult.totalReturn > 0) {
          log.info(`[StrategyExecute] Auto-starting simulation for ${strategyId}`);
          strategyEngine.startLive(strategyId);
        }
      } else {
        log.warn(`[StrategyExecute] Backtest failed:`, result.error);
      }
    }

    // 5. 返回结果
    return {
      success: true,
      parsed: {
        name: parsed.name,
        description: parsed.description,
        strategy: parsed.strategy,
        symbol: parsed.symbol || 'US.TQQQ',
      },
      strategyId,
      backtest: backtestResult,
    };

  } catch (err) {
    log.error('[StrategyExecute] Error:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * 注册 strategy:execute IPC handler
 */
export function registerStrategyExecuteHandler(
  ipcMain: unknown,
  dependencies: {
    strategyEngine: StrategyEngine;
    riskEngine: RiskEngine;
    backtestEngine: BacktestEngine;
  }
) {
  ipcMain.handle('strategy:execute', async (_event: unknown, request: StrategyExecuteRequest) => {
    return await handleStrategyExecute(request, dependencies);
  });

  log.info('[StrategyExecute] IPC handler registered: strategy:execute');
}
