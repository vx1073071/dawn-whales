import { useState, useEffect } from 'react';
import { connectBroker, isConnected as checkConnected, getRiskConfig, getRiskAlerts } from '@/lib/bridge-api';

export default function SettingsPage() {
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('11111');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [riskConfig, setRiskConfig] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [appInfo, setAppInfo] = useState<any>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const ok = await checkConnected();
    setConnected(ok);
    try {
      const config = await getRiskConfig();
      if (config) setRiskConfig(config);
      const alertList = await getRiskAlerts();
      setAlerts(alertList);
      if (typeof window !== 'undefined' && window.api?.app) {
        const info = await window.api.app.getInfo();
        setAppInfo(info);
      }
    } catch { /* silent */ }
  }

  async function handleConnect() {
    if (connected) {
      // disconnect not wired yet
      setConnected(false);
      return;
    }
    setConnecting(true);
    setConnectError('');
    try {
      const result = await connectBroker({ host, port: Number(port) });
      if (result?.success) {
        setConnected(true);
      } else {
        setConnectError(result?.error || '连接失败');
      }
    } catch (e: any) {
      setConnectError(e.message || '连接异常');
    } finally {
      setConnecting(false);
    }
  }

  async function handleRiskSave(key: string, value: number) {
    if (!riskConfig) return;
    const updated = { ...riskConfig, [key]: value / 100 };
    setRiskConfig(updated);
    try {
      if (typeof window !== 'undefined' && window.api?.risk) {
        await window.api.risk.updateConfig(updated);
      }
    } catch { /* silent */ }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">系统设置</h1>
      <p className="text-gray-400 text-sm mb-6">券商连接、风控参数、系统信息</p>

      {/* Broker connection */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">🔌 券商连接</h2>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">券商</label>
              <select className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                <option>富途 Futu</option>
                <option>moomoo</option>
                <option disabled>长桥 Longbridge (即将)</option>
                <option disabled>盈透 IB (即将)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">交易环境</label>
              <select className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                <option>实盘 REAL</option>
                <option>模拟盘 SIMULATE</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">OpenD 地址</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">端口</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                connected
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-[#C9A046] text-black hover:bg-[#D4A853] disabled:opacity-40'
              }`}
            >
              {connecting ? '连接中...' : connected ? '断开连接' : '连接 OpenD'}
            </button>
            {connected && (
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                已连接 · Push 模式
              </span>
            )}
            {connectError && <span className="text-red-400 text-xs">{connectError}</span>}
          </div>
        </div>
      </div>

      {/* Risk config */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">🛡️ 全局风控</h2>

        {riskConfig ? (
          <div className="grid grid-cols-2 gap-4">
            <RiskSlider label="日最大亏损" value={Math.round((riskConfig.dailyLossLimitPct || 0.05) * 100)} max={20} unit="%" onSave={(v) => handleRiskSave('dailyLossLimitPct', v)} />
            <RiskSlider label="单品种最大仓位" value={Math.round((riskConfig.maxSinglePositionPct || 0.20) * 100)} max={50} unit="%" onSave={(v) => handleRiskSave('maxSinglePositionPct', v)} />
            <RiskSlider label="总持仓上限" value={Math.round((riskConfig.maxTotalPositionPct || 0.95) * 100)} max={100} unit="%" onSave={(v) => handleRiskSave('maxTotalPositionPct', v)} />
            <RiskSlider label="每分钟最大下单" value={riskConfig.maxOrdersPerMinute || 10} max={30} unit="笔" onSave={(v) => handleRiskSave('maxOrdersPerMinute', v)} />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">连接 OpenD 后可配置风控参数</p>
        )}
      </div>

      {/* Risk alerts */}
      {alerts.length > 0 && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">⚠️ 风控告警</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {alerts.slice(-10).reverse().map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-red-500/10 rounded-lg px-3 py-2">
                <span className="text-red-400">{a.type}</span>
                <span className="text-gray-300 flex-1">{a.message}</span>
                <span className="text-gray-600">{a.time ? new Date(a.time).toLocaleTimeString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* App info */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">ℹ️ 系统信息</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="版本" value={appInfo?.version || '0.1.0'} />
          <InfoRow label="平台" value={`${appInfo?.platform || 'win32'} ${appInfo?.arch || 'x64'}`} />
          <InfoRow label="Electron" value={appInfo?.electronVersion || '--'} />
          <InfoRow label="Node.js" value={appInfo?.nodeVersion || '--'} />
          <InfoRow label="Chrome" value={appInfo?.chromeVersion || '--'} />
          <InfoRow label="数据库" value="SQLite (WAL)" />
        </div>
      </div>
    </div>
  );
}

function RiskSlider({ label, value, max, unit, onSave }: { label: string; value: number; max: number; unit: string; onSave: (v: number) => void }) {
  const [val, setVal] = useState(value);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-[#D4A853] font-mono">{val}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={1} max={max} value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          className="flex-1 h-1.5 bg-[#12121a] rounded-lg appearance-none cursor-pointer accent-[#C9A046]"
        />
        <button onClick={() => onSave(val)} className="text-xs text-[#C9A046] hover:text-[#D4A853] px-2 py-1 rounded transition-colors">保存</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono text-xs">{value}</span>
    </div>
  );
}
