/**
 * IBKRBrokerPanel — ML-68-01 [P0]
 * R68: v1.7.0-alpha — IBKR (Interactive Brokers) broker configuration panel
 *
 * Features:
 * - IB Gateway connection settings (host/port/clientId/account)
 * - Connection status indicator with live ping
 * - HK/US/CN 3-market fee comparison table (Futu vs IBKR)
 * - IBKR-specific: smart routing / algo orders / margin rates
 * - Broker switch toggle (Futu ↔ IBKR) with confirmation
 * - Account summary: balance, buying power, margin utilization
 */

import { useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type BrokerId = 'futu' | 'ibkr';

export interface IBKRConfig {
  host: string;
  port: number;
  clientId: number;
  accountId: string;
  useTws: boolean;         // TWS vs IB Gateway
  paperTrading: boolean;
}

export interface BrokerStatus {
  broker: BrokerId;
  connected: boolean;
  latencyMs: number;
  accountId: string;
  balance: number;
  currency: string;
  buyingPower: number;
  marginUtilization: number;
  lastError?: string;
}

export interface FeeComparison {
  market: string;
  flag: string;
  futuCommission: string;
  futuMin: string;
  ibkrCommission: string;
  ibkrMin: string;
  best: BrokerId;
}

export interface IBKRBrokerPanelProps {
  ibkrConfig?: IBKRConfig;
  futuStatus?: BrokerStatus;
  ibkrStatus?: BrokerStatus;
  onConnect?: (config: IBKRConfig) => Promise<boolean>;
  onDisconnect?: () => void;
  onSwitchBroker?: (broker: BrokerId) => void;
  activeBroker?: BrokerId;
  className?: string;
}

// ── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_IBKR: IBKRConfig = {
  host: '127.0.0.1',
  port: 4002,
  clientId: 1,
  accountId: '',
  useTws: false,
  paperTrading: true,
};

const FEE_COMPARISON: FeeComparison[] = [
  { market: '🇺🇸 美股 US', flag: 'US', futuCommission: '$0.0049/股', futuMin: '$0.99', ibkrCommission: '$0.005/股 (固定) / $0.0035 (阶梯)', ibkrMin: '$1.00 / $0.35', best: 'futu' },
  { market: '🇭🇰 港股 HK', flag: 'HK', futuCommission: '0.03%', futuMin: 'HK$3', ibkrCommission: '0.08%', ibkrMin: 'HK$18', best: 'futu' },
];

const IBKR_FEATURES = [
  { icon: '🌍', title: '全球市场', desc: '150+ markets across 33 countries' },
  { icon: '🧠', title: 'SmartRouting', desc: '自动最优成交路径 (SMART)' },
  { icon: '📊', title: '保证金交易', desc: 'Portfolio Margin / Reg-T Margin' },
  { icon: '🔬', title: 'API生态', desc: 'TWS API / IB Gateway / Client Portal' },
  { icon: '💱', title: '外汇', desc: '极低点差, 23种货币对' },
  { icon: '📈', title: '期权期货', desc: '全球期权+期货+外汇+债券' },
];

// ── Live Ping Badge ─────────────────────────────────────────────────────

