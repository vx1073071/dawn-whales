/**
 * CreditsDashboard — R104 M-01: Creator revenue dashboard
 *
 * Shows:
 * - Today / Month / Cumulative USDT income
 * - Fee split by tier: L1 70% / L2 80% / L3 90%
 * - P2P transfer summary
 * - Mini chart of recent daily earnings
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCredits } from '@/hooks/useCredits';
import i18n from '../../i18n';

// Fee tiers: creator gets these percentages
const TIER_SPLIT: Record<string, number> = {
  L1: 0.70,
  L2: 0.80,
  L3: 0.90,
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color: string;
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-[#0f0f18] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono tabular-nums ${color}`}>
        {value}
      </div>
      {sub && (
        <div className="text-gray-500 text-[10px]">{sub}</div>
      )}
    </div>
  );
}

// Mini bar chart for daily earnings
function DailyEarningsChart({ data }: { data: { day: string; amount: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.amount), 0.001);
  return (
    <div className="bg-[#0f0f18] border border-white/5 rounded-xl p-4">
      <div className="text-gray-400 text-xs mb-3 flex items-center gap-2">
        <span>📊</span>
        <span>{i18n.t('credits.dailyEarnings') || 'Daily Earnings (Last 7 days)'}</span>
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d, i) => {
          const height = Math.max((d.amount / maxVal) * 100, 2);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-[#D4A853]/60 to-[#D4A853] transition-all duration-300"
                style={{ height: `${height}%` }}
                title={`${d.day}: ${d.amount.toFixed(4)} USDT`}
              />
              <span className="text-[8px] text-gray-600">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreditsDashboard() {
  const { t: _t } = useTranslation();
  const { transactions, balance } = useCredits();

  const stats = useMemo(() => {
    const now = Date.now();
    const todayStart = now - (now % 86400000); // midnight UTC
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const incomeTxs = transactions.filter(tx => tx.amount > 0);
    const feeTxs = transactions.filter(tx => tx.type === 'fee');

    let todayIncome = 0;
    let monthIncome = 0;
    let cumulativeIncome = 0;
    let totalFees = 0;

    incomeTxs.forEach(tx => {
      cumulativeIncome += tx.amount;
      if (tx.timestamp >= monthStart.getTime()) monthIncome += tx.amount;
      if (tx.timestamp >= todayStart) todayIncome += tx.amount;
    });

    feeTxs.forEach(tx => {
      totalFees += Math.abs(tx.amount);
    });

    // Daily earnings for last 7 days
    const dailyData: { day: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = todayStart - i * 86400000;
      const dayEnd = dayStart + 86400000;
      const dayAmount = incomeTxs
        .filter(tx => tx.timestamp >= dayStart && tx.timestamp < dayEnd)
        .reduce((sum, tx) => sum + tx.amount, 0);
      const d = new Date(dayStart);
      const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
      dailyData.push({ day: dayLabel, amount: dayAmount });
    }

    return { todayIncome, monthIncome, cumulativeIncome, totalFees, dailyData };
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <span>📊</span> {i18n.t('credits.dashboard') || 'Credits Dashboard'}
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">{i18n.t('credits.balance') || 'Balance'}:</span>
          <span className="text-[#D4A853] font-bold font-mono tabular-nums">
            {balance.toFixed(6)} USDT
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon="📅"
          label={i18n.t('credits.todayIncome') || 'Today'}
          value={`${stats.todayIncome.toFixed(4)}`}
          sub="USDT"
          color="text-green-400"
        />
        <StatCard
          icon="📆"
          label={i18n.t('credits.monthIncome') || 'This Month'}
          value={`${stats.monthIncome.toFixed(4)}`}
          sub="USDT"
          color="text-blue-400"
        />
        <StatCard
          icon="💎"
          label={i18n.t('credits.cumulativeIncome') || 'Cumulative'}
          value={`${stats.cumulativeIncome.toFixed(4)}`}
          sub="USDT"
          color="text-[#D4A853]"
        />
        <StatCard
          icon="💸"
          label={i18n.t('credits.totalFeesPaid') || 'Total Fees Paid'}
          value={`${stats.totalFees.toFixed(4)}`}
          sub="USDT"
          color="text-red-400"
        />
      </div>

      {/* Fee split by tier */}
      <div className="bg-[#0f0f18] border border-white/5 rounded-xl p-4">
        <div className="text-gray-400 text-xs mb-3 flex items-center gap-2">
          <span>📈</span>
          <span>{i18n.t('credits.feeSplit') || 'Fee Split by Tier'}</span>
        </div>
        <div className="space-y-2">
          {Object.entries(TIER_SPLIT).map(([tier, split]) => (
            <div key={tier} className="flex items-center gap-3">
              <span className={`text-xs font-bold w-6 ${
                tier === 'L3' ? 'text-[#D4A853]' : tier === 'L2' ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {tier}
              </span>
              <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tier === 'L3' ? 'bg-[#D4A853]' : tier === 'L2' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${split * 100}%` }}
                />
              </div>
              <span className="text-white text-xs font-mono w-12 text-right">
                {(split * 100).toFixed(0)}%
              </span>
              <span className="text-gray-600 text-[10px] w-16">
                {tier === 'L3' ? 'Creator' : tier === 'L2' ? 'Pro' : 'Free'}
              </span>
            </div>
          ))}
        </div>
        <div className="text-gray-600 text-[10px] mt-2">
          {i18n.t('credits.feeSplitDesc') || 'Creators receive the percentage shown. Platform retains the remainder.'}
        </div>
      </div>

      {/* Daily earnings chart */}
      <DailyEarningsChart data={stats.dailyData} />
    </div>
  );
}
