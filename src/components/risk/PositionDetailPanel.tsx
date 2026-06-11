// ── DAWN WHALES — PositionDetailPanel (持仓详情面板) ───────────────────────

import { useState } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../i18n';

interface PositionDetail {
  symbol: string;
  name: string;
  qty: number;
  avgCost: number;
  marketPrice: number;
  marketValue: number;
  totalPnl: number;
  totalPnlPct: number;
  dayPnl: number;
  dayPnlPct: number;
  beta?: number;
  sector?: string;
  pe?: number;
  dividendYield?: number;
}

interface PositionDetailPanelProps {
  position?: PositionDetail;
  onClose?: () => void;
}

const DEMO_POSITION: PositionDetail = {
  symbol: 'TQQQ',
  name: 'ProShares UltraPro QQQ',
  qty: 500,
  avgCost: 72.45,
  marketPrice: 78.95,
  marketValue: 39475,
  totalPnl: 3250,
  totalPnlPct: 8.97,
  dayPnl: 450,
  dayPnlPct: 1.15,
  beta: 3.0,
  sector: i18n.t('PositionDetailPanel.k1'),
  pe: 25.4,
  dividendYield: 0.02,
};

export default function PositionDetailPanel({
  position = DEMO_POSITION,
  onClose,
}: PositionDetailPanelProps) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'overview' | 'history' | 'risk'>('overview');

  const isProfit = position.totalPnl >= 0;
  const dayIsProfit = position.dayPnl >= 0;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-white font-semibold text-sm">{position.symbol}</h2>
            <p className="text-gray-500 text-[10px]">{position.name}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {isProfit ? '+' : ''}{position.totalPnlPct.toFixed(2)}%
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 text-xs hover:text-gray-300">✕</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#12121a] rounded-lg p-0.5 w-fit">
        {([
          { key: 'overview' as const, label: i18n.t('PositionDetailPanel.k2') },
          { key: 'history' as const, label: t('components.history') },
          { key: 'risk' as const, label: t('components.risk') },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label={i18n.t('PositionDetailPanel.k3')} value={position.qty.toString()} />
            <MetricBox label={i18n.t('PositionDetailPanel.k4')} value={`$${position.avgCost.toFixed(2)}`} />
            <MetricBox label={t("components.marketPrice")} value={`$${position.marketPrice.toFixed(2)}`} />
            <MetricBox label={t("components.marketCap")} value={`$${position.marketValue.toLocaleString()}`} />
            <MetricBox label={i18n.t('PositionDetailPanel.k5')} value={`${isProfit ? '+' : ''}$${position.totalPnl.toFixed(0)}`} color={isProfit ? 'text-emerald-400' : 'text-red-400'} />
            <MetricBox label={i18n.t('PositionDetailPanel.k6')} value={`${dayIsProfit ? '+' : ''}$${position.dayPnl.toFixed(0)}`} color={dayIsProfit ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          {position.sector && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="bg-[#12121a] text-gray-400 px-2 py-1 rounded">板块: {position.sector}</span>
              {position.beta && <span className="bg-[#12121a] text-gray-400 px-2 py-1 rounded">Beta: {position.beta}</span>}
              {position.pe && <span className="bg-[#12121a] text-gray-400 px-2 py-1 rounded">P/E: {position.pe}</span>}
              {position.dividendYield && <span className="bg-[#12121a] text-gray-400 px-2 py-1 rounded">股息: {(position.dividendYield * 100).toFixed(2)}%</span>}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          <p className="text-gray-500 text-xs text-center py-4">历史交易记录将显示在这里</p>
        </div>
      )}

      {/* Risk Tab */}
      {tab === 'risk' && (
        <div className="space-y-2">
          <RiskRow label={i18n.t('PositionDetailPanel.k7')} value={`${((position.marketValue / 100000) * 100).toFixed(1)}%`} threshold={20} />
          <RiskRow label={i18n.t('PositionDetailPanel.k8')} value={position.beta?.toFixed(1) || 'N/A'} threshold={3} />
          <RiskRow label={i18n.t('PositionDetailPanel.k9')} value={i18n.t('PositionDetailPanel.k10')} threshold={0} />
          <RiskRow label={i18n.t('PositionDetailPanel.k11')} value={`${(((position.marketPrice - position.avgCost * 0.95) / position.marketPrice) * 100).toFixed(1)}%`} threshold={5} />
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, color = 'text-gray-300' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#12121a] rounded-lg p-2.5">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

function RiskRow({ label, value, threshold }: { label: string; value: string; threshold: number }) {
  const numValue = parseFloat(value);
  const isHigh = !isNaN(numValue) && numValue > threshold && threshold > 0;
  return (
    <div className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`text-xs font-mono ${isHigh ? 'text-red-400' : 'text-gray-300'}`}>{value}</span>
    </div>
  );
}
