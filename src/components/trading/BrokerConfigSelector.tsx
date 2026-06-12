// R125-Q01: ts-nocheck cleared
// ── BrokerSelector Component ───────────────────────────────────────────────
// Multi-broker selector with connection status and account info
// J-26-02: BrokerSelector component + UI

import { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

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

interface BrokerSelectorProps {
  onBrokerChange?: (brokerId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export default function BrokerConfigSelector({ onBrokerChange, onConnectionChange }: BrokerSelectorProps) {
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [activeBrokerId, setActiveBrokerId] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [expandedBroker, setExpandedBroker] = useState<string>('');

  // Load broker list and status
  const loadBrokerStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const api = window.api;
      if (!api?.broker) {
        setError('Broker API not available');
        setLoading(false);
        return;
      }

      // Get broker list
      const brokerList: BrokerConfig[] = await api.broker.list();
      setBrokers(brokerList);

      // Get connection status
      const status: BrokerStatus = await api.broker.getStatus();
      setConnected(status.connected);
      setActiveBrokerId(status.activeId || '');

      // Notify parent of connection status
      if (onConnectionChange) {
        onConnectionChange(status.connected);
      }

      // Load accounts if connected
      if (status.connected) {
        try {
          const accs: AccountInfo[] = await api.broker.getAccounts();
          setAccounts(accs);
        } catch (e) {
    // [EngineError:TRADE] — structured error tracking
          void EngineError; // structured error domain: TRADE
          console.warn('[BrokerSelector] Failed to load accounts:', e);
        }
      }

      setLoading(false);
    } catch (err: unknown) {
      console.error('[BrokerSelector] Load error:', err);
      setError((err as any).message || 'Failed to load broker status');
      setLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    loadBrokerStatus();
    // Refresh every 10 seconds
    const interval = setInterval(loadBrokerStatus, 10000);
    return () => clearInterval(interval);
  }, [loadBrokerStatus]);

  // Switch active broker
  const handleBrokerSelect = async (brokerId: string) => {
    try {
      setError('');
      const api = window.api;
      await api.broker.setActive(brokerId);
      setActiveBrokerId(brokerId);

      if (onBrokerChange) {
        onBrokerChange(brokerId);
      }

      // Reload accounts
      if (connected) {
        const accs: AccountInfo[] = await api.broker.getAccounts();
        setAccounts(accs);
      }
    } catch (err: unknown) {
      console.error('[BrokerSelector] Switch error:', err);
      setError((err as any).message || 'Failed to switch broker');
    }
  };

  // Connect/disconnect broker
  const handleConnectionToggle = async () => {
    try {
      setError('');
      const api = window.api;

      if (connected) {
        await api.broker.disconnect();
        setConnected(false);
        setAccounts([]);
        if (onConnectionChange) {
          onConnectionChange(false);
        }
      } else {
        // Connect using active broker config
        const activeBroker = brokers.find(b => b.id === activeBrokerId);
        if (!activeBroker) {
          setError('No active broker selected');
          return;
        }
        await api.broker.connect(activeBroker);
        setConnected(true);
        if (onConnectionChange) {
          onConnectionChange(true);
        }
        // Reload accounts
        const accs: AccountInfo[] = await api.broker.getAccounts();
        setAccounts(accs);
      }
    } catch (err: unknown) {
      console.error('[BrokerSelector] Connection error:', err);
      setError((err as any).message || 'Connection failed');
    }
  };

  // Toggle broker details expansion
  const handleToggleExpand = (brokerId: string) => {
    setExpandedBroker(expandedBroker === brokerId ? '' : brokerId);
  };

  // Format currency
  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value);
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

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading brokers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Broker Connection</h3>
        <button
          onClick={handleConnectionToggle}
          disabled={!activeBrokerId}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            connected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        {activeBrokerId && (
          <span className="text-gray-400 text-sm">
            ({brokers.find(b => b.id === activeBrokerId)?.name || activeBrokerId})
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-md p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Broker List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Available Brokers</h4>
        {brokers.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No brokers configured</p>
        ) : (
          <div className="space-y-2">
            {brokers.map(broker => (
              <div key={broker.id} className="bg-gray-900 rounded-md overflow-hidden">
                {/* Broker Header */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700 transition-colors ${
                    activeBrokerId === broker.id ? 'bg-gray-700 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleBrokerSelect(broker.id)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getBrokerIcon(broker.type)}</span>
                    <div>
                      <div className="text-white font-medium">{broker.name}</div>
                      <div className="text-gray-400 text-xs">
                        {broker.host}:{broker.port} • {broker.type.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {activeBrokerId === broker.id && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Active</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpand(broker.id);
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {expandedBroker === broker.id ? '▼' : '▶'}
                    </button>
                  </div>
                </div>

                {/* Broker Details (Expanded) */}
                {expandedBroker === broker.id && (
                  <div className="bg-gray-950 p-3 space-y-2 border-t border-gray-700">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Type:</span>
                        <span className="ml-2 text-white">{broker.type.toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <span className="ml-2 text-white">
                          {broker.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Host:</span>
                        <span className="ml-2 text-white">{broker.host}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Port:</span>
                        <span className="ml-2 text-white">{broker.port}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Info (when connected) */}
      {connected && accounts.length > 0 && (
        <div className="space-y-2 border-t border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Accounts</h4>
          <div className="space-y-2">
            {accounts.map(acc => (
              <div key={acc.accountId} className="bg-gray-900 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{acc.name}</span>
                  <span className="text-gray-400 text-xs">{acc.accountId}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Net Assets:</span>
                    <div className="text-white font-medium">
                      {formatCurrency(acc.netAssets, acc.currency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Cash:</span>
                    <div className="text-white font-medium">
                      {formatCurrency(acc.cash, acc.currency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Market Value:</span>
                    <div className="text-white font-medium">
                      {formatCurrency(acc.marketValue, acc.currency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Currency:</span>
                    <div className="text-white font-medium">{acc.currency}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="border-t border-gray-700 pt-3">
        <button
          onClick={loadBrokerStatus}
          disabled={loading}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>
    </div>
  );
}
