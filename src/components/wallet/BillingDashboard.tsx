// ── R215 ML P3: BillingDashboard — 累计消费仪表盘 (SettingsPage新增) ──────────
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// U4: Monthly billing dashboard with category breakdown + budget tracking
// Shows: today's / month's / cumulative spend + category breakdown + budget bar
// 9-language i18n + transaction history preview + export CSV option

import React, { useMemo } from 'react';
import { Button, Tag, Progress, Skeleton } from 'antd';
import {
  WalletOutlined, CalendarOutlined, DownloadOutlined, PieChartOutlined,
} from '@ant-design/icons';

export interface BillingRecord {
  id: string;
  date: number; // timestamp
  service: string;
  category: 'execution' | 'ai' | 'transfer' | 'withdraw' | 'data' | 'support';
  amount: number; // USDT
  description?: string;
}

interface BillingDashboardProps {
  records?: BillingRecord[];
  monthlyBudget?: number; // USDT, default 10
  currentBalance?: number;
  onExport?: (format: 'csv' | 'json') => void;
  locale?: string;
  loading?: boolean;
  compact?: boolean;
}

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    title: '💰 消费仪表盘',
    today: '今日',
    month: '本月',
    cumulative: '累计',
    budget: '本月预算',
    budgetBar: '已用 / 预算',
    budgetTip: '设置月度预算,避免超支',
    overBudget: '超出预算',
    breakdown: '分类明细',
    catExecution: '执行费', catAI: 'AI服务', catTransfer: '转账',
    catWithdraw: '提现', catData: '替代数据', catSupport: '增值服务',
    recent: '最近消费',
    noRecords: '暂无消费记录',
    export: '导出',
    average: '日均',
    forecast: '预测月底',
    topCat: '最高消费',
    count: '笔',
    trend: '周环比',
    up: '↑', down: '↓',
  },
  en: {
    title: '💰 Billing Dashboard', today: 'Today', month: 'Month', cumulative: 'Total',
    budget: 'Monthly Budget', budgetBar: 'Used / Budget', budgetTip: 'Set a monthly budget',
    overBudget: 'Over budget', breakdown: 'By Category',
    catExecution: 'Execution', catAI: 'AI Service', catTransfer: 'Transfer',
    catWithdraw: 'Withdraw', catData: 'Alt Data', catSupport: 'Support',
    recent: 'Recent Charges', noRecords: 'No charges yet',
    export: 'Export', average: 'Daily Avg', forecast: 'Month-end Forecast',
    topCat: 'Top Category', count: 'txns', trend: 'WoW', up: '↑', down: '↓',
  },
  ja: { title: '💰 請求ダッシュボード', today: '本日', month: '今月', cumulative: '累計', budget: '月額予算', budgetBar: '使用 / 予算', budgetTip: '月額予算を設定', overBudget: '予算超過', breakdown: 'カテゴリ別', catExecution: '実行', catAI: 'AI', catTransfer: '送金', catWithdraw: '出金', catData: '代替データ', catSupport: 'サポート', recent: '最近の請求', noRecords: '請求なし', export: 'エクスポート', average: '日次平均', forecast: '月末予測', topCat: 'トップカテゴリ', count: '件', trend: '前週比', up: '↑', down: '↓' },
  ko: { title: '💰 결제 대시보드', today: '오늘', month: '이번 달', cumulative: '누적', budget: '월 예산', budgetBar: '사용 / 예산', budgetTip: '월 예산 설정', overBudget: '예산 초과', breakdown: '카테고리별', catExecution: '실행', catAI: 'AI', catTransfer: '송금', catWithdraw: '출금', catData: '대체 데이터', catSupport: '지원', recent: '최근 결제', noRecords: '결제 없음', export: '내보내기', average: '일 평균', forecast: '월말 예측', topCat: '최다 카테고리', count: '건', trend: '전주 대비', up: '↑', down: '↓' },
  fr: { title: '💰 Tableau de Bord', today: 'Aujourd\'hui', month: 'Mois', cumulative: 'Total', budget: 'Budget Mensuel', budgetBar: 'Utilisé / Budget', budgetTip: 'Définir un budget', overBudget: 'Dépassé', breakdown: 'Par Catégorie', catExecution: 'Exécution', catAI: 'IA', catTransfer: 'Transfert', catWithdraw: 'Retrait', catData: 'Données', catSupport: 'Support', recent: 'Récent', noRecords: 'Aucun frais', export: 'Exporter', average: 'Moy. jour', forecast: 'Prévision fin de mois', topCat: 'Top Catégorie', count: 'txns', trend: 'S/S', up: '↑', down: '↓' },
  it: { title: '💰 Dashboard Fatturazione', today: 'Oggi', month: 'Mese', cumulative: 'Totale', budget: 'Budget Mensile', budgetBar: 'Usato / Budget', budgetTip: 'Imposta budget', overBudget: 'Superato', breakdown: 'Per Categoria', catExecution: 'Esecuzione', catAI: 'IA', catTransfer: 'Trasferimento', catWithdraw: 'Prelievo', catData: 'Dati', catSupport: 'Supporto', recent: 'Recenti', noRecords: 'Nessun addebito', export: 'Esporta', average: 'Media giornaliera', forecast: 'Previsione fine mese', topCat: 'Top Categoria', count: 'txns', trend: 'S/S', up: '↑', down: '↓' },
  de: { title: '💰 Abrechnungs-Dashboard', today: 'Heute', month: 'Monat', cumulative: 'Gesamt', budget: 'Monatsbudget', budgetBar: 'Verwendet / Budget', budgetTip: 'Budget festlegen', overBudget: 'Überschritten', breakdown: 'Nach Kategorie', catExecution: 'Ausführung', catAI: 'KI', catTransfer: 'Überweisung', catWithdraw: 'Auszahlung', catData: 'Daten', catSupport: 'Support', recent: 'Kürzlich', noRecords: 'Keine Gebühren', export: 'Exportieren', average: 'Tagesdurchschnitt', forecast: 'Monatsende-Prognose', topCat: 'Top Kategorie', count: 'Buchungen', trend: 'VoV', up: '↑', down: '↓' },
  es: { title: '💰 Panel de Facturación', today: 'Hoy', month: 'Mes', cumulative: 'Total', budget: 'Presupuesto Mensual', budgetBar: 'Usado / Presup.', budgetTip: 'Fijar presupuesto', overBudget: 'Excedido', breakdown: 'Por Categoría', catExecution: 'Ejecución', catAI: 'IA', catTransfer: 'Transferencia', catWithdraw: 'Retiro', catData: 'Datos', catSupport: 'Soporte', recent: 'Recientes', noRecords: 'Sin cargos', export: 'Exportar', average: 'Media diaria', forecast: 'Fin de mes', topCat: 'Top Categoría', count: 'txns', trend: 's/s', up: '↑', down: '↓' },
};

