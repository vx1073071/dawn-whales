// ── Strategy Execute Handler — language → strategy/policy → backtest → ─────────
// R18 P1: Strategy Engine + NL Parser 
// IPC Handler: strategy:execute
//
// ：
// 1. language
// 2. NL Parser strategy/policy
// 3. strategy/policy
// 4. backtest
// 5. back（backtestsuccess 

import { parseNaturalLanguage } from '../engine/agents/nl-parser';
import { StrategyEngine } from '../engine/analysis/strategy-engine';
import { RiskEngine } from '../engine/risk/risk-engine';
import { BacktestEngine } from '../engine/backtest/backtest-engine';
import log from 'electron-log';
import i18n from '../../src/i18n';
import { EngineError } from './engine/core/engine-error';


export interface StrategyExecuteRequest {
 /** languagestrategy/policy */
  input: string;
  /** backtestconfig */
  backtest?: {
 /** K */
    klines: any[];
 /** */
    initialCapital?: number;
  };
 /** （backtestsuccess） */
  autoSimulate?: boolean;
}

export interface StrategyExecuteResponse {
  success: boolean;
 /** */
  parsed?: {
    name: string;
    description: string;
    strategy: unknown;
    symbol: string;
  };
 /** strategy/policyID */
  strategyId?: string;
  /** backtest result */
  backtest?: unknown;
  /** errorinfo */
  error?: string;
}

/**
 * strategy:execute IPC request
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
 // 1. language
    log.info(`[StrategyExecute] Parsing: "${input}"`);
    const parsed = parseNaturalLanguage(input);
    
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error || i18n.t('strategyExecuteHandler.k1'),
      };
    }

    log.info(`[StrategyExecute] Parsed: ${parsed.strategy.type} - ${parsed.name}`);

 // 2. strategy/policy
    const strategyId = strategyEngine.createStrategy({
      name: parsed.name,
      description: parsed.description,
      symbol: parsed.symbol || 'US.TQQQ',
      strategy: parsed.strategy,
    });

    log.info(`[StrategyExecute] Created strategy: ${strategyId}`);

 // 3. backtest（backtest）
    let backtestResult = null;
    if (backtest && backtest.klines && backtest.klines.length > 0) {
      log.info(`[StrategyExecute] Running backtest with ${backtest.klines.length} bars...`);
      
      const result = await strategyEngine.runBacktest(strategyId, backtest.klines);
      
      if (result.success) {
        backtestResult = result.result;
        log.info(`[StrategyExecute] Backtest done: ${backtestResult.totalReturn}% return, ${backtestResult.totalTrades} trades`);
        
 // 4. ：
        if (autoSimulate && backtestResult.totalReturn > 0) {
          log.info(`[StrategyExecute] Auto-starting simulation for ${strategyId}`);
          strategyEngine.startLive(strategyId);
        }
      } else {
        log.warn(`[StrategyExecute] Backtest failed:`, result.error);
      }
    }

 // 5. back
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
 * register strategy:execute IPC handler
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
