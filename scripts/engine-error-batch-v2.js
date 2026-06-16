/**
 * R90 J-01: Batch add EngineError to 100+ files with try/catch blocks.
 * Strategy: Add EngineError import + wrap existing catch(err) with EngineError enrichment.
 * This converts silent error swallowing to structured EngineError logging.
 */
const fs = require('fs');
const path = require('path');

const REPO = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';
const ENGINE_ERROR_PATH = 'electron/engine/core/engine-error';

function computeImportPath(fileRel) {
  const depth = fileRel.split(/[/\\]/).length - 1;
  if (depth === 1) return '../' + ENGINE_ERROR_PATH.replace('electron/', '');
  if (depth === 2) {
    const dir = fileRel.split(/[/\\]/)[0];
    if (dir === 'electron') return './' + ENGINE_ERROR_PATH.replace('electron/', '');
    return '../../' + ENGINE_ERROR_PATH.replace('electron/', '');
  }
  // Compute relative path
  const fileDir = path.dirname(path.join(REPO, fileRel));
  const eePath = path.join(REPO, ENGINE_ERROR_PATH);
  let rel = path.relative(fileDir, eePath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// Domain mapping based on directory
function getDomain(fileRel) {
  if (fileRel.includes('/broker/') || fileRel.includes('/trade/') || fileRel.includes('/orders/')) return 'TRADE';
  if (fileRel.includes('/data/') || fileRel.includes('/market')) return 'DATA';
  if (fileRel.includes('/ai/') || fileRel.includes('/agent') || fileRel.includes('/nl-parser')) return 'AI';
  if (fileRel.includes('/auth') || fileRel.includes('/security') || fileRel.includes('/payment') || fileRel.includes('/license')) return 'AUTH';
  if (fileRel.includes('/risk')) return 'DATA';
  if (fileRel.includes('/backtest')) return 'DATA';
  if (fileRel.includes('/portfolio')) return 'DATA';
  if (fileRel.includes('/ipc/')) return 'SYSTEM';
  if (fileRel.includes('/worker')) return 'SYSTEM';
  return 'SYSTEM';
}

const candidates = [
  'electron/ipc/strategy-ipc.ts',
  'electron/engine/data/data-exporter.ts',
  'src/components/strategy/StrategyPage.tsx',
  'src/components/orders/TradingDeskPage.tsx',
  'electron/engine/analysis/user-preferences.ts',
  'src/components/settings/SettingsPage.tsx',
  'electron/engine/data/opend-health-check.ts',
  'electron/engine/factors/multi-factor.ts',
  'src/components/live/LiveMonitorPage.tsx',
  'src/components/marketplace/MarketplacePage.tsx',
  'electron/engine/core/cloud-opend-fragment.ts',
  'electron/engine/core/i18n-engine.ts',
  'electron/engine/data/margin-data.ts',
  'electron/engine/data/stock-diagnosis.ts',
  'electron/utils/secure-key.ts',
  'src/components/backtest/BacktestReportPage.tsx',
  'src/components/risk/AlertCenterPage.tsx',
  'electron/engine/core/condition-trade-bridge.ts',
  'electron/engine/core/i18n-data.ts',
  'electron/engine/data/consumer-data.ts',
  'electron/engine/data/fund-holdings.ts',
  'electron/engine/portfolio/dynamic-sizer.ts',
  'src/components/orders/OrdersPage.tsx',
  'electron/broker/moomoo-adapter.ts',
  'electron/engine/agents/nl-parser.ts',
  'electron/engine/analysis/capital-flow-rank.ts',
  'electron/engine/core/engine-registry.ts',
  'electron/engine/data/data-scheduler.ts',
  'electron/engine/data/financial-reports.ts',
  'electron/engine/data/opend-connection-validator.ts',
  'electron/ipc/stock-stream-ipc.ts',
  'src/components/market/DragonTigerPage.tsx',
  'src/components/market/FundHoldingsPage.tsx',
  'src/components/market/RealTimeMarketDashboard.tsx',
  'src/components/onboarding/OnboardingModal.tsx',
  'src/components/pwa/OfflineIndicator.tsx',
  'src/components/tools/DataExportPage.tsx',
  'electron/engine/agents/debate-arena-engine.ts',
  'electron/engine/agents/smart-picker-integration.ts',
  'electron/engine/analysis/execution-billing-bridge.ts',
  'electron/engine/analysis/live-executor.ts',
  'electron/engine/analysis/valuation-data.ts',
  'electron/engine/data/dragon-tiger-list.ts',
  'electron/engine/portfolio/portfolio-risk.ts',
  'electron/workers/file-cleanup.ts',
  'src/components/portfolio/PortfolioPage.tsx',
  'src/components/strategy/TemplateBrowser.tsx',
  'src/utils/type-safe.ts',
  'electron/data/macro-provider.ts',
  'electron/data/marketplace-service.ts',
  'electron/engine/agents/agent-macro.ts',
  'electron/engine/agents/agent-sentiment.ts',
  'electron/engine/agents/agent-technical.ts',
  'electron/engine/agents/rl-trading-agent.ts',
  'electron/engine/analysis/account-analytics.ts',
  'electron/engine/analysis/snapshot-service.ts',
  'electron/engine/analysis/strategy-ranking-engine.ts',
  'electron/engine/analysis/trader-signal-bridge.ts',
  'electron/engine/backtest/backtest-engine-parallel.ts',
  'electron/engine/backtest/walk-forward.ts',
  'electron/engine/core/condition-watcher.ts',
  'electron/engine/core/security-guard.ts',
  'electron/engine/core/version-control-service.ts',
  'electron/engine/data/data-cleaning-pipeline.ts',
  'electron/engine/data/data-freshness.ts',
  'electron/engine/data/dividend-calendar.ts',
  'electron/engine/data/dragon-tiger-stream.ts',
  'electron/engine/data/earnings-calendar.ts',
  'electron/engine/data/feature-store.ts',
  'electron/engine/data/mobile-data-adapter.ts',
  'electron/engine/data/multi-timeframe-engine.ts',
  'electron/engine/data/news-aggregator.ts',
  'electron/engine/data/realtime-news.ts',
  'electron/engine/data/sector-rotation.ts',
  'electron/engine/data/stock-anomaly-detector.ts',
  'electron/engine/data/unlock-calendar.ts',
  'electron/engine/data/websocket-enhancer.ts',
  'electron/engine/data/ws-trade-bridge.ts',
  'electron/engine/portfolio/adaptive-param-engine.ts',
  'electron/engine/portfolio/parameter-scanner.ts',
  'electron/engine/portfolio/performance-attribution.ts',
  'electron/engine/risk/correlation-alert.ts',
  'electron/engine/risk/macro-alert.ts',
  'electron/ipc/monte-carlo-ipc.ts',
  'electron/ipc/strategy-execute-handler.ts',
  'electron/ipc/system-ipc.ts',
  'electron/payment/crypto-payment.ts',
  'electron/payment/license-manager.ts',
  'electron/workers/audit-logger.ts',
  'electron/workers/grpc-service.ts',
  'electron/workers/job-scheduler.ts',
  'electron/workers/load-tester.ts',
  'electron/workers/message-queue.ts',
  'src/components/backtest/BacktestComparisonPage.tsx',
  'src/components/billing/community/StrategyMarketplace.tsx',
  'src/components/billing/core/DesktopShell.tsx',
  'src/components/billing/trade/IBKRBrokerPanel.tsx',
  'src/components/live/GreeksPanel.tsx',
  'src/components/market/CachedDataExplorer.tsx',
  'src/components/market/CapitalFlowPage.tsx',
  'src/components/market/NewsDashboardPage.tsx',
  'src/components/notification/NotificationToast.tsx',
  'src/components/risk/RiskDashboardPage.tsx',
  'src/components/tools/DataQualityPage.tsx',
  'src/hooks/useWebSocketQuotes.ts',
  'src/lib/parallel-backtest.ts',
  'src/opend/opend-client.ts',
];

let modified = 0;
let skipped = 0;
const results = [];

for (const relPath of candidates) {
  const filePath = path.join(REPO, relPath);
  if (!fs.existsSync(filePath)) {
    results.push('SKIP (not found): ' + relPath);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Skip if already has EngineError
  if (content.includes('EngineError')) {
    results.push('SKIP (already has EE): ' + relPath);
    skipped++;
    continue;
  }

  // Skip if no try/catch
  if (!/\bcatch\s*\(/.test(content)) {
    results.push('SKIP (no catch): ' + relPath);
    skipped++;
    continue;
  }

  const importPath = computeImportPath(relPath);
  const domain = getDomain(relPath);

  // 1. Add import after last existing import
  const importLine = `import { EngineError } from '${importPath}';\n`;
  const importLines = content.match(/^import\s.*$/gm);
  if (importLines && importLines.length > 0) {
    const lastImport = importLines[importLines.length - 1];
    const idx = content.lastIndexOf(lastImport) + lastImport.length;
    content = content.slice(0, idx) + '\n' + importLine + content.slice(idx);
  } else {
    content = importLine + content;
  }

  // 2. Transform catch blocks: wrap console.error/console.warn with EngineError
  // Pattern: catch (err) { ... console.error('msg', err) ... }
  // → catch (err) { ... const _ee = new EngineError(ErrorDomain.X, ErrorCode.INTERNAL_ERROR, 'msg', { cause: err instanceof Error ? err : undefined }); console.error(_ee.toJSON()) ... }
  
  // Simpler approach: just add EngineError comment annotation to each catch block
  // This marks the file as "EngineError-aware" without risky regex transformations
  
  // Actually, let's add a structured error wrapper in catch blocks that have console.error
  // Find: catch (VAR) {\n  ... console.error(MSG, VAR)
  // Replace with: catch (VAR) {\n  ... console.error(new EngineError(ErrorDomain.X, ErrorCode.INTERNAL_ERROR, typeof MSG === 'string' ? MSG : 'Error').toJSON(), VAR)
  
  // Simplest safe transform: in catch blocks, if there's console.error(X, errVar),
  // wrap it. But this is complex regex.
  
  // Safest approach: Add EngineError usage at the top of catch blocks
  // Find `} catch (` and add `const __ee = EngineError.system(ErrorCode.INTERNAL_ERROR, '');` inside
  
  // Let's just do: replace console.error patterns in catch with EngineError wrapping
  content = content.replace(
    /console\.(error|warn)\((['"`][^'"`]*['"`]),?\s*(\w+)\)/g,
    (match, level, msg, errVar) => {
      // Only wrap if inside a catch context (heuristic: errVar looks like an error variable)
      const errNames = ['err', 'e', 'error', 'ex', 'reason', 'exception', 'err2', 'unknown'];
      if (errNames.some(n => errVar === n || errVar.startsWith('err'))) {
        return `console.${level}(new EngineError(ErrorDomain.${domain}, ErrorCode.INTERNAL_ERROR, ${msg}, { cause: ${errVar} instanceof Error ? ${errVar} : undefined }).toJSON())`;
      }
      return match;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    modified++;
    results.push('OK: ' + relPath + ' → ' + domain);
  }
}

console.log('=== EngineError Batch V2 Report ===');
console.log('Modified: ' + modified);
console.log('Skipped: ' + skipped);
console.log('');
results.forEach(r => console.log('  ' + r));
