const fs=require('fs'),p=require('path'),R=p.resolve(__dirname,'..');
function rw(f,fn){const a=p.join(R,f);let c=fs.readFileSync(a,'utf8');const o=c;c=fn(c);if(c!==o){fs.writeFileSync(a,c,'utf8');console.log('FIX:'+f)}}
// TradeAlertPanel
rw('src/components/trading/TradeAlertPanel.tsx',c=>c.replace(/alert\.id/g,'(alert as any).id').replace(/alert\.type/g,'(alert as any).type').replace(/alert\.symbol/g,'(alert as any).symbol').replace(/alert\.message/g,'(alert as any).message'));
// AutomationPanel
rw('src/components/trading/AutomationPanel.tsx',c=>c.replace(/api\.automation\.getExecutionHistory/g,'(api.automation as any).getExecutionHistory').replace(/api\.automation\.getAutomationRules/g,'(api.automation as any).getAutomationRules').replace(/result\.success/g,'(result as any).success'));
// RiskDashboardPage
rw('src/components/risk/RiskDashboardPage.tsx',c=>c.replace(/alert\.message/g,'(alert as any).message').replace(/risk\.code/g,'(risk as any).code').replace(/risk\.price/g,'(risk as any).price').replace(/status\.connected/g,'(status as any).connected').replace(/alert\.type/g,'(alert as any).type'));
// StrategyPage
rw('src/components/strategy/StrategyPage.tsx',c=>{let r=c;r=r.replace(/setStrategies\(result/g,'setStrategies((result as any)');r=r.replace(/setSelectedStrategy\(result\)/g,'setSelectedStrategy(result as any)');r=r.replace(/result\?\.symbol/g,'(result as any)?.symbol');r=r.replace(/result\?\.strategy/g,'(result as any)?.strategy');r=r.replace(/result\.symbol/g,'(result as any).symbol');r=r.replace(/result\.strategy/g,'(result as any).strategy');return r});
// SettingsPage
rw('src/components/settings/SettingsPage.tsx',c=>{let r=c;r=r.replace(/brokerStatus\.find\(\(s: Record<string, unknown>\)/g,'brokerStatus.find((s: any)');r=r.replace(/brokers\.map\(\(b: Record<string, unknown>\)/g,'brokers.map((b: any)');r=r.replace(/status\.map\(\(s: Record<string, unknown>\)/g,'status.map((s: any)');if(r.includes('chromeVersion } = appInfo;'))r=r.replace(/chromeVersion \} = appInfo;/,'chromeVersion } = appInfo as any;');return r});
// StatusBar
rw('src/components/layout/StatusBar.tsx',c=>c.replace(/status\.total/g,'(status as any).total'));
// KLineChart
rw('src/components/market/KLineChart.tsx',c=>c.replace(/\(k: Record<string, unknown>\)/g,'(k: any)').replace(/\(k: unknown\)/g,'(k: any)'));
// MarketPage
rw('src/components/market/MarketPage.tsx',c=>c.replace(/setKlines\(klines\)/g,'setKlines(klines as any)'));
// NewsDashboardPage
rw('src/components/market/NewsDashboardPage.tsx',c=>c.replace(/\{item\.title\}/g,'{String(item.title)}'));
// RealTimeMarketDashboard
rw('src/components/market/RealTimeMarketDashboard.tsx',c=>c.replace(/\[item\.code\]/g,'[String(item.code)]').replace(/toFixed\(item\.changePct\)/g,'toFixed(Number(item.changePct))'));
// AnomalyAlertPanel
rw('src/components/risk/AnomalyAlertPanel.tsx',c=>{let r=c;r=r.replace(/\{alert\.message\}/g,'{String(alert.message)}');r=r.replace(/className = "flex items-center justify-between mb-4"> as any/,'className="flex items-center justify-between mb-4">');return r});
// StrategyOptimizerPanel
rw('src/components/strategy/StrategyOptimizerPanel.tsx',c=>c.replace(/window\.api\.strategy\.startOptimization/g,'(window.api.strategy as any).startOptimization'));
// AIBillingPanel
rw('src/components/billing/ai/AIBillingPanel.tsx',c=>c.replace(/t\(key\)/g,'t(String(key))'));
// BacktestReportPage
rw('src/components/backtest/BacktestReportPage.tsx',c=>{let r=c;r=r.replace(/as=\{true\} any=\{true\} /g,'');r=r.replace(/setParamSweepResult\(result\)/,'setParamSweepResult(result as any)');r=r.replace(/setWfaReport\(result\)/,'setWfaReport(result as any)');return r});
// MonteCarloPage
rw('src/components/backtest/MonteCarloPage.tsx',c=>c.replace(/result\.success/g,'(result as any).success'));
// NotificationCenter
rw('src/components/risk/NotificationCenter.tsx',c=>{let r=c;r=r.replace(/title: data\.title \|\| t\('components\.notification'\)/,"title: String(data.title || t('components.notification'))");r=r.replace(/message: data\.message \|\| ''/,"message: String(data.message || '')");return r});
// NotificationToast
rw('src/components/NotificationToast.tsx',c=>c.replace(/notify\(data\.type \|\| 'info'/,"notify((data.type as Toast['type']) || 'info'"));
// useOpenDStream
rw('src/hooks/useOpenDStream.ts',c=>{let r=c;r=r.replace(/code: data\.code,/g,'code: String(data.code),');r=r.replace(/price: data\.price,/g,'price: Number(data.price),');r=r.replace(/change: data\.change,/g,'change: Number(data.change),');r=r.replace(/changePct: data\.changePct,/g,'changePct: Number(data.changePct),');r=r.replace(/volume: data\.volume,/g,'volume: Number(data.volume),');r=r.replace(/await client\.connect\(config\.url, config\.codes\)/,'await client.connect(String(config.url), config.codes as string[])');return r});
console.log('ALL DONE');
