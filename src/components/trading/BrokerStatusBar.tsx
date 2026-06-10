// ── BrokerStatusBar Component ──────────────────────────────────────────────
// Compact broker status bar with quick switch and account summary
// J-26-02: BrokerSelector 组件 + 多券商 UI

import { useState, useEffect, useCallback } from 'react';

interface BrokerConfig {
  id: string;
  name: string;
  type: 'futu' | 'moomoo' | 'ib' | 'longbridge';
  host: string;
  port: number;
  enabled: boolean;
}

interface BrokerStatus {
  connected: boolean;
  activeId?: string;
  brokers: BrokerConfig[];
}

interface AccountInfo {
  accountId: string;
  name: string;
  currency: string;
  netAssets: number;
  totalAssets: number;
  cash: number;
  marketValue: number;
}

interface BrokerStatusBarProps {
  onBrokerChange?: (brokerId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  compact?: boolean; // Ultra-compact mode
}

export default function BrokerStatusBar({ onBrokerChange, onConnectionChange, compact = false }: BrokerStatusBarProps) {
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [activeBrokerId, setActiveBrokerId] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Load broker status
  const loadStatus = useCallback(async () => {
    try {
      const api = window.api;
      if (!api?.broker) return;

      const brokerList: BrokerConfig[] = await api.broker.list();
      setBrokers(brokerList);

      const status: BrokerStatus = await api.broker.getStatus();
      setConnected(status.connected);
      setActiveBrokerId(status.activeId || '');

      if (onConnectionChange) {
        onConnectionChange(status.connected);
      }

      if (status.connected) {
        try {
          const accs: AccountInfo[] = await api.broker.getAccounts();
          setAccounts(accs);
        } catch (e) {
          console.warn('[BrokerStatusBar] Failed to load accounts:', e);
        }
      } else {
        setAccounts([]);
      }
    } catch (err) {
      console.error('[BrokerStatusBar] Load error:', err);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [loadStatus]);

  // Switch broker
  const handleSwitchBroker = async (brokerId: string) => {
    try {
      setLoading(true);
      const api = window.api;
      await api.broker.setActive(brokerId);
      setActiveBrokerId(brokerId);
      setShowDropdown(false);

      if (onBrokerChange) {
        onBrokerChange(brokerId);
      }

      // Reload accounts
      if (connected) {
        const accs: AccountInfo[] = await api.broker.getAccounts();
        setAccounts(accs);
      }
    } catch (err) {
      console.error('[BrokerStatusBar] Switch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle connection
  const handleToggleConnection = async () => {
    try {
      setLoading(true);
      const api = window.api;

      if (connected) {
        await api.broker.disconnect();
        setConnected(false);
        setAccounts([]);
        if (onConnectionChange) {
          onConnectionChange(false);
        }
      } else {
        const activeBroker = brokers.find(b => b.id === activeBrokerId);
        if (!activeBroker) return;
        await api.broker.connect(activeBroker);
        setConnected(true);
        if (onConnectionChange) {
          onConnectionChange(true);
        }
        const accs: AccountInfo[] = await api.broker.getAccounts();
        setAccounts(accs);
      }
    } catch (err) {
      console.error('[BrokerStatusBar] Connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(2);
  };

  // Get broker type icon
  const getBrokerIcon = (type: string) => {
    switch (type) {
      case 'futu': return '🟢';
      case 'moomoo': return '🟠';
      case 'ib': return '🔴';
      case 'longbridge': return '🟣';
      default: return '⚪';
    }
  };

  const activeBroker = brokers.find(b => b.id === activeBrokerId);
  const totalAssets = accounts.reduce((sum, acc) => sum + acc.totalAssets, 0);
  const totalCash = accounts.reduce((sum, acc) => sum + acc.cash, 0);

  // Ultra-compact mode
  if (compact) {
    return (
      <div className="flex items-center space-x-3 bg-gray-900 rounded-md px-3 py-2">
        {/* Connection Status */}
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        
        {/* Active Broker */}
        {activeBroker && (
          <div className="flex items-center space-x-2">
            <span className="text-sm">{getBrokerIcon(activeBroker.type)}</span>
            <span className="text-white text-sm font-medium">{activeBroker.name}</span>
          </div>
        )}

        {/* Quick Stats */}
        {connected && totalAssets > 0 && (
          <div className="text-xs text-gray-400">
            ${formatCurrency(totalAssets)}
          </div>
        )}
      </div>
    );
  }

  // Normal mode
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      {/* Main Status Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-4">
          {/* Connection Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-semibold ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Active Broker Info */}
          {activeBroker && (
            <div className="flex items-center space-x-2 border-l border-gray-700 pl-4">
              <span className="text-xl">{getBrokerIcon(activeBroker.type)}</span>
              <div>
                <div className="text-white font-semibold text-sm">{activeBroker.name}</div>
                <div className="text-gray-400 text-xs">
                  {activeBroker.host}:{activeBroker.port}
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          {connected && totalAssets > 0 && (
            <div className="flex items-center space-x-4 border-l border-gray-700 pl-4">
              <div>
                <div className="text-gray-400 text-xs">Assets</div>
                <div className="text-white font-semibold text-sm">${formatCurrency(totalAssets)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Cash</div>
                <div className="text-white font-semibold text-sm">${formatCurrency(totalCash)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Broker Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={loading}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors disabled:opacity-50"
            >
              {activeBroker?.name || 'Select Broker'} ▼
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-lg shadow-xl border border-gray-700 z-50">
                <div className="py-2">
                  {brokers.map(broker => (
                    <button
                      key={broker.id}
                      onClick={() => handleSwitchBroker(broker.id)}
                      disabled={loading}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors ${
                        activeBrokerId === broker.id ? 'bg-gray-800 border-l-4 border-blue-500' : ''
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{getBrokerIcon(broker.type)}</span>
                        <div>
                          <div className="text-white font-medium text-sm">{broker.name}</div>
                          <div className="text-gray-400 text-xs">
                            {broker.host}:{broker.port} • {broker.type.toUpperCase()}
                          </div>
                        </div>
                        {activeBrokerId === broker.id && (
                          <span className="ml-auto text-blue-400 text-xs">Active</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Connect/Disconnect Button */}
          <button
            onClick={handleToggleConnection}
            disabled={loading || !activeBrokerId}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
              connected
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {loading ? '...' : connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Account Summary (when connected) */}
      {connected && accounts.length > 0 && (
        <div className="border-t border-gray-700 px-4 py-2 bg-gray-900">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-4">
              <span className="text-gray-400">
                {accounts.length} account{accounts.length > 1 ? 's' : ''}
              </span>
              {accounts.slice(0, 3).map(acc => (
                <span key={acc.accountId} className="text-gray-300">
                  {acc.name}: ${formatCurrency(acc.totalAssets)}
                </span>
              ))}
              {accounts.length > 3 && (
                <span className="text-gray-500">+{accounts.length - 3} more</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
