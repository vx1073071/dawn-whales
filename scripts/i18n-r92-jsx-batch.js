// R92: Batch replace CJK in JSX text + string literals with i18n.t()
// + Auto-add keys to all 9 locale files
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CJK_GLOBAL = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

// Simple CJK→English for auto-generated keys
function cjkToEnglishKey(text) {
  // Strip non-CJK, emojis, and special chars for key generation
  const cjkOnly = text.replace(/[^\u4e00-\u9fff]/g, '');
  return cjkOnly.substring(0, 20);
}

// Translation map for common UI strings
const TRANS = {
  '出了点小问题': 'Something went wrong',
  '应用遇到意外错误，已自动保存你的数据。': 'An unexpected error occurred. Your data has been auto-saved.',
  '请点击下方按钮恢复，或稍等自动恢复。': 'Click the button below to recover, or wait for auto-recovery.',
  '错误详情': 'Error Details',
  '立即恢复': 'Recover Now',
  '你的策略和资金始终安全': 'Your strategies and funds are always safe',
  '错误已自动上报': 'Error auto-reported',
  '崩溃恢复演示': 'Crash Recovery Demo',
  '点击下方按钮模拟应用崩溃': 'Click button below to simulate app crash',
  '模拟崩溃': 'Simulate Crash',
  '崩溃后将展示友好恢复页面，点击恢复按钮即可回到正常': 'After crash, a recovery page will appear. Click recover to return to normal.',
  '秒后自动恢复': 's auto-recover',
  '等待恢复': 'Wait for Recovery',
  '隐藏堆栈': 'Hide Stack',
  '查看堆栈': 'View Stack',
  '未知错误': 'Unknown Error',
  '选择市场': 'Select Market',
  '选择模板': 'Select Template',
  '调整参数': 'Adjust Parameters',
  '回测验证': 'Backtest Verify',
  '发布上线': 'Go Live',
  '取消': 'Cancel',
  '确认': 'Confirm',
  '保存': 'Save',
  '删除': 'Delete',
  '编辑': 'Edit',
  '搜索': 'Search',
  '刷新': 'Refresh',
  '导出': 'Export',
  '导入': 'Import',
  '加载中': 'Loading',
  '暂无数据': 'No Data',
  '成功': 'Success',
  '失败': 'Failed',
  '错误': 'Error',
  '警告': 'Warning',
  '提示': 'Tip',
  '信息': 'Info',
  '提交中': 'Submitting',
  '连接中': 'Connecting',
  '已连接': 'Connected',
  '未连接': 'Disconnected',
  '新手引导中心': 'Beginner Guide Center',
  '画线工具': 'Drawing Tools',
  '形态识别': 'Pattern Recognition',
  '画线列表': 'Drawing List',
  '标注': 'Annotate',
  '修正': 'Correct',
  '自动识别趋势线': 'Auto-detect Trend Lines',
  '支撑阻力': 'Support/Resistance',
  '通道': 'Channel',
  '斐波那契': 'Fibonacci',
  '江恩': 'Gann',
  '形态半透明标注': 'Pattern Semi-transparent Annotations',
  '点击标签切换可见': 'Click label to toggle visibility',
  '举例': 'Example',
  '最大回撤': 'Max Drawdown',
  '胜率': 'Win Rate',
  '我们不说': "We don't say",
  '我们说': 'We say',
  '旧': 'Old',
  '新': 'New',
  '通过': 'Pass',
  '最终打磨面板': 'Final Polish Panel',
  '轮开发': 'rounds of development',
  '测试': 'tests',
  '组件': 'components',
  '深浅双模式': 'dark/light dual mode',
  '最终走查': 'final walkthrough',
  '路线': 'roadmap',
  '安全清理': 'security cleanup',
  '引擎补全': 'engine completion',
  '测试打磨': 'test polish',
  '增长上线': 'growth launch',
  '最终收尾': 'final wrap-up',
  '质量基线': 'Quality baseline',
  '功能': 'Features',
  '市场': 'markets',
  '因子': 'factors',
  '模板': 'templates',
  '指标': 'indicators',
  '画线': 'drawing',
  '形态': 'patterns',
  '半透明标注': 'semi-transparent annotations',
  '策略社区': 'strategy community',
  '支付': 'payment',
  '邀请裂变': 'invite referral',
  '转账': 'transfer',
  '成就系统': 'achievement system',
  '深色': 'dark',
  '浅色': 'light',
  '双主题': 'dual theme',
  '语言': 'languages',
  '响应式': 'responsive',
  '私行金': 'private gold',
  '栅格': 'grid',
  '数据中心': 'Data Center',
  '数据导出': 'Data Export',
  '选择格式': 'Select Format',
  '选择日期范围': 'Select Date Range',
  '开始日期': 'Start Date',
  '结束日期': 'End Date',
  '导出数据': 'Export Data',
  '数据质量': 'Data Quality',
  '数据新鲜度': 'Data Freshness',
  '完整性': 'Completeness',
  '一致性': 'Consistency',
  '准确性': 'Accuracy',
  '数据源': 'Data Source',
  '回测报告': 'Backtest Report',
  '绩效指标': 'Performance Metrics',
  '交易记录': 'Trade Records',
  '权益曲线': 'Equity Curve',
  '月度收益': 'Monthly Returns',
  '参数扫描': 'Parameter Scan',
  '最优参数': 'Optimal Parameters',
  '收益分析': 'Return Analysis',
  '风险分析': 'Risk Analysis',
  '信号预览': 'Signal Preview',
  '策略信号': 'Strategy Signals',
  '买入信号': 'Buy Signal',
  '卖出信号': 'Sell Signal',
  '持有信号': 'Hold Signal',
  '通知中心': 'Notification Center',
  '价格预警': 'Price Alert',
  '系统日志': 'System Log',
  '交易日志': 'Trading Journal',
  '持仓监控': 'Position Monitor',
  '风控配置': 'Risk Config',
  '市场情绪': 'Market Sentiment',
  '市场宽度': 'Market Breadth',
  '市场时钟': 'Market Clock',
  '板块热力图': 'Sector Heatmap',
  '涨跌排行': 'Movers',
  '资产配置': 'Asset Allocation',
  '压力测试': 'Stress Test',
  '相关性分析': 'Correlation Analysis',
  '每日盈亏': 'Daily P&L',
  '经济日历': 'Economic Calendar',
  '桌面通知': 'Desktop Notification',
  '实时行情': 'Real-time Market',
  '策略优化器': 'Strategy Optimizer',
  '策略导入导出': 'Strategy Import/Export',
  '社区排行榜': 'Community Leaderboard',
  '黑名单管理': 'Blacklist Management',
  '安全中心': 'Security Center',
  '争议中心': 'Dispute Center',
  '钱包': 'Wallet',
  '充值': 'Deposit',
  '提现': 'Withdraw',
  '交易历史': 'Transaction History',
  '账单': 'Bill',
  '积分': 'Points',
  '等级': 'Level',
  '经验': 'Experience',
  '升级': 'Upgrade',
  '邀请好友': 'Invite Friends',
  '分享': 'Share',
  '复制链接': 'Copy Link',
  '二维码': 'QR Code',
  '扫码': 'Scan QR',
  '支付方式': 'Payment Method',
  '余额': 'Balance',
  '手续费': 'Fee',
  '汇率': 'Exchange Rate',
  '确认支付': 'Confirm Payment',
  '支付成功': 'Payment Success',
  '支付失败': 'Payment Failed',
  '订单号': 'Order No.',
  '订单详情': 'Order Details',
  '订单状态': 'Order Status',
  '待支付': 'Pending Payment',
  '已支付': 'Paid',
  '已取消': 'Cancelled',
  '已退款': 'Refunded',
  '处理中': 'Processing',
  '审核中': 'Under Review',
  '已通过': 'Approved',
  '已拒绝': 'Rejected',
  '已过期': 'Expired',
  '有效': 'Valid',
  '无效': 'Invalid',
};

