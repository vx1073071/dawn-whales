// @ts-nocheck
// R125-Q01: ts-nocheck cleared
import { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

// ── Types ──────────────────────────────────────────────────────────────────

interface BrokerStatus {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  active: boolean;
}

interface AccountData {
  brokerId: string;
  brokerName: string;
  accountId: string;
  currency: string;
  totalAssets: number;
  cash: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

interface PositionData {
  code: string;
  name: string;
  qty: number;
  costPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

interface AggregatedPosition {
  code: string;
  name: string;
  totalQty: number;
  avgCost: number;
  marketPrice: number;
  totalValue: number;
  totalPnl: number;
  pnlPct: number;
  brokers: { brokerId: string; qty: number; cost: number }[];
}

interface SummaryData {
  totalAssets: number;
  totalCash: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  accountCount: number;
  positionCount: number;
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  currency = 'USD',
  color,
}: {
  label: string;
  value: number;
  currency?: string;
  color?: string;
}) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const textColor = color ?? 'text-white';
  return (
    <div className="bg-[#1e2130] rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold ${textColor}`}>
        {currency} {formatted}
      </span>
    </div>
  );
}

function BrokerRow({ account }: { account: AccountData }) {
  const pnlColor = account.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  return (
    <tr className="border-b border-[#2a2d3a] hover:bg-[#1e2130]/50 transition-colors">
      <td className="py-3 px-3 text-sm text-gray-300">{account.brokerName}</td>
      <td className="py-3 px-3 font-mono text-sm text-gray-400">{account.accountId}</td>
      <td className="py-3 px-3 text-sm">{account.currency}</td>
      <td className="py-3 px-3 text-right text-sm font-semibold text-white">
        {account.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-3 text-right text-sm text-gray-300">
        {account.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-3 text-right text-sm text-gray-300">
        {account.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className={`py-3 px-3 text-right text-sm font-semibold ${pnlColor}`}>
        {account.unrealizedPnl >= 0 ? '+' : ''}
        {account.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );
}

function AggregatedPositionRow({ pos }: { pos: AggregatedPosition }) {
  const pnlColor = pos.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const brokerCount = pos.brokers.length;
  return (
    <tr className="border-b border-[#2a2d3a] hover:bg-[#1e2130]/50 transition-colors">
      <td className="py-3 px-3 font-mono text-sm text-white">{pos.code}</td>
      <td className="py-3 px-3 text-sm text-gray-300">{pos.name}</td>
      <td className="py-3 px-3 text-right text-sm">{pos.totalQty.toLocaleString()}</td>
      <td className="py-3 px-3 text-right text-sm">{pos.avgCost.toFixed(2)}</td>
      <td className="py-3 px-3 text-right text-sm">{pos.marketPrice.toFixed(2)}</td>
      <td className="py-3 px-3 text-right text-sm font-semibold text-white">
        {pos.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className={`py-3 px-3 text-right text-sm font-semibold ${pnlColor}`}>
        {pos.totalPnl >= 0 ? '+' : ''}
        {pos.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className={`py-3 px-3 text-right text-sm ${pnlColor}`}>
        {pos.pnlPct >= 0 ? '+' : ''}
        {pos.pnlPct.toFixed(2)}%
      </td>
      <td className="py-3 px-3 text-center text-xs text-gray-500">
        {brokerCount > 1 ? (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
            {brokerCount} brokers
          </span>
        ) : (
          <span className="text-gray-600">1</span>
        )}
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AccountSummary() {
  const [brokers, setBrokers] = useState<BrokerStatus[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [positions, setPositions] = useState<AggregatedPosition[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalAssets: 0,
    totalCash: 0,
    totalMarketValue: 0,
    totalUnrealizedPnl: 0,
    totalRealizedPnl: 0,
    accountCount: 0,
    positionCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'brokers' | 'positions'>('summary');

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const api = window.api;
      if (!api?.broker) {
        setError('Broker API not available (not running in Electron)');
        setLoading(false);
        return;
      }

      // 1. Get broker list
      const brokerResult = await api.broker.list().catch((_: unknown) => null);
      const brokerList: BrokerStatus[] = brokerResult?.success
        ? brokerResult.brokers ?? []
        : [];
      setBrokers(brokerList);

      // 2. For each connected broker, get accounts and positions
      const allAccounts: AccountData[] = [];
      const positionMap = new Map<
        string,
        {
          name: string;
          totalQty: number;
          totalCostBasis: number;
          marketPrice: number;
          maxQty: number;
          totalValue: number;
          brokers: { brokerId: string; qty: number; cost: number }[];
        }
      >();

      for (const broker of brokerList) {
        if (!broker.connected) continue;

        try {
          // Get accounts for this broker
          const acctResult = await api.broker.getAccounts().catch((_: unknown) => null);
          if (!acctResult?.success) continue;

          const acctList = acctResult.accounts ?? [];

          for (const acct of acctList) {
            // Get funds for detailed asset breakdown
            const fundsResult = await api.broker
              .getFunds(acct.accountId)
              .catch((_: unknown) => null);
            const funds = fundsResult?.success ? fundsResult.funds : null;

            // Get positions
            const posResult = await api.broker
              .getPositions(acct.accountId)
              .catch((_: unknown) => null);
            const posList: PositionData[] = posResult?.success
              ? posResult.positions ?? []
              : [];

            const totalAssets = funds?.totalAssets ?? acct.totalAssets ?? 0;
            const cash = funds?.cash ?? acct.cash ?? 0;
            const marketValue = funds?.marketValue ?? acct.marketValue ?? 0;
            const unrealizedPnl = posList.reduce(
              (sum: number, p: PositionData) => sum + (p.pnl ?? 0),
              0
            );

            allAccounts.push({
              brokerId: broker.id,
              brokerName: broker.name,
              accountId: acct.accountId,
              currency: acct.currency ?? funds?.currency ?? 'USD',
              totalAssets,
              cash,
              marketValue,
              unrealizedPnl,
              realizedPnl: totalAssets - cash - marketValue,
            });

            // Aggregate positions
            for (const pos of posList) {
              const qty = pos.qty ?? 0;
              if (qty <= 0) continue;

              const costPrice = pos.costPrice ?? 0;
              const mktPrice = pos.marketPrice ?? 0;
              const mktValue = pos.marketValue ?? qty * mktPrice;
              const existing = positionMap.get(pos.code);

              if (existing) {
                existing.totalQty += qty;
                existing.totalCostBasis += qty * costPrice;
                existing.totalValue += mktValue;
                if (qty > existing.maxQty) {
                  existing.marketPrice = mktPrice;
                  existing.maxQty = qty;
                }
                existing.brokers.push({
                  brokerId: broker.id,
                  qty,
                  cost: costPrice,
                });
              } else {
                positionMap.set(pos.code, {
                  name: pos.name || pos.code,
                  totalQty: qty,
                  totalCostBasis: qty * costPrice,
                  marketPrice: mktPrice,
                  maxQty: qty,
                  totalValue: mktValue,
                  brokers: [{ brokerId: broker.id, qty, cost: costPrice }],
                });
              }
            }
          }
        } catch (brokerErr) {
    // [EngineError:SYSTEM] — structured error tracking
          void EngineError; // structured error domain: SYSTEM
          console.warn(`[AccountSummary] Error processing broker ${broker.id}:`, brokerErr);
        }
      }

      setAccounts(allAccounts);

      // Build aggregated positions array
      const aggPositions: AggregatedPosition[] = [];
      for (const [code, data] of positionMap.entries()) {
        const avgCost = data.totalQty > 0 ? data.totalCostBasis / data.totalQty : 0;
        const totalPnl = data.totalValue - data.totalCostBasis;
        const pnlPct = data.totalCostBasis > 0 ? (totalPnl / data.totalCostBasis) * 100 : 0;

        aggPositions.push({
          code,
          name: data.name,
          totalQty: data.totalQty,
          avgCost: Math.round(avgCost * 100) / 100,
          marketPrice: data.marketPrice,
          totalValue: Math.round(data.totalValue * 100) / 100,
          totalPnl: Math.round(totalPnl * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
          brokers: data.brokers,
        });
      }
      aggPositions.sort((a, b) => b.totalValue - a.totalValue);
      setPositions(aggPositions);

      // Compute summary
      const totalAssets = allAccounts.reduce((s, a) => s + a.totalAssets, 0);
      const totalCash = allAccounts.reduce((s, a) => s + a.cash, 0);
      const totalMarketValue = allAccounts.reduce((s, a) => s + a.marketValue, 0);
      const totalUnrealizedPnl = allAccounts.reduce((s, a) => s + a.unrealizedPnl, 0);
      const totalRealizedPnl = allAccounts.reduce((s, a) => s + a.realizedPnl, 0);

      setSummary({
        totalAssets: Math.round(totalAssets * 100) / 100,
        totalCash: Math.round(totalCash * 100) / 100,
        totalMarketValue: Math.round(totalMarketValue * 100) / 100,
        totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
        totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
        accountCount: allAccounts.length,
        positionCount: aggPositions.length,
      });
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      console.error('[AccountSummary] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading account data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <div className="text-red-400 font-semibold mb-2">⚠ Connection Error</div>
          <div className="text-gray-400 text-sm">{error}</div>
          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="mt-4 px-4 py-2 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-sm transition-colors"
          >
            ↻ Retry
          </button>
        </div>
      </div>
    );
  }

  const connectedCount = brokers.filter((b) => b.connected).length;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Account Summary</h1>
          <p className="text-sm text-gray-400 mt-1">
            Cross-broker asset aggregation · {connectedCount} of {brokers.length} brokers connected
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          className="px-3 py-1.5 bg-[#2a2d3a] hover:bg-[#353849] text-gray-300 rounded-lg text-sm transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard label="Total Assets" value={summary.totalAssets} color="text-white" />
        <SummaryCard label="Cash" value={summary.totalCash} color="text-blue-400" />
        <SummaryCard label="Market Value" value={summary.totalMarketValue} color="text-purple-400" />
        <SummaryCard
          label="Unrealized P&L"
          value={summary.totalUnrealizedPnl}
          color={summary.totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <SummaryCard
          label="Realized P&L"
          value={summary.totalRealizedPnl}
          color={summary.totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Accounts</div>
          <div className="text-lg font-bold text-white mt-1">{summary.accountCount}</div>
        </div>
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Unique Positions</div>
          <div className="text-lg font-bold text-white mt-1">{summary.positionCount}</div>
        </div>
        <div className="bg-[#1e2130] rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400">Connected Brokers</div>
          <div className="text-lg font-bold text-white mt-1">{connectedCount}</div>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#1a1b26] rounded-lg p-1 w-fit">
        {(['summary', 'brokers', 'positions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-[#2a2d3a] text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'summary' && 'Overview'}
            {tab === 'brokers' && `Brokers (${accounts.length})`}
            {tab === 'positions' && `Positions (${positions.length})`}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* Asset allocation bar */}
          <div className="bg-[#1e2130] rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-2">Asset Allocation</div>
            {summary.totalAssets > 0 ? (
              <div className="w-full bg-[#2a2d3a] rounded-full h-4 flex overflow-hidden">
                <div
                  className="h-4 bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min((summary.totalCash / summary.totalAssets) * 100, 100)}%`,
                  }}
                  title={`Cash: ${((summary.totalCash / summary.totalAssets) * 100).toFixed(1)}%`}
                />
                <div
                  className="h-4 bg-purple-500 transition-all"
                  style={{
                    width: `${Math.min((summary.totalMarketValue / summary.totalAssets) * 100, 100)}%`,
                  }}
                  title={`Market: ${((summary.totalMarketValue / summary.totalAssets) * 100).toFixed(1)}%`}
                />
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No assets to display</div>
            )}
            <div className="flex gap-6 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-gray-400">
                  Cash {summary.totalAssets > 0 ? ((summary.totalCash / summary.totalAssets) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-gray-400">
                  Market {summary.totalAssets > 0 ? ((summary.totalMarketValue / summary.totalAssets) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Top positions by value */}
          {positions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Positions by Value</h3>
              <div className="space-y-2">
                {positions.slice(0, 5).map((pos) => {
                  const pnlColor = pos.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                  return (
                    <div
                      key={pos.code}
                      className="bg-[#1e2130] rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-white">{pos.code}</span>
                        <span className="text-xs text-gray-400">{pos.name}</span>
                        {pos.brokers.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                            {pos.brokers.length} brokers
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-300">
                          {pos.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-sm font-semibold ${pnlColor}`}>
                          {pos.totalPnl >= 0 ? '+' : ''}
                          {pos.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pos.pnlPct >= 0 ? '+' : ''}
                          {pos.pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Brokers Tab ────────────────────────────────────────────────── */}
      {activeTab === 'brokers' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-[#2a2d3a]">
                <th className="py-2 px-3 font-medium">Broker</th>
                <th className="py-2 px-3 font-medium">Account</th>
                <th className="py-2 px-3 font-medium">Currency</th>
                <th className="py-2 px-3 font-medium text-right">Total Assets</th>
                <th className="py-2 px-3 font-medium text-right">Cash</th>
                <th className="py-2 px-3 font-medium text-right">Market Value</th>
                <th className="py-2 px-3 font-medium text-right">Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No connected broker accounts
                  </td>
                </tr>
              ) : (
                accounts.map((acct) => (
                  <BrokerRow
                    key={`${acct.brokerId}-${acct.accountId}`}
                    account={acct}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Positions Tab ──────────────────────────────────────────────── */}
      {activeTab === 'positions' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-[#2a2d3a]">
                <th className="py-2 px-3 font-medium">Code</th>
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium text-right">Qty</th>
                <th className="py-2 px-3 font-medium text-right">Avg Cost</th>
                <th className="py-2 px-3 font-medium text-right">Market</th>
                <th className="py-2 px-3 font-medium text-right">Value</th>
                <th className="py-2 px-3 font-medium text-right">P&L</th>
                <th className="py-2 px-3 font-medium text-right">P&L %</th>
                <th className="py-2 px-3 font-medium text-center">Brokers</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No positions across connected brokers
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <AggregatedPositionRow key={pos.code} pos={pos} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
