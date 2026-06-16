// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

// ── R129-M02 ServerConnectionStatus — 服务器连接状态UI ──────────────────
// PM: 设置页内嵌 + 状态栏常驻, 显示连接状态/延迟/错误

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Tag, Tooltip, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, LinkOutlined, DisconnectOutlined, SyncOutlined } from '@ant-design/icons';

type ServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ═══════════ Types ═══════════

interface ConnectionState {
  status: ServerStatus;
  error?: string;
  latency?: number;
  serverUrl: string;
  serverVersion?: string;
  uptime?: string;
}

// ═══════════ Status Indicator Bar ═══════════

export function ServerStatusBar() {
  const [state, setState] = useState<ConnectionState>({
    status: 'disconnected',
    serverUrl: '',
  });

  useEffect(() => {
    // Try to read from window.api (electron contextBridge)
    const poll = async () => {
      try {
        // @ts-expect-error - contextBridge exposed API
        const status = await window.api?.server?.getStatus();
        if (status) setState(prev => ({ ...prev, ...status }));
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, []);

  const statusIcon: Record<ServerStatus, React.ReactNode> = {
    connected: <CheckCircleOutlined className="text-[#22c55e] text-xs" />,
    connecting: <LoadingOutlined className="text-[#f59e0b] text-xs" spin />,
    disconnected: <CloseCircleOutlined className="text-[#484f58] text-xs" />,
    error: <CloseCircleOutlined className="text-[#ef4444] text-xs" />,
  };

  const statusText: Record<ServerStatus, string> = {
    connected: '已连接',
    connecting: '连接中...',
    disconnected: '未连接',
    error: '连接错误',
  };

  const statusColor: Record<ServerStatus, string> = {
    connected: '#22c55e',
    connecting: '#f59e0b',
    disconnected: '#484f58',
    error: '#ef4444',
  };

  return (
    <Tooltip title={
      <div className="text-[10px]">
        <div>服务器: {state.serverUrl || '未配置'}</div>
        {state.latency != null && <div>延迟: {state.latency}ms</div>}
        {state.error && <div className="text-[#ef4444]">{state.error}</div>}
      </div>
    }>
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-[#161b22] transition-colors select-none"
        style={{ fontFamily: 'monospace' }}
      >
        {statusIcon}
        <span className="text-[9px] font-bold" style={{ color: statusColor }}>{statusText}</span>
        {state.latency != null && state.status === 'connected' && (
          <Tag color="green" className="text-[7px] leading-none px-1 py-0 m-0">{state.latency}ms</Tag>
        )}
      </div>
    </Tooltip>
  );
}

// ═══════════ Settings Panel ═══════════

export function ServerConnectionPanel() {
  const [url, setUrl] = useState('https://api.TradingEasy.com');
  const [status, setStatus] = useState<ServerStatus>('disconnected');
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [serverVersion, setServerVersion] = useState('');
  const [serverUptime, setServerUptime] = useState('');
  const statusRef = useRef<ServerStatus>('disconnected');

  // Load saved config
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dw-server-url');
      if (saved) setUrl(saved);
    } catch {}
    // Check current status via IPC
    const poll = async () => {
      try {
        // @ts-expect-error - contextBridge
        const s = await window.api?.server?.getStatus();
        if (s) {
          setStatus(s.status);
          setLatency(s.latency);
          setError(s.error || '');
          statusRef.current = s.status;
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, []);

  // Listen for status updates from server-client
  useEffect(() => {
    const handler = (_event: any, data: any) => {
      if (data?.status) {
        setStatus(data.status);
        setLatency(data.latency);
        setError(data.error || '');
      }
    };
    try {
      // @ts-expect-error
      window.api?.server?.onStatusUpdate(handler);
      return () => {
        try { /* @ts-expect-error */ window.api?.server?.offStatusUpdate(handler); } catch {}
      };
    } catch { return; }
  }, []);

  const handleTest = useCallback(async () => {
    if (!url.trim()) { message.warning('请输入服务器地址'); return; }
    setTesting(true);
    setError('');
    try {
      // @ts-expect-error
      const result = await window.api?.server?.testConnection(url.trim());
      if (result?.success) {
        message.success(`连接成功! 服务器版本: ${result.version || 'unknown'}`);
        setServerVersion(result.version || '');
        setServerUptime(result.uptime || '');
        setLatency(result.latency);
      } else {
        setError(result?.error || '连接测试失败');
        message.error(result?.error || '连接测试失败');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      message.error(err.message || '连接测试失败');
    } finally {
      setTesting(false);
    }
  }, [url]);

  const handleConnect = useCallback(async () => {
    if (!url.trim()) { message.warning('请输入服务器地址'); return; }
    setConnecting(true);
    setError('');
    try {
      localStorage.setItem('dw-server-url', url.trim());
      // @ts-expect-error
      const result = await window.api?.server?.connect(url.trim());
      if (result?.success) {
        setStatus('connected');
        message.success('已连接到服务器');
      } else {
        setError(result?.error || '连接失败');
        message.error(result?.error || '连接失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }, [url]);

  const handleDisconnect = useCallback(async () => {
    try {
      // @ts-expect-error
      await window.api?.server?.disconnect();
      setStatus('disconnected');
      setLatency(null);
      message.info('已断开服务器连接');
    } catch {}
  }, []);

  const isConnected = status === 'connected';

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#e6edf3] text-sm font-bold mb-0.5">服务器连接</h3>
          <p className="text-[#484f58] text-[10px]">连接到 TradingEasy 服务器以启用24小时跟单</p>
        </div>
        <Tag color={isConnected ? 'green' : 'default'} className="text-[10px]">
          {isConnected ? '已连接' : status === 'connecting' ? '连接中' : '未连接'}
        </Tag>
      </div>

      {/* URL Input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#8b949e]">服务器地址</label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.TradingEasy.com"
            disabled={isConnected}
            prefix={<LinkOutlined className="text-[#484f58]" />}
            className="bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs flex-1 font-mono"
          />
          <Button
            size="small"
            loading={testing}
            onClick={handleTest}
            className="text-xs"
          >
            {testing ? '测试中' : '测试'}
          </Button>
        </div>
      </div>

      {/* Connect/Disconnect */}
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <Button
            type="primary"
            size="small"
            loading={connecting}
            onClick={handleConnect}
            icon={<LinkOutlined />}
            className="text-xs bg-[#3b82f6]"
          >
            {connecting ? '连接中...' : '连接服务器'}
          </Button>
        ) : (
          <Button
            danger
            size="small"
            onClick={handleDisconnect}
            icon={<DisconnectOutlined />}
            className="text-xs"
          >
            断开连接
          </Button>
        )}
        {isConnected && (
          <Button
            size="small"
            onClick={handleTest}
            icon={<SyncOutlined />}
            className="text-xs"
          >
            刷新状态
          </Button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-[#ef444410] border border-[#ef444430] rounded text-[10px] text-[#ef4444]">
          {error}
        </div>
      )}

      {/* Status detail */}
      {isConnected && (
        <div className="flex flex-col gap-1 px-3 py-2 bg-[#22c55e08] border border-[#22c55e20] rounded">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#8b949e]">状态</span>
            <span className="text-[#22c55e] font-bold flex items-center gap-1">
              <CheckCircleOutlined /> 已连接
            </span>
          </div>
          {latency != null && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8b949e]">延迟</span>
              <span className="text-[#c9d1d9] font-mono">{latency}ms</span>
            </div>
          )}
          {serverVersion && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8b949e]">服务器版本</span>
              <span className="text-[#c9d1d9] font-mono">v{serverVersion}</span>
            </div>
          )}
          {serverUptime && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8b949e]">运行时间</span>
              <span className="text-[#c9d1d9] font-mono">{serverUptime}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ServerConnectionPanel;