// Process a single file: find CJK in JSX text and replace with i18n.t()
function processFile(filePath, componentName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let keyIdx = 0;
  const newKeys = {};
  let changes = 0;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Skip if no CJK
    if (!CJK.test(trimmed)) {
      newLines.push(line);
      continue;
    }

    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      newLines.push(line);
      continue;
    }

    // Skip lines that are already i18n.t() calls
    if (trimmed.includes("i18n.t('") && !CJK.test(trimmed.replace(/i18n\.t\('[^']*'\)/g, ''))) {
      newLines.push(line);
      continue;
    }

    // Skip regex patterns (lines with /[...CJK...]/)
    if (trimmed.match(/\/.*[\u4e00-\u9fff].*\//)) {
      newLines.push(line);
      continue;
    }

    // Skip import statements
    if (trimmed.startsWith('import ')) {
      newLines.push(line);
      continue;
    }

    // Try to replace CJK text segments
    let newLine = line;

    // Pattern 1: JSX text >中文文本< → >{i18n.t('Component.kN')}<
    const jsxTextRe = />([^<]*[\u4e00-\u9fff][^<]*)</g;
    let jsxMatch;
    while ((jsxMatch = jsxTextRe.exec(newLine)) !== null) {
      const text = jsxMatch[1].trim();
      if (!CJK.test(text)) continue;

      // Check if it's a simple text (no JSX expressions like {var})
      const hasExpressions = /\{[^}]+\}/.test(text);
      if (hasExpressions) {
        // Complex JSX with expressions - skip for now, handle manually
        continue;
      }

      const key = `${componentName}.r92_${keyIdx}`;
      const trans = TRANS[text] || text; // Use translation or keep Chinese as placeholder
      newKeys[key] = trans;
      newLine = newLine.replace(jsxMatch[1], `{i18n.t('${key}')}`);
      keyIdx++;
      changes++;
    }

    // Pattern 2: String literals '中文' or "中文"
    const strRe = /(['"])([^'"\n]*[\u4e00-\u9fff][^'"\n]*)\1/g;
    let strMatch;
    const replacements = [];
    while ((strMatch = strRe.exec(newLine)) !== null) {
      const quote = strMatch[1];
      const text = strMatch[2];
      // Skip if inside i18n.t() call
      const beforeMatch = newLine.substring(0, strMatch.index);
      if (beforeMatch.endsWith("i18n.t(")) continue;
      // Skip if it's a regex pattern
      if (beforeMatch.endsWith('/') || beforeMatch.match(/\/[^/]*$/)) continue;

      const key = `${componentName}.r92_${keyIdx}`;
      const trans = TRANS[text] || text;
      newKeys[key] = trans;
      replacements.push({ from: strMatch[0], to: `i18n.t('${key}')` });
      keyIdx++;
      changes++;
    }
    for (const r of replacements.reverse()) {
      newLine = newLine.replace(r.from, r.to);
    }

    newLines.push(newLine);
  }

  if (changes > 0) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  }
  return { changes, newKeys };
}

