import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  connectBroker, isConnected as checkConnected, getRiskConfig, getRiskAlerts,
  listBrokers, addBroker, removeBroker, setActiveBroker, getBrokerStatus,
} from '@/lib/bridge-api';

interface BrokerItem {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  enabled: boolean;
  connected?: boolean;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('11111');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [riskConfig, setRiskConfig] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [appInfo, setAppInfo] = useState<any>(null);

  // ── Broker Manager (Sprint2) ────────────────────────────────────────
  const [brokers, setBrokers] = useState<BrokerItem[]>([]);
  const [brokerStatus, setBrokerStatus] = useState<any[]>([]);
  const [showAddBroker, setShowAddBroker] = useState(false);
  const [newBroker, setNewBroker] = useState({ name: '', type: 'futu', host: '127.0.0.1', port: '11111' });
  const [brokerActionLoading, setBrokerActionLoading] = useState<string | null>(null);

  useEffect(() => {
    init();
    refreshBrokers();
    const interval = setInterval(refreshBrokers, 5000);
    return () => clearInterval(interval);
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
    } catch (e) { console.error('[Error:SettingsPage]', e); }
  }

  async function refreshBrokers() {
    try {
      const list = await listBrokers();
      const status = await getBrokerStatus();
      setBrokers(list);
      setBrokerStatus(status);
    } catch (e) { console.error('[Error:SettingsPage]', e); }
  }

