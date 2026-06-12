// ── DAWN WHALES — Server Connection Status (R129 M-02) ──────────────────
// Displays connection status to the cloud server for dual-mode copy trading.

import { useState, useEffect, useCallback } from 'react';
import i18n from '../../i18n';

interface ServerStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastHeartbeat: number | null;
  lastError: string | null;
  tokenExpiry: number | null;
}

// ── Bridge API (window.api.server) ──────────────────────────────────────

async function getServerStatus(): Promise<ServerStatus> {
  if (typeof window !== 'undefined' && (window as any).api?.server?.getStatus) {
    return (window as any).api.server.getStatus();
  }
  return { state: 'disconnected', lastHeartbeat: null, lastError: null, tokenExpiry: null };
}

async function connectServer(url: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  return (window as any).api?.server?.connect(url, apiKey) ?? { success: false, error: 'client.notAvailable' };
}

async function disconnectServer(): Promise<void> {
  (window as any).api?.server?.disconnect?.();
}

async function testConnection(url: string, apiKey: string): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  return (window as any).api?.server?.testConnection(url, apiKey) ?? { ok: false, error: 'client.notAvailable' };
}

async function getApiKey(): Promise<{ hasKey: boolean; preview: string }> {
  return (window as any).api?.server?.getApiKey() ?? { hasKey: false, preview: '' };
}

async function saveApiKey(key: string): Promise<{ success: boolean }> {
  return (window as any).api?.server?.saveApiKey(key) ?? { success: false };
}

async function deleteApiKey(): Promise<{ success: boolean }> {
  return (window as any).api?.server?.deleteApiKey() ?? { success: false };
}

// ─── UI Component ──────────────────────────────────────────────────────────