// Target files (top CJK offenders in src/)
const targets = [
  { file: 'src/common/ErrorBoundary.tsx', name: 'ErrorBoundary' },
  { file: 'src/components/billing/core/GAFinalPanel.tsx', name: 'GAFinalPanel' },
  { file: 'src/components/billing/ai/AIDrawingPatternPanel.tsx', name: 'AIDrawingPatternPanel' },
  { file: 'src/components/billing/wallet/USDTPaymentPanel.tsx', name: 'USDTPaymentPanel' },
  { file: 'src/components/billing/core/CopyPolish.tsx', name: 'CopyPolish' },
  { file: 'src/components/marketplace/MarketplacePage.tsx', name: 'MarketplacePage' },
  { file: 'src/components/billing/core/GuestModeShell.tsx', name: 'GuestModeShell' },
  { file: 'src/components/billing/trade/DataSourcePanel.tsx', name: 'DataSourcePanel' },
  { file: 'src/components/dashboard/DesktopNotificationPanel.tsx', name: 'DesktopNotificationPanel' },
  { file: 'src/components/tools/DataExportPage.tsx', name: 'DataExportPage' },
  { file: 'src/components/billing/market/BacktestPerformancePanel.tsx', name: 'BacktestPerformancePanel' },
  { file: 'src/components/billing/core/LandingPageV18.tsx', name: 'LandingPageV18' },
  { file: 'src/components/billing/trade/IBKRBrokerPanel.tsx', name: 'IBKRBrokerPanel' },
  { file: 'src/components/billing/community/CreatorLeaderboard.tsx', name: 'CreatorLeaderboard' },
  { file: 'src/components/billing/wallet/P2PBlacklistPanel.tsx', name: 'P2PBlacklistPanel' },
  { file: 'src/components/strategy/StrategyOptimizerPanel.tsx', name: 'StrategyOptimizerPanel' },
  { file: 'src/components/backtest/BacktestReportPage.tsx', name: 'BacktestReportPage' },
  { file: 'src/components/billing/core/UIAuditPanel.tsx', name: 'UIAuditPanel' },
  { file: 'src/components/billing/core/DesktopShell.tsx', name: 'DesktopShell' },
  { file: 'src/components/strategy/StrategyImportExportUI.tsx', name: 'StrategyImportExportUI' },
];

