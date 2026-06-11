/**
 * MultiSourceDataPanel — Multi-source data comparison & health dashboard
 * (ML-41-02, R41 Phase 5.0)
 *
 * Integrates with MultiSourceAggregator to display:
 * - 4 data source health status (eastmoney/sina/tencent/xueqiu)
 * - Real-time latency comparison bars
 * - Data coverage rate per source per symbol
 * - Consensus vs individual source pricing
 * - Source priority & degradation indicators
 */

import { useTranslation } from "react-i18next";
import { EngineError } from '../../../electron/engine/core/engine-error';
import React, { useState, useMemo } from 'react';
import i18n from '../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

type SourceKey = 'eastmoney' | 'sina' | 'tencent' | 'xueqiu';
type SourceHealth = 'healthy' | 'degraded' | 'down';

interface SourceStatus {
  key: SourceKey;
  name: string;
  health: SourceHealth;
  latencyMs: number;
  coverageRate: number;
  lastUpdateMs: number;
  errorCount: number;
  priority: number;
}

interface QuoteComparison {
  symbol: string;
  sources: {
    source: SourceKey;
    price: number;
    volume: number;
    timestamp: number;
  }[];
  consensusPrice: number;
  spreadPercent: number;
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_SOURCES: SourceStatus[] = [
{ key: 'eastmoney', name: i18n.t('MultiSourceDataPanel.k1'), health: 'healthy', latencyMs: 45, coverageRate: 0.98, lastUpdateMs: 2000, errorCount: 0, priority: 1 },
{ key: 'sina', name: i18n.t('MultiSourceDataPanel.k2'), health: 'healthy', latencyMs: 78, coverageRate: 0.95, lastUpdateMs: 3500, errorCount: 1, priority: 2 },
{ key: 'tencent', name: i18n.t('MultiSourceDataPanel.k3'), health: 'degraded', latencyMs: 320, coverageRate: 0.88, lastUpdateMs: 8000, errorCount: 5, priority: 3 },
{ key: 'xueqiu', name: i18n.t('MultiSourceDataPanel.k4'), health: 'healthy', latencyMs: 95, coverageRate: 0.92, lastUpdateMs: 5000, errorCount: 2, priority: 4 }];


const MOCK_QUOTES: QuoteComparison[] = [
{ symbol: '600519', sources: [
  { source: 'eastmoney', price: 1792.50, volume: 1523400, timestamp: Date.now() - 2000 },
  { source: 'sina', price: 1792.80, volume: 1520000, timestamp: Date.now() - 4000 },
  { source: 'tencent', price: 1791.90, volume: 1518000, timestamp: Date.now() - 9000 },
  { source: 'xueqiu', price: 1792.60, volume: 1525000, timestamp: Date.now() - 5000 }],
  consensusPrice: 1792.45, spreadPercent: 0.05 },
{ symbol: '000858', sources: [
  { source: 'eastmoney', price: 168.50, volume: 23456000, timestamp: Date.now() - 1500 },
  { source: 'sina', price: 168.45, volume: 23400000, timestamp: Date.now() - 3000 },
  { source: 'tencent', price: 168.70, volume: 23380000, timestamp: Date.now() - 7500 },
  { source: 'xueqiu', price: 168.55, volume: 23420000, timestamp: Date.now() - 4500 }],
  consensusPrice: 168.55, spreadPercent: 0.15 }];


const SOURCE_ICONS: Record<SourceKey, string> = {
  eastmoney: '📊', sina: '📰', tencent: '📡', xueqiu: '❄️'
};
const HEALTH_LABELS: Record<SourceHealth, string> = {
  healthy: i18n.t('MultiSourceDataPanel.k5'), degraded: i18n.t('MultiSourceDataPanel.k6'), down: i18n.t('MultiSourceDataPanel.k7')
};

// ── Main Component ──────────────────────────────────────────────────────

interface MultiSourceDataPanelProps {
  className?: string;
}

export const MultiSourceDataPanel: React.FC<MultiSourceDataPanelProps> = ({ className }) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'quotes'>('overview');

  const sources = MOCK_SOURCES;
  const quotes = MOCK_QUOTES;