const CAT_COLORS: Record<string, string> = {
  execution: '#3b82f6', ai: '#f59e0b', transfer: '#22c55e',
  withdraw: '#ef4444', data: '#8b5cf6', support: '#06b6d4',
};

const formatDate = (ts: number, lang: string): string => {
  const d = new Date(ts);
  if (lang === 'zh-CN') return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const BillingDashboard: React.FC<BillingDashboardProps> = ({
  records: propRecords, monthlyBudget = 10, currentBalance,
  onExport, locale: pl, loading = false, compact = false,
}) => {
  const langKey = (pl === 'zh-CN' || pl === 'zh-TW') ? 'zh-CN' : (I18N[pl ?? ''] ? pl! : 'en');
  const t = I18N[langKey] ?? I18N.en;

  // Demo data if no records provided
  const records = useMemo(() => propRecords ?? generateDemoRecords(), [propRecords]);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const todayRecords = records.filter(r => now - r.date < dayMs);
    const monthRecords = records.filter(r => r.date >= startOfMonth.getTime());

    const today = todayRecords.reduce((s, r) => s + r.amount, 0);
    const month = monthRecords.reduce((s, r) => s + r.amount, 0);
    const cumulative = records.reduce((s, r) => s + r.amount, 0);

    // Category breakdown (this month)
    const catMap: Record<string, number> = {};
    monthRecords.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
    const cats = Object.entries(catMap).map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);

    // Daily average
    const daysPassed = Math.max(1, Math.ceil((now - startOfMonth.getTime()) / dayMs));
    const dailyAvg = month / daysPassed;

    // Forecast
    const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
    const forecast = (month / daysPassed) * daysInMonth;

    return { today, month, cumulative, cats, dailyAvg, forecast, count: monthRecords.length };
  }, [records]);

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;

  const budgetUsed = (stats.month / monthlyBudget) * 100;
  const isOver = stats.month > monthlyBudget;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: compact ? 16 : 24,
      border: '1px solid #e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── Title ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          {t.title}
        </h2>
        {onExport && (
          <Button size="small" icon={<DownloadOutlined />} onClick={() => onExport('csv')}>
            {t.export}
          </Button>
        )}
      </div>

      {/* ── Top Stats Grid ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon="📅" label={t.today} value={stats.today} color="#3b82f6" />
        <StatCard icon="📊" label={t.month} value={stats.month} color="#f59e0b" />
        <StatCard icon="💎" label={t.cumulative} value={stats.cumulative} color="#8b5cf6" />
      </div>

      {/* ── Budget Bar ─────────────────────────────────────────── */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <WalletOutlined style={{ color: '#64748b' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.budget}</span>
            {isOver && <Tag color="red">{t.overBudget}</Tag>}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: isOver ? '#ef4444' : '#1e293b' }}>
            {stats.month.toFixed(2)} / {monthlyBudget} USDT
          </span>
        </div>
        <Progress
          percent={Math.min(100, budgetUsed)}
          strokeColor={isOver ? '#ef4444' : budgetUsed > 80 ? '#f59e0b' : '#22c55e'}
          trailColor="#e2e8f0"
          showInfo={false}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
          <span>{t.average}: {stats.dailyAvg.toFixed(2)}U/天</span>
          <span>{t.forecast}: <strong>{stats.forecast.toFixed(2)}U</strong></span>
        </div>
      </div>

      {/* ── Category Breakdown ─────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 12px' }}>
          <PieChartOutlined style={{ marginRight: 6, color: '#3b82f6' }} />
          {t.breakdown}
        </h3>
        {stats.cats.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>
            {t.noRecords}
          </div>
        ) : (
          <div>
            {stats.cats.map(cat => {
              const pct = (cat.value / stats.month) * 100;
              const color = CAT_COLORS[cat.key] || '#64748b';
              return (
                <div key={cat.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                        background: color, marginRight: 6, verticalAlign: 'middle',
                      }} />
                      {(t as any)['cat' + cat.key.charAt(0).toUpperCase() + cat.key.slice(1)] || cat.key}
                    </span>
                    <span style={{ color: '#64748b' }}>
                      {cat.value.toFixed(2)}U · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <Progress percent={pct} strokeColor={color} showInfo={false} size="small" trailColor="#f1f5f9" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Records ─────────────────────────────────────── */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 12px' }}>
          <CalendarOutlined style={{ marginRight: 6, color: '#22c55e' }} />
          {t.recent} ({stats.count} {t.count})
        </h3>
        <div style={{ maxHeight: 240, overflowY: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          {records.slice(0, 15).map(r => {
            const color = CAT_COLORS[r.category] || '#64748b';
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block',
                  }} />
                  <div>
                    <div style={{ color: '#1e293b', fontWeight: 500 }}>{r.service}</div>
                    <div style={{ color: '#94a3b8', fontSize: 10 }}>{formatDate(r.date, langKey)}</div>
                  </div>
                </div>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{r.amount.toFixed(2)}U</span>
              </div>
            );
          })}
        </div>
      </div>

      {currentBalance !== undefined && (
        <div style={{
          marginTop: 16, padding: 12, background: '#f0f9ff',
          borderRadius: 8, fontSize: 12, color: '#0369a1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span><WalletOutlined style={{ marginRight: 6 }} />{currentBalance.toFixed(2)} USDT</span>
          <Button type="link" size="small" style={{ padding: 0 }}>{t.export}</Button>
        </div>
      )}
    </div>
  );
};