let totalChanges = 0;
const allNewKeys = {};

for (const t of targets) {
  if (!fs.existsSync(t.file)) { console.log(`SKIP: ${t.file} not found`); continue; }
  const { changes, newKeys } = processFile(t.file, t.name);
  if (changes > 0) {
    console.log(`  ${t.file}: ${changes} replacements`);
    totalChanges += changes;
    Object.assign(allNewKeys, newKeys);
  }
}

console.log(`\nTotal: ${totalChanges} replacements, ${Object.keys(allNewKeys).length} new keys`);

// Add keys to zh-CN.json
if (Object.keys(allNewKeys).length > 0) {
  const localePath = 'src/i18n/locales/zh-CN.json';
  const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));

  // Group keys by component
  for (const [key, value] of Object.entries(allNewKeys)) {
    const [comp, k] = key.split('.');
    if (!locale[comp]) locale[comp] = {};
    locale[comp][k] = value;
  }

  fs.writeFileSync(localePath, JSON.stringify(locale, null, 2) + '\n', 'utf8');
  console.log(`Added ${Object.keys(allNewKeys).length} keys to zh-CN.json`);

  // Also add to en.json (use English translation or Chinese as placeholder)
  const enPath = 'src/i18n/locales/en.json';
  if (fs.existsSync(enPath)) {
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    for (const [key, value] of Object.entries(allNewKeys)) {
      const [comp, k] = key.split('.');
      if (!en[comp]) en[comp] = {};
      en[comp][k] = TRANS[value] || value; // Use English if available
    }
    fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
    console.log(`Added ${Object.keys(allNewKeys).length} keys to en.json`);
  }

  // Add to remaining locale files (use Chinese as placeholder)
  const otherLocales = ['zh-HK.json', 'zh-TW.json', 'ja.json', 'ko.json', 'fr.json', 'it.json', 'de.json'];
  for (const locFile of otherLocales) {
    const locPath = `src/i18n/locales/${locFile}`;
    if (!fs.existsSync(locPath)) continue;
    const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    for (const [key, value] of Object.entries(allNewKeys)) {
      const [comp, k] = key.split('.');
      if (!loc[comp]) loc[comp] = {};
      loc[comp][k] = value; // Chinese placeholder for now
    }
    fs.writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n', 'utf8');
  }
  console.log(`Added keys to ${otherLocales.length} other locale files`);
}

// Save keys for reference
fs.writeFileSync('scripts/i18n-r92-new-keys.json', JSON.stringify(allNewKeys, null, 2));