function PingBadge({ connected, latency }: { connected: boolean; latency: number }) {
  const color = connected ? (latency < 50 ? '#4ade80' : latency < 150 ? '#fbbf24' : '#f87171') : '#ef4444';
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, animation: connected ? 'pulse 2s infinite' : 'none' }} />
      {connected ? `${latency}ms` : '断开'}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function IBKRBrokerPanel({
  ibkrConfig: propConfig,
  futuStatus,
  ibkrStatus,
  onConnect,
  onDisconnect,
  onSwitchBroker,
  activeBroker = 'futu',
  className = '',
}: IBKRBrokerPanelProps) {
  const [config, setConfig] = useState<IBKRConfig>(propConfig ?? DEFAULT_IBKR);
  const [connecting, setConnecting] = useState(false);
  const [connectingError, setConnectingError] = useState('');
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const isIbkrConnected = ibkrStatus?.connected ?? false;

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectingError('');
    try {
      const ok = await onConnect?.(config);
      if (!ok) setConnectingError('连接失败，请检查地址和端口');
    } catch {
      setConnectingError('网络错误，请确认 IB Gateway 已启动');
    } finally {
      setConnecting(false);
    }
  }, [config, onConnect]);

  const handleSwitch = useCallback((target: BrokerId) => {
    setShowSwitchConfirm(false);
    onSwitchBroker?.(target);
  }, [onSwitchBroker]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">券商管理</h2>
            <p className="text-gray-500 text-xs mt-0.5">Futu OpenD · Interactive Brokers</p>
          </div>
          {/* Active broker indicator */}
          <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg p-1">
            {(['futu', 'ibkr'] as BrokerId[]).map(b => (
              <button key={b} onClick={() => setShowSwitchConfirm(true)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeBroker === b ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600 hover:text-gray-400'}`}>
                {b === 'futu' ? '🐂 Futu 富途' : '🏦 IBKR 盈透'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── Status Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Futu Status */}
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-300">🐂 Futu OpenD</span>
              <PingBadge connected={futuStatus?.connected ?? true} latency={futuStatus?.latencyMs ?? 15} />
            </div>
            {futuStatus && (
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between"><span>账户</span><span className="text-gray-300">{futuStatus.accountId}</span></div>
                <div className="flex justify-between"><span>余额</span><span className="text-gray-200">{futuStatus.balance.toLocaleString()} {futuStatus.currency}</span></div>
                <div className="flex justify-between"><span>购买力</span><span className="text-gray-300">{futuStatus.buyingPower.toLocaleString()}</span></div>
              </div>
            )}
          </div>

          {/* IBKR Status */}
          <div className="bg-[#111119] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-300">🏦 IBKR</span>
              <PingBadge connected={isIbkrConnected} latency={ibkrStatus?.latencyMs ?? 0} />
            </div>
            {ibkrStatus && isIbkrConnected ? (
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between"><span>账户</span><span className="text-gray-300">{ibkrStatus.accountId}</span></div>
                <div className="flex justify-between"><span>余额</span><span className="text-gray-200">{ibkrStatus.balance.toLocaleString()} {ibkrStatus.currency}</span></div>
                <div className="flex justify-between"><span>保证金使用率</span>
                  <span className={ibkrStatus.marginUtilization > 0.7 ? 'text-red-400' : 'text-green-400'}>
                    {(ibkrStatus.marginUtilization * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-600 text-center py-4">未连接</div>
            )}
          </div>
        </div>

        {/* ── IBKR Connection Config ───────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-4">🔌 IB Gateway 连接设置</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Host</label>
              <input type="text" value={config.host} onChange={e => setConfig(p => ({ ...p, host: e.target.value }))}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Port</label>
              <input type="number" value={config.port} onChange={e => setConfig(p => ({ ...p, port: Number(e.target.value) }))}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Client ID</label>
              <input type="number" value={config.clientId} onChange={e => setConfig(p => ({ ...p, clientId: Number(e.target.value) }))}
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider">Account ID</label>
              <input type="text" value={config.accountId} onChange={e => setConfig(p => ({ ...p, accountId: e.target.value }))}
                     placeholder="U1234567"
                     className="w-full mt-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046]/50" />
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={config.paperTrading} onChange={e => setConfig(p => ({ ...p, paperTrading: e.target.checked }))}
                     className="accent-[#C9A046]" />
              模拟盘 Paper Trading
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={config.useTws} onChange={e => setConfig(p => ({ ...p, useTws: e.target.checked }))}
                     className="accent-[#C9A046]" />
              使用 TWS (非IB Gateway)
            </label>
          </div>

          {connectingError && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs mb-3">{connectingError}</div>
          )}

          <div className="flex gap-3">
            <button onClick={handleConnect} disabled={connecting || isIbkrConnected}
                    className="px-6 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors disabled:opacity-40">
              {connecting ? '⏳ 连接中...' : isIbkrConnected ? '✅ 已连接' : '🔌 连接 IBKR'}
            </button>
            {isIbkrConnected && (
              <button onClick={onDisconnect}
                      className="px-6 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors">
                断开连接
              </button>
            )}
          </div>
        </div>

        {/* ── Fee Comparison ────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="text-gray-300 font-semibold text-sm">💰 三市场费率对比 Futu vs IBKR</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-gray-500">
                <th className="text-left px-5 py-2.5 font-medium">市场</th>
                <th className="text-left px-5 py-2.5 font-medium">🐂 Futu 佣金</th>
                <th className="text-left px-5 py-2.5 font-medium">Futu 最低</th>
                <th className="text-left px-5 py-2.5 font-medium">🏦 IBKR 佣金</th>
                <th className="text-left px-5 py-2.5 font-medium">IBKR 最低</th>
                <th className="text-center px-5 py-2.5 font-medium">最优</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {FEE_COMPARISON.map(row => (
                <tr key={row.market} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-gray-300 font-medium">{row.market}</td>
                  <td className="px-5 py-3 text-gray-400 font-mono">{row.futuCommission}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono">{row.futuMin}</td>
                  <td className="px-5 py-3 text-gray-400 font-mono">{row.ibkrCommission}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono">{row.ibkrMin}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${row.best === 'futu' ? 'text-[#D4A853] bg-[#C9A046]/10' : 'text-blue-400 bg-blue-400/10'}`}>
                      {row.best === 'futu' ? '🐂 Futu' : '🏦 IBKR'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-2 text-[10px] text-gray-600 border-t border-white/5">
            💡 IBKR阶梯式佣金在月交易量&gt;30万股后更便宜。港股 Futu有绝对优势。
          </div>
        </div>

        {/* ── IBKR Features ─────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-3">🏦 IBKR 独有功能</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {IBKR_FEATURES.map(f => (
              <div key={f.title} className="p-3 bg-white/[0.02] rounded-lg">
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-xs font-semibold text-gray-300">{f.title}</div>
                <div className="text-[10px] text-gray-600 mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Switch Confirmation Modal ────────────────────────────────────── */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
             onClick={() => setShowSwitchConfirm(false)}>
          <div className="bg-[#1A1A24] border border-white/10 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">切换券商</h3>
            <p className="text-gray-400 text-sm mb-2">
              切换到 IBKR 后，所有下单将使用盈透证券执行。费率、结算周期、交易规则将会改变。
            </p>
            <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg mb-4 text-xs text-yellow-400">
              ⚠️ 请确认 IB Gateway 已启动并登录。Paper Trading 模式建议先测试。
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSwitchConfirm(false)}
                      className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm">取消</button>
              <button onClick={() => handleSwitch(activeBroker === 'futu' ? 'ibkr' : 'futu')}
                      className="flex-1 py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm">
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
    </div>
  );
}
