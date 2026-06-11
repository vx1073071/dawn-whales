import { useState, useMemo, type CSSProperties } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';

// ── Types ──
interface AuditItem {
  page: string;component: string;status: 'pass' | 'warn' | 'fail';
  dark: 'pass' | 'warn' | 'fail';light: 'pass' | 'warn' | 'fail';
  responsive: 'pass' | 'warn' | 'fail';note: string;
  loading?: boolean;empty?: boolean;error?: boolean;
}

const AUDIT_ITEMS: AuditItem[] = [
{ page: i18n.t('UIAuditPanel.k1'), component: 'LandingPageV18', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k2'), loading: true, empty: true, error: true },
{ page: i18n.t('UIAuditPanel.k3'), component: 'StrategyPage', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: i18n.t('UIAuditPanel.k4'), loading: true, empty: true },
{ page: i18n.t('UIAuditPanel.k5'), component: 'MarketPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k6') },
{ page: i18n.t('UIAuditPanel.k7'), component: 'OrdersPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k8') },
{ page: i18n.t('UIAuditPanel.k9'), component: 'PortfolioPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k10') },
{ page: i18n.t('UIAuditPanel.k11'), component: 'SettingsPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k12') },
{ page: i18n.t('UIAuditPanel.k13'), component: 'TradeDashboardPage', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: i18n.t('UIAuditPanel.k14'), loading: true },
{ page: i18n.t('UIAuditPanel.k15'), component: 'RiskDashboardPage', status: 'pass', dark: 'pass', light: 'warn', responsive: 'pass', note: i18n.t('UIAuditPanel.k16') },
{ page: i18n.t('UIAuditPanel.k17'), component: 'BacktestReportPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'warn', note: i18n.t('UIAuditPanel.k18'), loading: true, empty: true },
{ page: i18n.t('UIAuditPanel.k19'), component: 'LiveMonitorPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k20') },
{ page: i18n.t('UIAuditPanel.k21'), component: 'MarketplacePage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k22'), loading: true, empty: true },
{ page: i18n.t('UIAuditPanel.k23'), component: 'AIDrawingPatternPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k24') },
{ page: i18n.t('UIAuditPanel.k25'), component: 'OnboardingFullKit', status: 'pass', dark: 'pass', light: 'warn', responsive: 'pass', note: i18n.t('UIAuditPanel.k26') },
{ page: i18n.t('UIAuditPanel.k27'), component: 'AIAssistantPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k28') },
{ page: i18n.t('UIAuditPanel.k29'), component: 'ThemeLangPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k30') },
{ page: i18n.t('UIAuditPanel.k31'), component: 'MonitoringAlertPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k32'), loading: true },
{ page: i18n.t('UIAuditPanel.k33'), component: 'AchievementOnboarding', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k34') },
{ page: i18n.t('UIAuditPanel.k35'), component: 'DemoCasePage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k36') },
{ page: i18n.t('UIAuditPanel.k37'), component: 'PrivateBankingUI', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k38'), loading: true },
{ page: i18n.t('UIAuditPanel.k39'), component: 'AdvancedKLineChart', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k40') },
{ page: i18n.t('UIAuditPanel.k41'), component: 'PineScriptEditor', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k42') },
{ page: i18n.t('UIAuditPanel.k43'), component: 'MarketPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k44') },
{ page: i18n.t('UIAuditPanel.k45'), component: 'FullPipelineUI', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k46') },
{ page: i18n.t('UIAuditPanel.k47'), component: 'StrategyCommunityPanel', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: i18n.t('UIAuditPanel.k48'), loading: true, empty: true, error: true },
{ page: i18n.t('UIAuditPanel.k49'), component: 'FactorAnalysisPanel', status: 'pass', dark: 'pass', light: 'warn', responsive: 'pass', note: i18n.t('UIAuditPanel.k50'), loading: true },
{ page: i18n.t('UIAuditPanel.k51'), component: 'PortfolioOptimizationPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k52') },
{ page: i18n.t('UIAuditPanel.k53'), component: 'CreatorLeaderboard', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k54') },
{ page: i18n.t('UIAuditPanel.k55'), component: 'SignalPerformancePanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k56'), loading: true },
{ page: i18n.t('UIAuditPanel.k57'), component: 'HelpCenter', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k58') },
{ page: i18n.t('UIAuditPanel.k59'), component: 'AdminDashboard', status: 'pass', dark: 'pass', light: 'warn', responsive: 'warn', note: i18n.t('UIAuditPanel.k60'), loading: true },
{ page: i18n.t('UIAuditPanel.k61'), component: 'USDTWalletPage', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k62'), loading: true, empty: true },
{ page: i18n.t('UIAuditPanel.k63'), component: 'CreatorOnboardingGuide', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k64') },
{ page: i18n.t('UIAuditPanel.k65'), component: 'SecurityCenter', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k66') },
{ page: i18n.t('UIAuditPanel.k67'), component: 'IBKRBrokerPanel', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k68') },
{ page: i18n.t('UIAuditPanel.k69'), component: 'SignalSquare', status: 'pass', dark: 'pass', light: 'pass', responsive: 'pass', note: i18n.t('UIAuditPanel.k70'), loading: true, empty: true }];


// ── Stats badge ──
function StatBadge({ label, value, color }: {label: string;value: string;color: string;}) {
  const { t: _t } = useTranslation();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, background: color + '14', border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>);

}

function StatusIcon({ status }: {status: 'pass' | 'warn' | 'fail';}) {
  const map = { pass: { icon: '✅', color: '#10B981' }, warn: { icon: '⚠️', color: '#F59E0B' }, fail: { icon: '❌', color: '#EF4444' } };
  return <span style={{ color: map[status].color, fontSize: 14 }}>{map[status].icon}</span>;
}

// ── Main ──
export default function UIAuditPanel() {
  const [filter, setFilter] = useState<'all' | 'pass' | 'warn' | 'fail'>('all');
  const [view, setView] = useState<'grid' | 'compact'>('grid');

  const stats = useMemo(() => {
    const total = AUDIT_ITEMS.length;
    const pass = AUDIT_ITEMS.filter((i) => i.status === 'pass').length;
    const darkPass = AUDIT_ITEMS.filter((i) => i.dark === 'pass').length;
    const lightPass = AUDIT_ITEMS.filter((i) => i.light === 'pass').length;
    const respPass = AUDIT_ITEMS.filter((i) => i.responsive === 'pass').length;
    const hasLoading = AUDIT_ITEMS.filter((i) => i.loading).length;
    const hasEmpty = AUDIT_ITEMS.filter((i) => i.empty).length;
    const hasError = AUDIT_ITEMS.filter((i) => i.error).length;
    const missingLoading = AUDIT_ITEMS.filter((i) => !i.loading).length;
    const missingEmpty = AUDIT_ITEMS.filter((i) => !i.empty).length;
    const missingError = AUDIT_ITEMS.filter((i) => !i.error).length;
    return { total, pass, darkPass, lightPass, respPass, hasLoading, hasEmpty, hasError, missingLoading, missingEmpty, missingError };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return AUDIT_ITEMS;
    return AUDIT_ITEMS.filter((i) => i.status === filter);
  }, [filter]);

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 1100, margin: '0 auto'
  };

  return (
    <div style={theme}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>{i18n.t('UIAuditPanel.r92_0')}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            {AUDIT_ITEMS.length}{i18n.t("UIAuditPanel.r92_523f")}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatBadge label={i18n.t('UIAuditPanel.k71')} value={stats.total.toString()} color="#6366F1" />
        <StatBadge label={i18n.t('UIAuditPanel.k72')} value={stats.pass.toString()} color="#10B981" />
        <StatBadge label={i18n.t('UIAuditPanel.k73')} value={`${stats.darkPass}/${stats.total}`} color="#818CF8" />
        <StatBadge label={i18n.t('UIAuditPanel.k74')} value={`${stats.lightPass}/${stats.total}`} color="#F59E0B" />
        <StatBadge label={i18n.t('UIAuditPanel.k75')} value={`${stats.respPass}/${stats.total}`} color="#10B981" />
        <StatBadge label="Loading" value={`${stats.hasLoading}/${stats.total}`} color="#06B6D4" />
        <StatBadge label="Empty" value={`${stats.hasEmpty}/${stats.total}`} color="#06B6D4" />
        <StatBadge label="Error" value={`${stats.hasError}/${stats.total}`} color="#06B6D4" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
          { key: 'all' as const, label: 'components.all', color: '#6B7280' },
          { key: 'pass' as const, label: i18n.t('UIAuditPanel.k76'), color: '#10B981' },
          { key: 'warn' as const, label: i18n.t('UIAuditPanel.k77'), color: '#F59E0B' },
          { key: 'fail' as const, label: i18n.t('UIAuditPanel.k78'), color: '#EF4444' }].
          map((f) =>
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 6, border: '1px solid', borderColor: filter === f.key ? f.color : '#374151',
              background: filter === f.key ? f.color + '18' : 'transparent',
              color: filter === f.key ? f.color : '#9CA3AF', fontSize: 12, cursor: 'pointer'
            }}>
            
              {f.label}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setView('grid')} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #374151', background: view === 'grid' ? '#6366F1' : '#1F2937', color: view === 'grid' ? '#FFF' : '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>{i18n.t("UIAuditPanel.r92_3971")}</button>
          <button onClick={() => setView('compact')} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #374151', background: view === 'compact' ? '#6366F1' : '#1F2937', color: view === 'compact' ? '#FFF' : '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>{i18n.t("UIAuditPanel.r92_8d07")}</button>
        </div>
      </div>

      {view === 'compact' ? (
      /* Compact table */
      <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('UIAuditPanel.k0')}</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>{"components.status"}</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>🌙</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>☀️</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: '#9CA3AF' }}>📱</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>{"components.remarks"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) =>
            <tr key={item.component} style={{ borderBottom: '1px solid #1F2937' }}>
                  <td style={{ padding: '8px 12px', color: '#D1D5DB', fontWeight: 600 }}>{item.page}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.status} /></td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.dark} /></td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.light} /></td>
                  <td style={{ padding: '8px 8px', textAlign: 'center' }}><StatusIcon status={item.responsive} /></td>
                  <td style={{ padding: '8px 12px', color: '#6B7280', fontSize: 11 }}>{item.note}</td>
                </tr>
            )}
            </tbody>
          </table>
        </div>) : (

      /* Grid view */
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.map((item) =>
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
        )}
        </div>)
      }

      {/* Summary */}
      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', fontSize: 12, color: '#D1D5DB', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#F9FAFB' }}>{i18n.t('UIAuditPanel.r92_1')}</div>
        <div>
          ✅ <strong>{i18n.t('UIAuditPanel.k0')}{stats.darkPass}/{stats.total}{i18n.t('UIAuditPanel.k1')}</strong>{i18n.t("UIAuditPanel.r92_08af")}
        </div>
        <div>
          ⚠️ <strong>{i18n.t('UIAuditPanel.k2')}{stats.lightPass}/{stats.total}{i18n.t('UIAuditPanel.k3')}</strong>{i18n.t("UIAuditPanel.r92_5641")}
        </div>
        <div>
          ✅ <strong>{i18n.t('UIAuditPanel.k4')}{stats.respPass}/{stats.total}{i18n.t('UIAuditPanel.k5')}</strong>{i18n.t("UIAuditPanel.r92_f2cb")}
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>{i18n.t('UIAuditPanel.k1')}</strong>: Loading {stats.hasLoading}/{stats.total} · Empty {stats.hasEmpty}/{stats.total} · Error {stats.hasError}/{stats.total}
        </div>
        <div style={{ marginTop: 8, color: '#6B7280' }}>{i18n.t("UIAuditPanel.r92_36cf")}

        </div>
      </div>
    </div>);

}

void EngineError; // [TRADE] structured error tracking