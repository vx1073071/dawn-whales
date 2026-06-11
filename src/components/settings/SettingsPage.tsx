import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import {
  connectBroker, isConnected as checkConnected, getRiskConfig, getRiskAlerts,
  listBrokers, addBroker, removeBroker, setActiveBroker, getBrokerStatus } from
'@/lib/bridge-api';
import BrokerConfigSelector from '../trading/BrokerConfigSelector';
import i18n from '../../i18n';

type SettingsTab = 'broker-mgmt' | 'connect' | 'risk' | 'info';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('broker-mgmt');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('11111');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [riskConfig, setRiskConfig] = useState<unknown>(null);
  const [alerts, setAlerts] = useState<unknown[]>([]);
  const [appInfo, setAppInfo] = useState<unknown>(null);

  // ── Broker Manager (Sprint2) ────────────────────────────────────────
  const [brokers, setBrokers] = useState<BrokerItem[]>([]);
  const [brokerStatus, setBrokerStatus] = useState<unknown[]>([]);
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
    } catch (_e: unknown) {/* silent */}
    void EngineError; // [SYSTEM] structured error tracking
  }

  async function refreshBrokers() {
    try {
      const list = await listBrokers();
      const status = await getBrokerStatus();
      setBrokers(list);
      setBrokerStatus(status);
    } catch (_e: unknown) {/* silent */}
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
        setConnectError(result?.error || 'settings.connectionFailed');
      }
    } catch (e: unknown) {
      setConnectError((e as any).message || 'settings.connectionError');
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
        enabled: true
      };
      const result = await addBroker(cfg);
      if (result?.success) {
        setShowAddBroker(false);
        setNewBroker({ name: '', type: 'futu', host: '127.0.0.1', port: '11111' });
        await refreshBrokers();
      } else {
        alert(result?.error || i18n.t('SettingsPage.k1'));
      }
    } catch (e: unknown) {
      alert((e as any).message || i18n.t('SettingsPage.k2'));
    } finally {
      setBrokerActionLoading(null);
    }
  }

  async function handleRemoveBroker(id: string) {
    if (!confirm('settings.confirmDeleteBroker')) return;
    setBrokerActionLoading(id);
    try {
      await removeBroker(id);
      await refreshBrokers();
    } catch (e: unknown) {
      alert((e as any).message || i18n.t('SettingsPage.k3'));
    } finally {
      setBrokerActionLoading(null);
    }
  }

  async function handleSetActive(id: string) {
    setBrokerActionLoading(id);
    try {
      await setActiveBroker(id);
      await refreshBrokers();
    } catch (e: unknown) {
      alert((e as any).message || i18n.t('SettingsPage.k4'));
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
    } catch (_e: unknown) {/* silent */}
  }

  // Callbacks for BrokerSelector
  function handleBrokerSelectorChange(brokerId: string) {
    console.log('[SettingsPage] Broker changed:', brokerId);
    refreshBrokers();
  }

  function handleBrokerConnectionChange(isConnected: boolean) {
    console.log('[SettingsPage] Connection changed:', isConnected);
    setConnected(isConnected);
    init(); // Refresh risk config and app info
  }

  // @ts-ignore — R89 type fix
  const activeBrokerId = brokerStatus.find((s: any) => s.active)?.id || (brokerStatus[0] as any)?.id;

  const tabs: {id: SettingsTab;label: string;icon: string;}[] = [
  { id: 'broker-mgmt', label: 'settings.brokerManagement', icon: '🏦' },
  { id: 'connect', label: 'settings.quickConnect', icon: '🔌' },
  { id: 'risk', label: 'settings.globalRisk', icon: '🛡️' },
  { id: 'info', label: 'settings.systemInfo', icon: 'ℹ️' }];


  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{"settings.title"}</h1>
      <p className="text-gray-400 text-sm mb-6">{"settings.subtitle"}</p>

      {/* ── Tab Navigation ────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#1a1a25] border border-white/5 rounded-xl p-1 mb-6">
        {tabs.map((tab) =>
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          activeTab === tab.id ?
          'bg-[#C9A046]/20 text-[#C9A046]' :
          'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`
          }>
          
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        )}
      </div>

      {/* ── Tab: 券商管理 (Broker Management) ───────────────────── */}
      {activeTab === 'broker-mgmt' &&
      <>
          {/* BrokerSelector Component */}
          <div className="mb-4">
            <BrokerConfigSelector
            onBrokerChange={handleBrokerSelectorChange}
            onConnectionChange={handleBrokerConnectionChange} />
          
          </div>

          {/* ── Legacy Broker Management (Sprint2) ───────────────── */}
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">🏦 {"settings.brokerConfig"}</h2>
              <button
              onClick={() => setShowAddBroker(!showAddBroker)}
              className="text-xs bg-[#C9A046]/20 text-[#C9A046] hover:bg-[#C9A046]/30 px-3 py-1.5 rounded-lg transition-colors">
              
                {showAddBroker ? 'components.cancel' : i18n.t('SettingsPage.k5')}
              </button>
            </div>

            {/* Add broker form */}
            {showAddBroker &&
          <div className="bg-[#12121a] rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{"components.name"}</label>
                    <input
                  value={newBroker.name}
                  onChange={(e) => setNewBroker({ ...newBroker, name: e.target.value })}
                  placeholder={i18n.t('SettingsPage.k0')}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50" />
                
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{"components.type"}</label>
                    <select
                  value={newBroker.type}
                  onChange={(e) => setNewBroker({ ...newBroker, type: e.target.value })}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                  
                      <option value="futu">{"settings.brokerFutu"}</option>
                      <option value="moomoo">moomoo</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-gray-400 text-xs mb-1">{"settings.host"}</label>
                    <input
                  value={newBroker.host}
                  onChange={(e) => setNewBroker({ ...newBroker, host: e.target.value })}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
                
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{"settings.port"}</label>
                    <input
                  value={newBroker.port}
                  onChange={(e) => setNewBroker({ ...newBroker, port: e.target.value })}
                  className="w-full bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
                
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleAddBroker}
                disabled={brokerActionLoading === 'add'}
                className="bg-[#C9A046] text-black text-sm px-4 py-2 rounded-lg hover:bg-[#D4A853] disabled:opacity-40 transition-colors">
                
                    {brokerActionLoading === 'add' ? 'settings.adding' : 'settings.confirmAdd'}
                  </button>
                </div>
              </div>
          }

            {/* Broker list */}
            <div className="space-y-2">
              {brokers.length === 0 &&
            <p className="text-gray-500 text-sm py-4 text-center">{"settings.noBroker"}</p>
            }
              {brokers.map((broker) => {
              const status = brokerStatus.find((s: any) => s.id === broker.id) as any;
              const isConnected = status?.connected || false;
              const isActive = activeBrokerId === broker.id;
              const isLoading = brokerActionLoading === broker.id;

              return (
                <div
                  key={broker.id}
                  className={`flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 border transition-colors ${
                  isActive ? 'border-[#C9A046]/40' : 'border-transparent'}`
                  }>
                  
                    {/* Status indicator */}
                    <div className="relative">
                      <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                      {isConnected &&
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
                    }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{broker.name}</span>
                        {isActive &&
                      <span className="text-[10px] bg-[#C9A046]/20 text-[#C9A046] px-1.5 py-0.5 rounded">{"settings.currentlyInUse"}</span>
                      }
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="uppercase">{broker.type}</span>
                        <span>·</span>
                        <span className="font-mono">{broker.host}:{broker.port}</span>
                        <span>·</span>
                        <span className={isConnected ? 'text-emerald-400' : 'text-gray-600'}>
                          {isConnected ? 'components.connected' : 'components.disconnected'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!isActive &&
                    <button
                      onClick={() => handleSetActive(broker.id)}
                      disabled={isLoading}
                      className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                      
                          {isLoading ? '...' : 'components.switch'}
                        </button>
                    }
                      <button
                      onClick={() => handleRemoveBroker(broker.id)}
                      disabled={isLoading}
                      className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                      
                        {isLoading ? '...' : 'components.delete'}
                      </button>
                    </div>
                  </div>);

            })}
            </div>
          </div>
        </>
      }

      {/* ── Tab: 快速连接 (Quick Connect) ────────────────────────── */}
      {activeTab === 'connect' &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">{i18n.t("SettingsPage.r92_879b")}</h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">{i18n.t('SettingsPage.k1')}</label>
                <select className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                  <option>{"settings.brokerFutu"}</option>
                  <option>moomoo</option>
                  <option disabled>{"settings.longbridgeSoon"}</option>
                  <option disabled>{"settings.ibSoon"}</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{i18n.t('SettingsPage.k2')}</label>
                <select className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#C9A046]/50">
                  <option>{"settings.realTrading"}</option>
                  <option>{"settings.simulateTrading"}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-gray-400 text-xs mb-1">{"settings.opendAddress"}</label>
                <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{"settings.port"}</label>
                <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50" />
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <button
              onClick={handleConnect}
              disabled={connecting}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              connected ?
              'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
              'bg-[#C9A046] text-black hover:bg-[#D4A853] disabled:opacity-40'}`
              }>
              
                {connecting ? 'settings.connecting' : connected ? 'settings.disconnect' : 'settings.connectOpend'}
              </button>
              {connected &&
            <span className="text-emerald-400 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {"settings.pushMode"}
                </span>
            }
              {connectError && <span className="text-red-400 text-xs">{connectError}</span>}
            </div>
          </div>
        </div>
      }

      {/* ── Tab: 全局风控 (Risk Config) ──────────────────────────── */}
      {activeTab === 'risk' &&
      <>
          {/* Risk config */}
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">{i18n.t("SettingsPage.r92_a846")}</h2>

            {riskConfig ?
          <div className="grid grid-cols-2 gap-4">
                <RiskSlider label={i18n.t('SettingsPage.k6')} value={Math.round(((riskConfig as any).dailyLossLimitPct || 0.05) * 100)} max={20} unit="%" onSave={(v) => handleRiskSave('dailyLossLimitPct', v)} />
                <RiskSlider label={i18n.t('SettingsPage.k7')} value={Math.round(((riskConfig as any).maxSinglePositionPct || 0.20) * 100)} max={50} unit="%" onSave={(v) => handleRiskSave('maxSinglePositionPct', v)} />
                <RiskSlider label={i18n.t('SettingsPage.k8')} value={Math.round(((riskConfig as any).maxTotalPositionPct || 0.95) * 100)} max={100} unit="%" onSave={(v) => handleRiskSave('maxTotalPositionPct', v)} />
                <RiskSlider label={i18n.t('SettingsPage.k9')} value={(riskConfig as any).maxOrdersPerMinute || 10} max={30} unit={i18n.t('SettingsPage.k10')} onSave={(v) => handleRiskSave('maxOrdersPerMinute', v)} />
              </div> :

          <p className="text-gray-500 text-sm">{"settings.connectHint"}</p>
          }
          </div>

          {/* Risk alerts */}
          {alerts.length > 0 &&
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6 mb-4">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">⚠️ {"settings.riskAlerts"}</h2>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {alerts.slice(-10).reverse().map((a, i) =>
            <div key={i} className="flex items-center gap-3 text-xs bg-red-500/10 rounded-lg px-3 py-2">
                    <span className="text-red-400">{(a as any).type}</span>
                    <span className="text-gray-300 flex-1">{(a as any).message}</span>
                    <span className="text-gray-600">{(a as any).time ? new Date((a as any).time).toLocaleTimeString() : ''}</span>
                  </div>
            )}
              </div>
            </div>
        }
        </>
      }

      {/* ── Tab: 系统信息 (App Info) ─────────────────────────────── */}
      {activeTab === 'info' &&
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">{i18n.t("SettingsPage.r92_098a")}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label={i18n.t('SettingsPage.k11')} value={(appInfo as any)?.version || '0.1.0'} />
            <InfoRow label={i18n.t('SettingsPage.k12')} value={`${(appInfo as any)?.platform || 'win32'} ${(appInfo as any)?.arch || 'x64'}`} />
            <InfoRow label="Electron" value={(appInfo as any)?.electronVersion || '--'} />
            <InfoRow label="Node.js" value={(appInfo as any)?.nodeVersion || '--'} />
            <InfoRow label="Chrome" value={(appInfo as any)?.chromeVersion || '--'} />
            <InfoRow label={"settings.database"} value={"settings.sqliteWal"} />
          </div>
        </div>
      }
    </div>);

}

function RiskSlider({ label, value, max, unit, onSave }: {label: string;value: number;max: number;unit: string;onSave: (v: number) => void;}) {
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
          className="flex-1 h-1.5 bg-[#12121a] rounded-lg appearance-none cursor-pointer accent-[#C9A046]" />
        
        <button onClick={() => onSave(val)} className="text-xs text-[#C9A046] hover:text-[#D4A853] px-2 py-1 rounded transition-colors">{"components.save"}</button>
      </div>
    </div>);

}

function InfoRow({ label, value }: {label: string;value: string;}) {
  return (
    <div className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono text-xs">{value}</span>
    </div>);

}