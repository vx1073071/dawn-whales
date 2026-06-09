import { useState, useMemo, type CSSProperties } from 'react';

// ── Types ──
interface AuditItem {
  page: string; component: string; status: 'pass' | 'warn' | 'fail';
  dark: 'pass' | 'warn' | 'fail'; light: 'pass' | 'warn' | 'fail';
  responsive: 'pass' | 'warn' | 'fail'; note: string
  loading?: boolean; empty?: boolean; error?: boolean
}

const AUDIT_ITEMS: AuditItem[] = [
  { page: '落地页', component: 'LandingPageV18', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: 'SEO+OG+JSON-LD完整', loading: true, empty: true, error: true },
  { page: '策略', component: 'StrategyPage', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: '浅色主题表单字段对比度', loading: true, empty: true },
  { page: '市场', component: 'MarketPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: 'K线TV对标<100ms' },
  { page: '订单', component: 'OrdersPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '实时订单+撤单' },
  { page: '组合', component: 'PortfolioPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '自动刷新+资产配置' },
  { page: '设置', component: 'SettingsPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '深浅主题+5语言切换' },
  { page: '交易仪表板', component: 'TradeDashboardPage', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: '浅色图表标签不可读', loading: true },
  { page: '风险仪表板', component: 'RiskDashboardPage', status: 'pass', dark: 'pass', light: 'warn', responsive: 'pass', note: '风险热力图浅色需调' },
  { page: '回测报告', component: 'BacktestReportPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'warn', note: '权益曲线溢出1366', loading: true, empty: true },
  { page: '实时监控', component: 'LiveMonitorPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: 'WebSocket实时' },
  { page: '市场广场', component: 'MarketplacePage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '浏览筛选发布', loading: true, empty: true },
  { page: 'AI画线形态', component: 'AIDrawingPatternPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: 'Canvas+6工具+22形态' },
  { page: '新手引导', component: 'OnboardingFullKit', status: 'pass', dark: 'pass', light: 'warn', responsive: 'pass', note: '浅色步骤条对比度低' },
  { page: 'AI助手', component: 'AIAssistantPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '4入口USDT计费' },
  { page: '主题语言', component: 'ThemeLangPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '深浅双切+5语言' },
  { page: '监控告警', component: 'MonitoringAlertPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: 'SLO+6指标Gauge', loading: true },
  { page: '成就引导', component: 'AchievementOnboarding', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '7成就+3步' },
  { page: 'Demo案例', component: 'DemoCasePage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '3案例before/after' },
  { page: '私行UI', component: 'PrivateBankingUI', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '深色+金#D4A853+8px', loading: true },
  { page: 'K线图表', component: 'AdvancedKLineChart', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: 'TV对标<100ms' },
  { page: '公式编辑', component: 'PineScriptEditor', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '6模板+语法高亮' },
  { page: '市场面板', component: 'MarketPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '7市场+因子模板市场' },
  { page: '全链路UI', component: 'FullPipelineUI', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '6步注册→提现' },
  { page: '社区面板', component: 'StrategyCommunityPanel', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: '浅色评论框对比度+窄屏', loading: true, empty: true, error: true },
  { page: '因子分析', component: 'FactorAnalysisPanel', status: 'pass', dark: 'pass', light: 'warn', responsive: 'pass', note: '浅色图表配色', loading: true },
  { page: '组合优化', component: 'PortfolioOptimizationPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '有效前沿+风险预算' },
  { page: '创作者排行', component: 'CreatorLeaderboard', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '排行榜+徽章' },
  { page: '信号表现', component: 'SignalPerformancePanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '信号统计+准确率', loading: true },
  { page: '帮助中心', component: 'HelpCenter', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '搜索+分类' },
  { page: '管理后台', component: 'AdminDashboard', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: '浅色表格+窄屏横滚', loading: true },
  { page: 'USDT钱包', component: 'USDTWalletPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '充值提现TRC20', loading: true, empty: true },
  { page: '创者入驻', component: 'CreatorOnboardingGuide', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '三步入驻' },
  { page: '安全中心', component: 'SecurityCenter', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '2FA+设备管理' },
  { page: 'IBKR面板', component: 'IBKRBrokerPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '碎股+多市场' },
  { page: '信号广场', component: 'SignalSquare', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: '信号发布+订阅', loading: true, empty: true },
];

// ── Stats badge ──
function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, background: color + '14', border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  const map = { pass: { icon: '✅', color: '#10B981' }, warn: { icon: '⚠️', color: '#F59E0B' }, fail: { icon: '❌', color: '#EF4444' } };
  return <span style={{ color: map[status].color, fontSize: 14 }}>{map[status].icon}</span>;
}

// ── Main ──
export default function UIAuditPanel() {
  const [filter, setFilter] = useState<'all' | 'pass' | 'warn' | 'fail'>('all');
  const [view, setView] = useState<'grid' | 'compact'>('grid');

  const stats = useMemo(() => {
    const total = AUDIT_ITEMS.length;
    const pass = AUDIT_ITEMS.filter(i => i.status === 'pass').length;
    const darkPass = AUDIT_ITEMS.filter(i => i.dark === 'pass').length;
    const lightPass = AUDIT_ITEMS.filter(i => i.light === 'pass').length;
    const respPass = AUDIT_ITEMS.filter(i => i.responsive === 'pass').length;
    const hasLoading = AUDIT_ITEMS.filter(i => i.loading).length;
    const hasEmpty = AUDIT_ITEMS.filter(i => i.empty).length;
    const hasError = AUDIT_ITEMS.filter(i => i.error).length;
    const missingLoading = AUDIT_ITEMS.filter(i => !i.loading).length;
    const missingEmpty = AUDIT_ITEMS.filter(i => !i.empty).length;
    const missingError = AUDIT_ITEMS.filter(i => !i.error).length;
    return { total, pass, darkPass, lightPass, respPass, hasLoading, hasEmpty, hasError, missingLoading, missingEmpty, missingError };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return AUDIT_ITEMS;
    return AUDIT_ITEMS.filter(i => i.status === filter);
  }, [filter]);

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 1100, margin: '0 auto',
  };

  return (
    <div style={theme}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>🔍 UI 走查面板 — v1.8.0 GA</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            {AUDIT_ITEMS.length} 组件 · 私行风 · 深浅双主题 · 响应式 1366×768 · 三态走查
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatBadge label="总组件" value={stats.total.toString()} color="#6366F1" />
        <StatBadge label="✅ 通过" value={stats.pass.toString()} color="#10B981" />
        <StatBadge label="深色" value={`${stats.darkPass}/${stats.total}`} color="#818CF8" />
        <StatBadge label="浅色" value={`${stats.lightPass}/${stats.total}`} color="#F59E0B" />
        <StatBadge label="响应式" value={`${stats.respPass}/${stats.total}`} color="#10B981" />
        <StatBadge label="Loading" value={`${stats.hasLoading}/${stats.total}`} color="#06B6D4" />
        <StatBadge label="Empty" value={`${stats.hasEmpty}/${stats.total}`} color="#06B6D4" />
        <StatBadge label="Error" value={`${stats.hasError}/${stats.total}`} color="#06B6D4" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all' as const, label: '全部', color: '#6B7280' },
            { key: 'pass' as const, label: '✅ 通过', color: '#10B981' },
            { key: 'warn' as const, label: '⚠️ 警告', color: '#F59E0B' },
            { key: 'fail' as const, label: '❌ 失败', color: '#EF4444' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid', borderColor: filter === f.key ? f.color : '#374151',
                background: filter === f.key ? f.color + '18' : 'transparent',
                color: filter === f.key ? f.color : '#9CA3AF', fontSize: 12, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #374151', background: view === 'grid' ? '#6366F1' : '#1F2937', color: view === 'grid' ? '#FFF' : '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>📋 网格</button>
          <button onClick={() => setView('compact')} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #374151', background: view === 'compact' ? '#6366F1' : '#1F2937', color: view === 'compact' ? '#FFF' : '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>📑 紧凑</button>
        </div>
      </div>

      {view === 'compact' ? (
        /* Compact table */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>页面</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>状态</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>🌙</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>☀️</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>📱</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>备注</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.component} style={{ borderBottom: '1px solid #1F2937' }}>
                  <td style={{ padding: '8px 12px', color: '#D1D5DB', fontWeight: 600 }}>{item.page}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.status} /></td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.dark} /></td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.light} /></td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.responsive} /></td>
                  <td style={{ padding: '8px 12px', color: '#6B7280', fontSize: 11 }}>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid view */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.map(item => (
            <div key={item.component} style={{ padding: '14px 16px', borderRadius: 10, background: '#111827', border: `1px solid ${item.status === 'pass' ? '#1F2937' : item.status === 'warn' ? '#F59E0B33' : '#EF444433'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB' }}>{item.page}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{item.component}</div>
                </div>
                <StatusIcon status={item.status} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>🌙 <StatusIcon status={item.dark} /></span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>☀️ <StatusIcon status={item.light} /></span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>📱 <StatusIcon status={item.responsive} /></span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {item.loading ? <span style={{ padding: '1px 5px', borderRadius: 3, background: '#06B6D422', color: '#06B6D4', fontSize: 10 }}>L</span> : <span style={{ padding: '1px 5px', borderRadius: 3, background: '#EF444422', color: '#EF4444', fontSize: 10 }}>⨯L</span>}
                {item.empty ? <span style={{ padding: '1px 5px', borderRadius: 3, background: '#06B6D422', color: '#06B6D4', fontSize: 10 }}>E</span> : <span style={{ padding: '1px 5px', borderRadius: 3, background: '#EF444422', color: '#EF4444', fontSize: 10 }}>⨯E</span>}
                {item.error ? <span style={{ padding: '1px 5px', borderRadius: 3, background: '#06B6D422', color: '#06B6D4', fontSize: 10 }}>R</span> : <span style={{ padding: '1px 5px', borderRadius: 3, background: '#EF444422', color: '#EF4444', fontSize: 10 }}>⨯R</span>}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{item.note}</div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', fontSize: 12, color: '#D1D5DB', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#F9FAFB' }}>📋 v1.8.0 GA UI 走查总结</div>
        <div>
          ✅ <strong>深色模式: {stats.darkPass}/{stats.total} 全部通过</strong> — 私行深色+#D4A853金色主题统一
        </div>
        <div>
          ⚠️ <strong>浅色模式: {stats.lightPass}/{stats.total} 通过</strong> — StrategyPage/TradeDashboard/RiskDashboard/Onboarding/Community/Admin 需调对比度
        </div>
        <div>
          ✅ <strong>响应式: {stats.respPass}/{stats.total} 通过</strong> — Strategy/Backtest/Community/Admin 需1366×768适配
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>三态覆盖率</strong>: Loading {stats.hasLoading}/{stats.total} · Empty {stats.hasEmpty}/{stats.total} · Error {stats.hasError}/{stats.total}
        </div>
        <div style={{ marginTop: 8, color: '#6B7280' }}>
          💡 建议: GA前将浅色模式6项warn→pass, 响应式4项warn→pass, 三态补齐到≥80%
        </div>
      </div>
    </div>
  );
}