// ── Stat Card Sub-component ────────────────────────────────────────
const StatCard: React.FC<{ icon: string; label: string; value: number; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    background: '#f8fafc', borderRadius: 10, padding: 12,
    border: `1px solid ${color}20`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, color }}>
      {value.toFixed(2)} <span style={{ fontSize: 10, color: '#94a3b8' }}>USDT</span>
    </div>
  </div>
);

// ── Demo Data Generator ─────────────────────────────────────────────
function generateDemoRecords(): BillingRecord[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const cats: BillingRecord['category'][] = ['execution', 'ai', 'ai', 'ai', 'transfer', 'data', 'support'];
  const services: Record<BillingRecord['category'], string[]> = {
    execution: ['HK.00700 买单', 'BTC-USDT 卖单', 'SPY 买100股', 'AAPL 卖50股'],
    ai: ['AI回测解读', 'AI参数优化', 'AI因子诊断', 'AI信号推送', 'AI盲盒翻牌'],
    transfer: ['USDT转给张三', '收到李四转账'],
    withdraw: ['USDT提现到TRC20'],
    data: ['解锁替代数据v2', '解锁龙虎榜日报'],
    support: ['VIP月度订阅'],
  };
  const records: BillingRecord[] = [];
  for (let i = 0; i < 30; i++) {
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const svc = services[cat][Math.floor(Math.random() * services[cat].length)];
    const amount = cat === 'execution' ? 0.1 + Math.random() * 2 : cat === 'ai' ? 0.5 + Math.random() * 1.5 : 1 + Math.random() * 3;
    records.push({
      id: 'r' + i,
      date: now - Math.floor(Math.random() * 30) * dayMs - Math.floor(Math.random() * dayMs),
      service: svc,
      category: cat,
      amount: Math.round(amount * 100) / 100,
    });
  }
  return records.sort((a, b) => b.date - a.date);
}

export default BillingDashboard;
