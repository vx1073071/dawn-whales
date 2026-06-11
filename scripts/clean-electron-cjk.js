/**
 * Clean CJK from electron/ source files
 * Strategy:
 * 1. Comments with CJK → English equivalents or remove
 * 2. Chinese number formatting (亿/万) → English (B/W)
 * 3. Regex patterns in NL parser → Unicode escapes
 */
const fs = require('fs');
const path = require('path');

// Translation maps for common comment CJK patterns
const COMMENT_REPLACEMENTS = [
  // data-provider.ts
  [/market cap \(亿\)/g, 'market cap (100M CNY)'],
  [/revenue \(亿\)/g, 'revenue (100M CNY)'],
  [/net profit \(亿\)/g, 'net profit (100M CNY)'],
  [/净资产收益率/g, 'ROE'],
  [/资产负债率/g, 'debt ratio'],
  [/revenue增长率/g, 'revenue growth rate'],
  [/利润增长率/g, 'profit growth rate'],
  [/major player净流入 \(万\)/g, 'net inflow (10K CNY)'],
  [/超大单流入/g, 'super-large order inflow'],
  [/大单流入/g, 'large order inflow'],
  [/中单流入/g, 'mid order inflow'],
  [/小单流入/g, 'small order inflow'],
  [/24h（financial report不常变）/g, '24h (financial reports rarely change)'],
  [/资金面 0-100/g, 'capital flow 0-100'],
  [/异动 0-100 \(越高越危险\)/g, 'anomaly 0-100 (higher = riskier)'],
  [/default中性/g, 'default neutral'],
  
  // consumer-data.ts
  [/社会消费品零售总额 \(亿元\)/g, 'total retail sales (100M CNY)'],
  [/同比增速 %/g, 'YoY growth %'],
  [/环比增速 %/g, 'MoM growth %'],
  [/城镇零售/g, 'urban retail'],
  [/乡村零售/g, 'rural retail'],
  [/网上零售/g, 'online retail'],
  [/餐饮收入/g, 'catering revenue'],
  [/商品零售/g, 'goods retail'],
  [/消费者信心index/g, 'consumer confidence index'],
  [/预期index/g, 'expectation index'],
  [/满意index/g, 'satisfaction index'],
  [/收入信心/g, 'income confidence'],
  [/就业信心/g, 'employment confidence'],
  
  // backtest-engine.ts
  [/总收益率 %/g, 'total return %'],
  [/盈亏比/g, 'profit factor'],
  [/平均交易收益 %/g, 'avg trade return %'],
  [/平均position\/holding bar 数/g, 'avg holding bars'],
  [/手续费率 \(0.001 = 0.1%\)/g, 'commission rate (0.001 = 0.1%)'],
  [/滑点 \(0.001 = 0.1%\)/g, 'slippage (0.001 = 0.1%)'],
  [/如果已提供，直接用；否则从 OpenD 拉/g, 'if provided, use directly; else fetch from OpenD'],
  
  // walk-forward.ts + engine
  [/步进窗口数量/g, 'number of walk-forward windows'],
  [/样本内数据占比 \(0.5-0.9\)/g, 'in-sample ratio (0.5-0.9)'],
  [/每个窗口最少交易笔数/g, 'min trades per window'],
  [/parameter名 \(如 'shortPeriod'\)/g, "parameter name (e.g. 'shortPeriod')"],
  [/候选值 \[5, 10, 15, 20\]/g, 'candidate values [5, 10, 15, 20]'],
  [/要扫描的parameter范围/g, 'param ranges to scan'],
  [/IS 窗口大小 \(如 252\)/g, 'IS window size (e.g. 252)'],
  [/OOS 窗口大小 \(如 63\)/g, 'OOS window size (e.g. 63)'],
  [/滑动步长 \(如 21\)/g, 'step size (e.g. 21)'],
  [/OOS\/IS 衰减比/g, 'OOS/IS decay ratio'],
  [/平均衰减比 \(>0.5 说明稳健\)/g, 'avg decay ratio (>0.5 means robust)'],
  [/0-100 稳定性评分/g, '0-100 stability score'],
  
  // parameter-scanner + v2
  [/最优parameter/g, 'best params'],
  [/最稳健parameter/g, 'most robust params'],
  [/Top 10 parameter组合/g, 'Top 10 param combinations'],
  [/邻域分析/g, 'neighborhood analysis'],
  [/neighborAvg \/ bestSharpe \(>0.7 稳健\)/g, 'neighborAvg / bestSharpe (>0.7 robust)'],
  [/最大memory使用（结果数量），default 1000/g, 'max memory usage (result count), default 1000'],
  [/用于计算方差/g, 'for variance calculation'],
  [/保留 Top 100/g, 'keep Top 100'],
  [/增量统计/g, 'incremental statistics'],
  [/估算/g, 'est.'],
  
  // anomaly-detection.ts
  [/价格偏离standard deviation倍数/g, 'price deviation in std devs'],
  [/volume偏离standard deviation倍数/g, 'volume deviation in std devs'],
  [/volatility偏离standard deviation倍数/g, 'volatility deviation in std devs'],
  [/历史数据窗口大小/g, 'historical data window size'],
  [/检查interval（毫秒）/g, 'check interval (ms)'],
  [/3个standard deviation/g, '3 std devs'],
  [/1分钟/g, '1 minute'],
  
  // capital-flow-monitor.ts
  [/金额 \(万元\)/g, 'amount (10K CNY)'],
  [/major player净流入threshold \(万元\), default 5000/g, 'main force net inflow threshold (10K CNY), default 5000'],
  [/大单threshold \(万元\), default 1000/g, 'large order threshold (10K CNY), default 1000'],
  [/同一股票告警interval \(ms\), default 300000 \(5min\)/g, 'same symbol alert interval (ms), default 300000 (5min)'],
  [/5000万/g, '50M'],
  [/1000万/g, '10M'],
  [/major player占比>30% 且 turnover>1亿/g, 'main force ratio >30% and turnover >100M'],
  
  // quote-stream.ts  
  [/开盘价/g, 'open'],
  [/昨收价/g, 'prev close'],
  
  // risk-metrics.ts
  [/总收益率 %/g, 'total return %'],
  [/年化volatility %/g, 'annualized volatility %'],
  [/downside volatility率 %/g, 'downside volatility %'],
  
  // multi-market-broker.ts
  [/整手股数/g, 'board lot size'],
  [/碎股标记/g, 'fragmented flag'],
  [/盘前盘后/g, 'pre/post market'],
  
  // creator-tier-engine.ts
  [/累计AI分析次数/g, 'total AI analysis count'],
  [/currentsubscribe数/g, 'current subscribers'],
  [/累计模板销量/g, 'total template sales'],
  [/7日win rate \(0-1\)/g, '7-day win rate (0-1)'],
  [/累计收益 USDT/g, 'total revenue USDT'],
  [/连续亏损天数/g, 'consecutive loss days'],
  [/creator占比/g, 'creator share'],
  
  // strategy-marketplace-search.ts
  [/subscribe数/g, 'subscribers'],
  [/user评分 \(1-5\)/g, 'user rating (1-5)'],
  [/风险越低越好/g, 'lower risk is better'],
  
  // sector-rotation-v2.ts
  [/Net capital inflow \(万元\)/g, 'Net capital inflow (10K CNY)'],
  
  // cron-scheduler.ts
  [/工作日9:00/g, 'weekday 9:00AM'],
  
  // compliance-report-engine.ts
  [/24 小时/g, '24 hours'],
  [/去重/g, 'deduplicate'],
  
  // anomaly-detector.ts
  [/threshold可以调整/g, 'threshold is adjustable'],
  
  // data-quality files
  [/threshold.*可以调整/g, 'threshold is adjustable'],
  
  // blacklist-manager.ts
  [/可选expiry时间/g, 'optional expiry'],
  [/关联的transferID/g, 'linked transfer IDs'],
  [/始终允许的地址/g, 'always allowed addresses'],
  
  // walk-forward-engine
  [/关键parameter稳定性/g, 'key param stability'],
  
  // general number formatting
  [/(\d+(?:\.\d+)?)万/g, (_, n) => `${(parseFloat(n)/10).toFixed(1)}M`],
  [/(\d+(?:\.\d+)?)亿/g, (_, n) => `${parseFloat(n)}00M`],
  [/万/g, 'W'],
  [/亿/g, 'B'],
];

// Process a single file
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [pattern, replacement] of COMMENT_REPLACEMENTS) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      modified = true;
      content = newContent;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

// Walk electron directory
let cleaned = 0;
function walk(dd) {
  for (const f of fs.readdirSync(dd)) {
    const p = path.join(dd, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (!f.startsWith('.') && !['node_modules', 'dist', 'coverage'].includes(f)) {
        walk(p);
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')) {
      if (processFile(p)) {
        cleaned++;
        console.log('  ✓ ' + path.relative('.', p));
      }
    }
  }
}

walk('electron');
console.log(`\nCleaned ${cleaned} files`);