  // Stats
  const healthyCount = useMemo(() => sources.filter((s) => s.health === 'healthy').length, [sources]);
  const avgLatency = useMemo(() => Math.round(sources.reduce((sum, s) => sum + s.latencyMs, 0) / sources.length), [sources]);
  const avgCoverage = useMemo(() => (sources.reduce((sum, s) => sum + s.coverageRate, 0) / sources.length * 100).toFixed(0), [sources]);

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">{i18n.t("MultiSourceDataPanel.r92_d5cd")}

            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 5.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {healthyCount}/{sources.length}{i18n.t("MultiSourceDataPanel.r92_ac47")}{avgLatency}{i18n.t("MultiSourceDataPanel.r92_dbf1")}{avgCoverage}%
          </p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {([
        { label: i18n.t('MultiSourceDataPanel.k8'), value: sources.length, color: 'text-white' },
        { label: i18n.t('MultiSourceDataPanel.k9'), value: healthyCount, color: 'text-emerald-400' },
        { label: t('components.downgrade'), value: sources.filter((s) => s.health === 'degraded').length, color: 'text-amber-400' },
        { label: i18n.t('MultiSourceDataPanel.k10'), value: sources.filter((s) => s.health === 'down').length, color: 'text-red-400' }] as
        const).map((c) =>
        <div key={c.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 text-center">
            <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            <div className="text-[10px] text-gray-500">{c.label}</div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-800/40 rounded-lg p-1">
        {([
        { key: 'overview', label: i18n.t('MultiSourceDataPanel.k11') },
        { key: 'quotes', label: i18n.t('MultiSourceDataPanel.k12') }] as
        const).map((tab) =>
        <button
          key={tab.key}
          onClick={() => setSelectedTab(tab.key)}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          selectedTab === tab.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`
          }>
          
            {tab.label}
          </button>
        )}
      </div>

      {/* ── Tab: Source Overview ──────────────────────────────────── */}
      {selectedTab === 'overview' &&
      <div className="space-y-3">
          {sources.map((src) =>
        <div
          key={src.key}
          className={`rounded-lg p-4 border ${
          src.health === 'healthy' ? 'border-gray-700/30 bg-gray-800/30' :
          src.health === 'degraded' ? 'border-amber-500/20 bg-amber-500/5' :
          'border-red-500/20 bg-red-500/5'}`
          }>
          
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{SOURCE_ICONS[src.key]}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{src.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${{
                    healthy: 'bg-emerald-500/10 text-emerald-400',
                    degraded: 'bg-amber-500/10 text-amber-400',
                    down: 'bg-red-500/10 text-red-400'
                  }[src.health]}`}>
                        {HEALTH_LABELS[src.health]}
                      </span>
                      <span className="text-[10px] text-gray-600">{i18n.t('MultiSourceDataPanel.k0')}{src.priority}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {src.lastUpdateMs < 3000 ? i18n.t('MultiSourceDataPanel.k13') : src.lastUpdateMs < 6000 ? i18n.t('MultiSourceDataPanel.k14') : i18n.t('MultiSourceDataPanel.k15')}
                      {' · '}{i18n.t("MultiSourceDataPanel.r92_e0f2")}{src.errorCount}{i18n.t("MultiSourceDataPanel.r92_16b4")}
                </div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500">
                  {new Date(Date.now() - src.lastUpdateMs).toISOString().substr(11, 8)}
                </span>
              </div>

              {/* Latency bar */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>{i18n.t('MultiSourceDataPanel.k0')}</span>
                  <span>{src.latencyMs}ms</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                className={`h-full rounded-full ${src.latencyMs < 100 ? 'bg-emerald-500' : src.latencyMs < 200 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(src.latencyMs / 5, 100)}%` }} />
              
                </div>
              </div>

              {/* Coverage bar */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>{i18n.t('MultiSourceDataPanel.k1')}</span>
                  <span>{(src.coverageRate * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                className={`h-full rounded-full ${src.coverageRate >= 0.95 ? 'bg-emerald-500' : src.coverageRate >= 0.85 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${src.coverageRate * 100}%` }} />
              
                </div>
              </div>
            </div>
        )}
        </div>
      }

      {/* ── Tab: Quote Comparison ─────────────────────────────────── */}
      {selectedTab === 'quotes' &&
      <div className="space-y-4">
          {quotes.map((quote) =>
        <div key={quote.symbol} className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">{quote.symbol}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{i18n.t('MultiSourceDataPanel.k2')}</span>
                  <span className="text-sm font-mono text-amber-400">¥{quote.consensusPrice.toFixed(2)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              quote.spreadPercent < 0.1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`
              }>{i18n.t("MultiSourceDataPanel.r92_0e9f")}
                {quote.spreadPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700/50">
                    <th className="text-left py-1.5 pr-3">{i18n.t('MultiSourceDataPanel.k3')}</th>
                    <th className="text-right py-1.5 pr-3">{t("components.price")}</th>
                    <th className="text-right py-1.5 pr-3">{t("components.volume")}</th>
                    <th className="text-right py-1.5 pr-3">{i18n.t('MultiSourceDataPanel.k4')}</th>
                    <th className="text-right py-1.5">{i18n.t('MultiSourceDataPanel.k5')}</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.sources.map((s) => {
                const diff = s.price - quote.consensusPrice;
                const diffPct = diff / quote.consensusPrice * 100;
                return (
                  <tr key={s.source} className="border-b border-gray-700/20 text-gray-400">
                        <td className="py-1.5 pr-3">
                          <span className="flex items-center gap-1.5">
                            {SOURCE_ICONS[s.source]}
                            <span className="text-[10px]">{MOCK_SOURCES.find((ss) => ss.key === s.source)?.name}</span>
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">¥{s.price.toFixed(2)}</td>
                        <td className="py-1.5 pr-3 text-right">{(s.volume / 10000).toFixed(0)}{i18n.t("MultiSourceDataPanel.r92_6b7d")}</td>
                        <td className={`py-1.5 pr-3 text-right ${diffPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {diff >= 0 ? '+' : ''}{diffPct.toFixed(3)}%
                        </td>
                        <td className="py-1.5 text-right text-[10px] text-gray-500">
                          {new Date(Date.now() - s.timestamp).getSeconds()}s ago
                        </td>
                      </tr>);

              })}
                </tbody>
              </table>
            </div>
        )}
        </div>
      }
    </div>);

};

export default MultiSourceDataPanel;

void EngineError; // [DATA] structured error tracking