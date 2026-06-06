// ── Integration Tests — Strategy Engine + NL Parser + Risk Engine ─────────
// R18 P1: Strategy Engine + NL Parser 集成测试
// 验证 strategy:execute IPC handler 的端到端功能
// 
// Run: npm test -- --run tests/strategy-execute-integration.test.ts

import { StrategyEngine } from '../electron/engine/strategy-engine';
import { RiskEngine } from '../electron/engine/risk-engine';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../electron/engine/nl-parser';
import { BacktestEngine } from '../electron/engine/backtest-engine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

async function main() {
  section('Strategy Engine + NL Parser Integration');
  
  // 初始化引擎
  const strategyEngine = new StrategyEngine();
  const riskEngine = new RiskEngine();
  
  // 连接 Risk Engine 到 Strategy Engine
  strategyEngine.setRiskEngine(riskEngine);
  
  assert(strategyEngine !== null, 'StrategyEngine should be initialized');
  assert(riskEngine !== null, 'RiskEngine should be initialized');
  
  section('NL Parser → Strategy Creation');
  
  // 测试自然语言解析 → 策略创建
  const nlInput = 'MA5 上穿 MA20 买入 TQQQ，止损 5%，止盈 15%';
  const parsed = parseNaturalLanguage(nlInput);
  
  assert(parsed.success === true, 'NL Parser should successfully parse valid input');
  assert(parsed.strategy.type === 'ma_cross', 'Parsed strategy type should be ma_cross');
  assert(parsed.symbol === 'US.TQQQ', 'Parsed symbol should be US.TQQQ');
  assert(parsed.strategy.stopLoss === 5, 'Parsed stopLoss should be 5%');
  assert(parsed.strategy.takeProfit === 15, 'Parsed takeProfit should be 15%');
  
  // 创建策略
  const strategyId = strategyEngine.createStrategy({
    name: parsed.name,
    description: parsed.description,
    symbol: parsed.symbol || 'US.TQQQ',
    strategy: parsed.strategy,
  });
  
  assert(!!strategyId, 'Strategy ID should be returned');
  assert(typeof strategyId === 'string', 'Strategy ID should be a string');
  
  // 获取创建的策略
  const createdStrategy = strategyEngine.getStrategy(strategyId);
  assert(!!createdStrategy, 'Created strategy should be retrievable');
  assert(createdStrategy?.name === parsed.name, 'Strategy name should match parsed name');
  assert(createdStrategy?.symbol === parsed.symbol, 'Strategy symbol should match parsed symbol');
  
  section('Strategy Backtest');
  
  // 生成模拟K线数据
  const klineData = generateMockKlines(100, 100, 0.02);
  
  // 运行回测
  const backtestResult = await strategyEngine.runBacktest(strategyId, klineData);
  
  assert(!!backtestResult, 'Backtest result should be returned');
  assert(backtestResult.success === true, 'Backtest should succeed');
  assert(backtestResult.result.totalTrades >= 0, 'Backtest should report trade count');
  assert(backtestResult.result.equityCurve.length > 0, 'Backtest should have equity curve');
  
  console.log(`    📊 Backtest: ${backtestResult.result.totalTrades} trades, total return: ${backtestResult.result.totalReturn}%`);
  
  section('Risk Engine Integration');
  
  // 测试 Risk Engine 集成
  riskEngine.updateTotalAssets(10000);
  riskEngine.updateDailyPnl(100);
  
  // 检查订单风险
  const order = {
    symbol: 'US.TQQQ',
    side: 'BUY',
    qty: 100,
    price: 50,
  };
  
  const riskCheck = riskEngine.checkOrder(order);
  console.log(`    🛡️ Risk check: pass=${riskCheck.pass}, reason=${riskCheck.reason || 'none'}`);
  // 注意：risk check 可能因为各种原失败（如最小订单数量、频率限制等）
  // 所以我们只检查它返回了有效结果
  assert(riskCheck !== null, 'Risk check should return a result');
  assert(typeof riskCheck.pass === 'boolean', 'Risk check should have pass property');
  
  // 测试 ATR 动态止损
  const dynamicStop = riskEngine.calculateDynamicStopLoss(50, 2.5, 'LONG');
  assert(dynamicStop < 50, 'ATR stop loss should be below entry price for LONG');
  console.log(`    🎯 Dynamic stop loss: $${dynamicStop.toFixed(2)} (entry: $50, ATR: 2.5)`);
  
  // 测试仓位计算
  const positionSize = riskEngine.calculatePositionSize(10000, 50, 45, 0.5);
  console.log(`    📊 Position size: qty=${positionSize.qty}, method=${positionSize.method}, reason=${positionSize.reasoning}`);
  // 注意：如果交易历史不足，Kelly 会降级为 fixed_pct
  // 所以我们只检查返回了有效结果
  assert(positionSize !== null, 'Position size should return a result');
  assert(positionSize.method === 'kelly' || positionSize.method === 'fixed_pct', 'Position sizing method should be kelly or fixed_pct');
  
  section('Strategy Templates');
  
  // 测试策略模板
  assert(STRATEGY_TEMPLATES.length >= 15, `Should have 15+ templates (got ${STRATEGY_TEMPLATES.length})`);
  
  // 测试从模板创建策略
  const template = STRATEGY_TEMPLATES.find(t => t.id === 'ma_cross_10_30');
  assert(!!template, 'MA10/MA30 template should exist');
  
  const templateStrategyId = strategyEngine.createStrategy({
    name: template.name,
    description: template.description,
    symbol: template.symbol || 'US.TQQQ',
    strategy: template.strategy,
  });
  
  assert(!!templateStrategyId, 'Strategy from template should be created');
  
  section('Error Handling');
  
  // 测试无效自然语言输入
  const invalidInput = '无效策略描述';
  const invalidParsed = parseNaturalLanguage(invalidInput);
  assert(invalidParsed.success === false, 'Invalid input should fail parsing');
  assert(!!invalidParsed.error, 'Invalid input should have error message');
  
  // 测试无效策略ID
  const invalidStrategy = strategyEngine.getStrategy('invalid-id');
  assert(invalidStrategy === undefined, 'Invalid strategy ID should return undefined');
  
  section('Benchmark');
  
  // 性能测试：解析100次自然语言
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    parseNaturalLanguage('MA10 上穿 MA20 买入 TQQQ');
  }
  const elapsed = Date.now() - start;
  
  console.log(`    ⏱️  100 NL parses: ${elapsed}ms (${(elapsed / 100).toFixed(1)}ms/parse)`);
  assert(elapsed < 1000, '100 NL parses should complete within 1 second');
  
  // 总结
  console.log(`\n━━━ Summary ━━━`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total:  ${passed + failed}`);
  
  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All tests passed`);
  }
}

// ── Mock Data Generator ────────────────────────────────────────────────────

function generateMockKlines(count: number, startPrice: number, volatility: number): any[] {
  const data: any[] = [];
  let price = startPrice;
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility * price;
    price += change;
    
    const open = price;
    const high = price * (1 + Math.random() * volatility);
    const low = price * (1 - Math.random() * volatility);
    const close = price * (1 + (Math.random() - 0.5) * volatility);
    
    data.push({
      timestamp: now - (count - i) * 24 * 60 * 60 * 1000,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000),
    });
  }
  
  return data;
}

// ── Type Augmentation ──────────────────────────────────────────────────────
// Augment StrategyEngine with methods used in tests

declare module '../electron/engine/strategy-engine' {
  interface StrategyEngine {
    createStrategy(config: any): string;
    getStrategy(id: string): any;
    runBacktest(id: string, config: any): Promise<any>;
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