export default function ServerConnectionStatus() {
  const [status, setStatus] = useState<ServerStatus>({
    state: 'disconnected',
    lastHeartbeat: null,
    lastError: null,
    tokenExpiry: null,
  });
  const [serverUrl, setServerUrl] = useState('https://api.dawnwhales.com');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // ── Load saved state ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const s = await getServerStatus();
      setStatus(s);
      const key = await getApiKey();
      setHasKey(key.hasKey);
      setKeyPreview(key.preview);
    })();

    // Listen for status push updates
    if (typeof window !== 'undefined' && (window as any).api?.server?.subscribeStatus) {
      (window as any).api.server.subscribeStatus();
      const handler = (_event: any, s: ServerStatus) => setStatus(s);
      (window as any).electron?.ipcRenderer?.on?.('server:statusUpdate', handler);
      return () => {
        (window as any).electron?.ipcRenderer?.removeListener?.('server:statusUpdate', handler);
        (window as any).api?.server?.unsubscribeStatus?.();
      };
    }
  }, []);

  // ── Poll status every 5s ────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(async () => {
      const s = await getServerStatus();
      setStatus(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(s)) return s;
        return prev;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setTestResult(null);
    try {
      const result = await connectServer(serverUrl, apiKey);
      if (result.success) {
        const s = await getServerStatus();
        setStatus(s);
      } else {
        setTestResult(`❌ ${result.error || i18n.t('client.connectionFailed')}`);
      }
    } catch (e: unknown) {
      setTestResult(`❌ ${e instanceof Error ? e.message : i18n.t('client.connectionError')}`);
    } finally {
      setConnecting(false);
    }
  }, [serverUrl, apiKey]);

  const handleDisconnect = useCallback(async () => {
    await disconnectServer();
    const s = await getServerStatus();
    setStatus(s);
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(serverUrl, apiKey);
      if (result.ok) {
        setTestResult(`✅ ${i18n.t('client.connectionOk')} (${result.latencyMs}ms)`);
      } else {
        setTestResult(`❌ ${result.error || i18n.t('client.connectionFailed')}`);
      }
    } catch (e: unknown) {
      setTestResult(`❌ ${e instanceof Error ? e.message : i18n.t('client.connectionError')}`);
    } finally {
      setTesting(false);
    }
  }, [serverUrl, apiKey]);

  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim()) return;
    const result = await saveApiKey(apiKey);
    if (result.success) {
      setHasKey(true);
      setKeyPreview('*'.repeat(Math.min(apiKey.length, 16)));
      setTestResult('✅ API Key saved securely');
    }
  }, [apiKey]);

  const handleDeleteKey = useCallback(async () => {
    await deleteApiKey();
    setHasKey(false);
    setKeyPreview('');
    setApiKey('');
    setTestResult('API Key deleted');
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    connected: 'bg-emerald-400',
    connecting: 'bg-yellow-400',
    error: 'bg-red-400',
    disconnected: 'bg-gray-500',
  };
  const statusLabel: Record<string, string> = {
    connected: i18n.t('client.connected'),
    connecting: i18n.t('client.connecting'),
    error: i18n.t('client.error'),
    disconnected: i18n.t('client.disconnected'),
  };

  const formatTime = (ts: number | null): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  const formatExpiry = (ts: number | null): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    const remaining = ts - Date.now();
    if (remaining <= 0) return i18n.t('client.expired');
    const mins = Math.floor(remaining / 60000);
    return `${d.toLocaleTimeString()} (${mins}m left)`;
  };

  return (
    <div>
      {/* ── Status Indicator ─────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-3 mb-4">
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${statusColor[status.state]}`} />
          {status.state === 'connected' && (
            <div className={`absolute inset-0 w-3 h-3 rounded-full ${statusColor[status.state]} animate-ping opacity-40`} />
          )}
        </div>
        <div className="flex-1">
          <span className="text-white text-sm font-medium">{statusLabel[status.state]}</span>
          {status.lastError && status.state === 'error' && (
            <p className="text-red-400 text-xs mt-0.5">{status.lastError}</p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{i18n.t('client.lastHeartbeat')}: {formatTime(status.lastHeartbeat)}</div>
          <div>{i18n.t('client.tokenExpiry')}: {formatExpiry(status.tokenExpiry)}</div>
        </div>
      </div>

      {/* ── Server URL ──────────────────────────────────────── */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-gray-400 text-xs mb-1">{i18n.t('client.serverUrl')}</label>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://api.dawnwhales.com"
            className="w-full bg-[#12121a] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50"
          />
        </div>

        {/* ── API Key ──────────────────────────────────────── */}
        <div>
          <label className="block text-gray-400 text-xs mb-1">{i18n.t('client.apiKey')}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder={hasKey ? keyPreview : 'sk-...'}
                className="w-full bg-[#12121a] border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#C9A046]/50"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                title={showKey ? i18n.t('client.hideKey') : i18n.t('client.showKey')}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim()}
              className="px-3 py-2 rounded-lg bg-[#C9A046]/20 text-[#C9A046] text-sm hover:bg-[#C9A046]/30 disabled:opacity-30 transition-colors"
            >
              {i18n.t('components.save')}
            </button>
            {hasKey && (
              <button
                onClick={handleDeleteKey}
                className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* ── Action Buttons ───────────────────────────────── */}
        <div className="flex gap-3">
          {status.state !== 'connected' ? (
            <button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="px-4 py-2 rounded-lg bg-[#C9A046] text-black text-sm font-medium hover:bg-[#D4A853] disabled:opacity-40 transition-colors"
            >
              {connecting ? i18n.t('client.connecting') : i18n.t('client.connect')}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              {i18n.t('client.disconnect')}
            </button>
          )}
          <button
            onClick={handleTestConnection}
            disabled={testing || !apiKey.trim()}
            className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            {testing ? i18n.t('client.testing') : i18n.t('client.testConnection')}
          </button>
        </div>

        {/* ── Test Result ──────────────────────────────────── */}
        {testResult && (
          <p className={`text-xs ${testResult.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
            {testResult}
          </p>
        )}
      </div>
    </div>
  );
}