  async function handleConnect() {
    if (connected) {
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
        setConnectError(result?.error || t('settings.connectionFailed'));
      }
    } catch (e: any) {
      setConnectError(e.message || t('settings.connectionError'));
    } finally {
      setConnecting(false);
    }
  }

  async function handleAddBroker() {
    if (!newBroker.name.trim()) return;
    setBrokerActionLoading('add');
    try {
      const cfg = {
        id: `${newBroker.type}-${Date.now()}`,
        name: newBroker.name,
        type: newBroker.type,
        host: newBroker.host,
        port: Number(newBroker.port),
        enabled: true,
      };
      const result = await addBroker(cfg);
      if (result?.success) {
        setShowAddBroker(false);
        setNewBroker({ name: '', type: 'futu', host: '127.0.0.1', port: '11111' });
        await refreshBrokers();
      } else {
        alert(result?.error || t('settings.addFailed'));
      }
    } catch (e: any) {
      alert(e.message || t('settings.addError'));
    } finally {
      setBrokerActionLoading(null);
    }
  }

  async function handleRemoveBroker(id: string) {
    if (!confirm(t('settings.confirmDeleteBroker'))) return;
    setBrokerActionLoading(id);
    try {
      await removeBroker(id);
      await refreshBrokers();
    } catch (e: any) {
      alert(e.message || t('settings.deleteFailed'));
    } finally {
      setBrokerActionLoading(null);
    }
  }

  async function handleSetActive(id: string) {
    setBrokerActionLoading(id);
    try {
      await setActiveBroker(id);
      await refreshBrokers();
    } catch (e: any) {
      alert(e.message || t('settings.switchFailed'));
    } finally {
      setBrokerActionLoading(null);
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
    } catch (e) { console.error('[Error:SettingsPage]', e); }
  }

  const activeBrokerId = brokerStatus.find((s: any) => s.active)?.id || brokerStatus[0]?.id;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{t('settings.title')}</h1>
      <p className="text-gray-400 text-sm mb-6">{t('settings.subtitle')}</p>

      {/* ── Broker Management (Sprint2) ─────────────────────────── */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">🏦 {t('settings.brokerManagement')}</h2>
          <button
            onClick={() => setShowAddBroker(!showAddBroker)}
            className="text-xs bg-[#C9A046]/20 text-[#C9A046] hover:bg-[#C9A046]/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showAddBroker ? t('common.cancel') : `+ ${t('settings.addBroker')}`}
          </button>
        </div>

        {/* Add broker form */}
        {showAddBroker && (
          <div className="bg-[#12121a] rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('common.name')}</label>
                <input
                  value={newBroker.name}
                  onChange={(e) => setNewBroker({ ...newBroker, name: e.target.value })}
                  placeholder={t('settings.brokerNamePlaceholder')}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('common.type')}</label>
                <select
                  value={newBroker.type}
                  onChange={(e) => setNewBroker({ ...newBroker, type: e.target.value })}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50"
                >
                  <option value="futu">{t('settings.brokerFutu')}</option>
                  <option value="moomoo">moomoo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-gray-400 text-xs mb-1">{t('settings.host')}</label>
                <input
                  value={newBroker.host}
                  onChange={(e) => setNewBroker({ ...newBroker, host: e.target.value })}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('settings.port')}</label>
                <input
                  value={newBroker.port}
                  onChange={(e) => setNewBroker({ ...newBroker, port: e.target.value })}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddBroker}
                disabled={brokerActionLoading === 'add'}
                className="bg-[#C9A046] text-black text-sm px-4 py-2 rounded-lg hover:bg-[#D4A853] disabled:opacity-40 transition-colors"
              >
                {brokerActionLoading === 'add' ? t('common.adding') : t('common.confirmAdd')}
              </button>
            </div>
          </div>
        )}

        {/* Broker list */}
        <div className="space-y-2">
          {brokers.length === 0 && (
            <p className="text-gray-500 text-sm py-4 text-center">{t('settings.noBrokerConfig')}</p>
          )}
          {brokers.map((broker) => {
            const status = brokerStatus.find((s: any) => s.id === broker.id);
            const isConnected = status?.connected || false;
            const isActive = activeBrokerId === broker.id;
            const isLoading = brokerActionLoading === broker.id;

            return (
              <div
                key={broker.id}
                className={`flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 border transition-colors ${
                  isActive ? 'border-[#C9A046]/40' : 'border-transparent'
                }`}
              >
                {/* Status indicator */}
                <div className="relative">
                  <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  {isConnected && (
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate">{broker.name}</span>
                    {isActive && (
                      <span className="text-[10px] bg-[#C9A046]/20 text-[#C9A046] px-1.5 py-0.5 rounded">{t('settings.currentlyInUse')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="uppercase">{broker.type}</span>
                    <span>·</span>
                    <span className="font-mono">{broker.host}:{broker.port}</span>
                    <span>·</span>
                    <span className={isConnected ? 'text-emerald-400' : 'text-gray-600'}>
                      {isConnected ? t('common.connected') : t('common.disconnected')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => handleSetActive(broker.id)}
                      disabled={isLoading}
                      className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {isLoading ? '...' : t('common.switch')}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveBroker(broker.id)}
                    disabled={isLoading}
                    className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {isLoading ? '...' : t('common.delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick Connect (legacy) ────────────────────────────────── */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">🔌 {t('settings.quickConnect')}</h2>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t('settings.broker')}</label>
              <select className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                <option>{t('settings.brokerFutu')}</option>
                <option>moomoo</option>
                <option disabled>{t('settings.longbridgeSoon')}</option>
                <option disabled>{t('settings.ibSoon')}</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t('settings.tradingEnv')}</label>
              <select className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                <option>{t('settings.realTrading')}</option>
                <option>{t('settings.simulateTrading')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">{t('settings.opendAddress')}</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t('settings.port')}</label>
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
              {connecting ? t('common.connecting') : connected ? t('common.disconnect') : t('settings.connectOpend')}
            </button>
            {connected && (
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('common.connected')} · Push {t('common.mode')}
              </span>
            )}
            {connectError && <span className="text-red-400 text-xs">{connectError}</span>}
          </div>
        </div>
      </div>

      {/* Risk config */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">🛡️ {t('settings.globalRisk')}</h2>

        {riskConfig ? (
          <div className="grid grid-cols-2 gap-4">
            <RiskSlider label={t('risk.maxDailyLoss')} value={Math.round((riskConfig.dailyLossLimitPct || 0.05) * 100)} max={20} unit="%" onSave={(v) => handleRiskSave('dailyLossLimitPct', v)} />
            <RiskSlider label={t('risk.maxPosition')} value={Math.round((riskConfig.maxSinglePositionPct || 0.20) * 100)} max={50} unit="%" onSave={(v) => handleRiskSave('maxSinglePositionPct', v)} />
            <RiskSlider label={t('risk.maxTotalPosition')} value={Math.round((riskConfig.maxTotalPositionPct || 0.95) * 100)} max={100} unit="%" onSave={(v) => handleRiskSave('maxTotalPositionPct', v)} />
            <RiskSlider label={t('risk.maxOrdersPerMin')} value={riskConfig.maxOrdersPerMinute || 10} max={30} unit={t('common.count')} onSave={(v) => handleRiskSave('maxOrdersPerMinute', v)} />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">{t('settings.connectOpendForRisk')}</p>
        )}
      </div>

      {/* Risk alerts */}
      {alerts.length > 0 && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">⚠️ {t('settings.riskAlerts')}</h2>
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
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">ℹ️ {t('settings.systemInfo')}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label={t('settings.version')} value={appInfo?.version || '0.1.0'} />
          <InfoRow label={t('settings.platform')} value={`${appInfo?.platform || 'win32'} ${appInfo?.arch || 'x64'}`} />
          <InfoRow label="Electron" value={appInfo?.electronVersion || '--'} />
          <InfoRow label="Node.js" value={appInfo?.nodeVersion || '--'} />
          <InfoRow label="Chrome" value={appInfo?.chromeVersion || '--'} />
          <InfoRow label={t('settings.database')} value="SQLite (WAL)" />
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
        <button onClick={() => onSave(val)} className="text-xs text-[#C9A046] hover:text-[#D4A853] px-2 py-1 rounded transition-colors">{t('common.save')}</button>
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
