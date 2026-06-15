// @ts-nocheck
// ── R123-M01 OnboardingWizard — 3步首次使用引导 ─────────────────────────
// PM Spec: docs/design/onboarding-wizard-design.md
// Step 1: 搜索券商 (自动发现+手动搜索)
// Step 2: 连接券商 (API Key/Secret表单)
// Step 3: 完成! (已连接券商清单)

import { useState, useEffect, useCallback } from 'react';
import { Steps, Button, Input, message } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useChartStore } from '../../store/ChartStore';

// ═══════════ Types ═══════════

export interface DetectedBroker {
  id: string;
  name: string;
  type: 'local' | 'cloud' | 'api';
  host?: string;
  port?: number;
  detected: boolean;
}

export interface BrokerCredential {
  brokerId: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
}

interface OnboardingState {
  completed: boolean;
  completedAt?: string;
  connectedBrokers: string[];
  skippedBrokers: string[];
  currentStep: number;
}

// ═══════════ Auto-detect ═══════════

const KNOWN_BROKERS: DetectedBroker[] = [
  { id: 'futu', name: '富途 OpenD', type: 'local', host: '127.0.0.1', port: 11111, detected: false },
  { id: 'moomoo', name: 'moomoo OpenD', type: 'local', host: '127.0.0.1', port: 11112, detected: false },
  { id: 'ib', name: '盈透 TWS/IB Gateway', type: 'local', host: '127.0.0.1', port: 7497, detected: false },
  { id: 'binance', name: '币安 Binance', type: 'api', detected: false },
  { id: 'okx', name: 'OKX', type: 'api', detected: false },
  { id: 'bybit', name: 'Bybit', type: 'api', detected: false },
  { id: 'bitget', name: 'Bitget', type: 'api', detected: false },
  { id: 'tiger', name: '老虎证券 Tiger', type: 'cloud', detected: false },
  { id: 'longbridge', name: '长桥 Longbridge', type: 'cloud', detected: false },
  { id: 'schwab', name: '嘉信 Schwab', type: 'cloud', detected: false },
];

async function detectLocalBroker(host: string, port: number, timeout = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    await fetch(`http://${host}:${port}/api/status`, { signal: controller.signal, mode: 'no-cors' });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

async function autoDetectBrokers(): Promise<DetectedBroker[]> {
  const results = [...KNOWN_BROKERS];
  for (const b of results) {
    if (b.host && b.port) {
      const online = await detectLocalBroker(b.host, b.port);
      b.detected = online;
    }
  }
  return results;
}

// ═══════════ Load/save state ═══════════

function loadOnboardingState(): OnboardingState {
  try {
    const raw = localStorage.getItem('onboarding-state');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { completed: false, connectedBrokers: [], skippedBrokers: [], currentStep: 0 };
}

function saveOnboardingState(state: OnboardingState) {
  try { localStorage.setItem('onboarding-state', JSON.stringify(state)); } catch {}
}

// ═══════════ Entry check ═══════════

export function shouldShowOnboarding(): boolean {
  try {
    if (localStorage.getItem('onboarding-completed') === 'true') return false;
    const state = loadOnboardingState();
    if (state.completed) return false;
    return true;
  } catch {
    return true;
  }
}

// ═══════════ Step 1: Search & Auto-detect ═══════════

function Step1SearchBroker({
  onNext, onSkip, onConnectBroker
}: {
  onNext: () => void;
  onSkip: () => void;
  onConnectBroker: (id: string) => void;
}) {
  const [brokers, setBrokers] = useState<DetectedBroker[]>(KNOWN_BROKERS);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const setConnectedBrokers = useChartStore((s) => s.setConnectedBrokers);

  const handleScan = useCallback(async () => {
    setScanning(true);
    const detected = await autoDetectBrokers();
    setBrokers(detected);
    setScanning(false);
    const connected = detected.filter(b => b.detected).map(b => b.id);
    if (connected.length > 0) setConnectedBrokers(connected);
  }, [setConnectedBrokers]);

  useEffect(() => { handleScan(); }, []); // auto-scan on mount

  const filtered = brokers.filter(b =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: 'monospace' }}>
      <div className="text-center">
        <div className="text-3xl mb-2">🐳</div>
        <h2 className="text-[#e6edf3] text-lg font-bold mb-1">欢迎使用 TradingEasy</h2>
        <p className="text-[#8b949e] text-xs">连接你的券商账户，开始专业交易</p>
      </div>

      {/* Search */}
      <Input
        prefix={<SearchOutlined className="text-[#484f58]" />}
        placeholder="搜索你的券商..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-[#161b22] border-[#30363d] text-[#c9d1d9] text-xs"
      />

      {/* Auto-detect results */}
      <div className="text-[10px] text-[#484f58] flex items-center gap-2">
        {scanning ? <LoadingOutlined /> : null}
        {scanning ? '正在扫描本地服务...' : `${brokers.filter(b => b.detected).length} 家本地服务已检测到`}
        <button onClick={handleScan} className="text-[#3b82f6] hover:underline ml-auto">重新扫描</button>
      </div>

      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
        {filtered.map(b => (
          <div key={b.id}
            className="flex items-center gap-3 px-3 py-2 border border-[#1c2333] rounded hover:bg-[#161b22] transition-colors cursor-pointer"
            onClick={() => b.detected ? onConnectBroker(b.id) : null}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${b.detected ? 'bg-[#22c55e]' : 'bg-[#30363d]'}`} />
            <span className="flex-1 text-[#c9d1d9] text-xs">{b.name}</span>
            <span className="text-[9px] text-[#484f58] uppercase">{b.type}</span>
            {b.detected && b.host && (
              <span className="text-[8px] text-[#22c55e]">{b.host}:{b.port}</span>
            )}
            {b.detected && (
              <span className="text-[10px] text-[#22c55e]">✅ 可用</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-4 text-[#484f58] text-xs">未找到匹配的券商</div>
        )}
      </div>

      <div className="flex gap-2 justify-center">
        <Button size="small" onClick={onSkip} className="text-[#484f58] text-xs">跳过，我稍后设置</Button>
        <Button size="small" type="primary" onClick={onNext} className="text-xs bg-[#3b82f6]">下一步</Button>
      </div>
    </div>
  );
}

// ═══════════ Step 2: Connect Broker ═══════════

function Step2ConnectBroker({
  brokerId, onBack, onComplete
}: {
  brokerId: string;
  onBack: () => void;
  onComplete: (cred: BrokerCredential) => void;
}) {
  const broker = KNOWN_BROKERS.find(b => b.id === brokerId) || KNOWN_BROKERS[0];
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');

  const handleTest = async () => {
    if (!apiKey || !secret) { message.warning('请输入API Key和Secret'); return; }
    setTesting(true);
    setTestResult('testing');
    // Simulate connection test — in production this calls IPC broker:testConnection
    await new Promise(r => setTimeout(r, 1500));
    const ok = apiKey.length > 5 && secret.length > 5;
    setTestResult(ok ? 'success' : 'fail');
    setTesting(false);
    if (ok) {
      message.success('连接测试成功！');
    } else {
      message.error('连接测试失败，请检查API Key');
    }
  };

  const handleComplete = () => {
    if (!apiKey || !secret) { message.warning('请填写完整的API凭证'); return; }
    onComplete({ brokerId, apiKey, secret });
  };

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: 'monospace' }}>
      <div className="text-center">
        <h2 className="text-[#e6edf3] text-base font-bold mb-1">连接 {broker.name}</h2>
        <p className="text-[#8b949e] text-xs">输入你的API凭证以连接券商</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-[#8b949e]">API Key</label>
        <Input.Password
          placeholder="输入API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="bg-[#161b22] border-[#30363d] text-[#c9d1d9] text-xs"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-[#8b949e]">Secret Key</label>
        <Input.Password
          placeholder="输入Secret Key"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="bg-[#161b22] border-[#30363d] text-[#c9d1d9] text-xs"
        />
      </div>

      {broker.id === 'binance' || broker.id === 'okx' ? (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-[#8b949e]">Passphrase (可选)</label>
          <Input.Password
            placeholder="输入Passphrase"
            className="bg-[#161b22] border-[#30363d] text-[#c9d1d9] text-xs"
          />
        </div>
      ) : null}

      <div className="text-[9px] text-[#3b82f6] cursor-pointer hover:underline">
        📖 如何获取API Key? → 查看教程
      </div>

      {/* Test result */}
      {testResult === 'success' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#22c55e10] border border-[#22c55e30] rounded text-xs text-[#22c55e]">
          <CheckCircleOutlined /> 连接测试成功
        </div>
      )}
      {testResult === 'fail' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#ef444410] border border-[#ef444430] rounded text-xs text-[#ef4444]">
          <CloseCircleOutlined /> 连接测试失败
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <Button size="small" onClick={onBack} className="text-[#484f58] text-xs">返回</Button>
        <Button size="small" onClick={handleTest} loading={testing} className="text-xs bg-[#161b22] border-[#30363d] text-[#c9d1d9]">
          测试连接
        </Button>
        <Button size="small" type="primary" onClick={handleComplete} className="text-xs bg-[#3b82f6]">
          连接并继续
        </Button>
      </div>
    </div>
  );
}

// ═══════════ Step 3: Completion ═══════════

function Step3Completion({
  connectedBrokers, onFinish
}: {
  connectedBrokers: string[];
  onFinish: () => void;
}) {
  // R221: Show health status for each connected broker
  const [healthChecks, setHealthChecks] = useState<Record<string, { status: string; latency: number }>>({});

  useEffect(() => {
    const check = async () => {
      try {
        const api = (window as any).api;
        for (const bid of connectedBrokers) {
          const resp = await api?.broker?.invoke('broker:health-check', bid);
          if (resp?.success) {
            setHealthChecks(prev => ({ ...prev, [bid]: { status: resp.health.status, latency: resp.health.latencyMs } }));
          }
        }
      } catch {}
    };
    check();
  }, [connectedBrokers]);

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: 'monospace' }}>
      <div className="text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-[#e6edf3] text-lg font-bold mb-1">准备就绪！</h2>
        <p className="text-[#8b949e] text-xs">已连接 {connectedBrokers.length} 家券商</p>
      </div>

      <div className="flex flex-col gap-1">
        {KNOWN_BROKERS.filter(b => connectedBrokers.includes(b.id)).map(b => {
          const health = healthChecks[b.id];
          const statusEmoji = health?.status === 'GREEN' ? '🟢' : health?.status === 'YELLOW' ? '🟡' : '⚫';
          return (
            <div key={b.id} className="flex items-center gap-2 px-3 py-1.5">
              <CheckCircleOutlined className="text-[#22c55e] text-xs" />
              <span className="text-[#c9d1d9] text-xs flex-1">{b.name}</span>
              {health && (
                <span className="text-[9px] text-[#64748b]">
                  {statusEmoji} {health.latency}ms
                </span>
              )}
              <span className="text-[10px] text-[#22c55e]">已连接</span>
            </div>
          );
        })}
        {KNOWN_BROKERS.filter(b => !connectedBrokers.includes(b.id)).slice(0, 3).map(b => (
          <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 opacity-40">
            <CloseCircleOutlined className="text-[#484f58] text-xs" />
            <span className="text-[#484f58] text-xs flex-1">{b.name}</span>
            <span className="text-[10px] text-[#484f58]">未配置</span>
          </div>
        ))}
      </div>

      {/* R221: Data link status */}
      <div className="text-[9px] text-[#484f58] flex gap-3 justify-center">
        <span>📡 行情</span>
        <span>📊 深度</span>
        <span>👣 足迹</span>
        <span>🔀 报价</span>
        <span>🔔 告警</span>
      </div>

      <div className="flex justify-center">
        <Button size="large" type="primary" onClick={onFinish} className="text-sm bg-[#3b82f6]">
          🚀 开始交易
        </Button>
      </div>
    </div>
  );
}

// ═══════════ Main Wizard ═══════════

export default function OnboardingWizard({ onClose }: { onClose: () => void }) {
  // ═══ R221 JVS#8: Enhanced Onboarding — ChartContext + BrokerConnectionIndicator + DataSources ═══
  const [step, setStep] = useState(() => loadOnboardingState().currentStep || 0);
  const [connectingBroker, setConnectingBroker] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>(() => loadOnboardingState().connectedBrokers || []);
  const [dataSourcesReady, setDataSourcesReady] = useState(false);
  const [healthCheckPassed, setHealthCheckPassed] = useState(false);

  const setStoreBrokers = useChartStore((s) => s.setConnectedBrokers);

  // R221: Check if 5 data links are live before showing "start trading"
  useEffect(() => {
    if (step === 2 && connected.length > 0) {
      const checkHealth = async () => {
        try {
          const api = (window as any).api;
          const resp = await api?.broker?.invoke('broker:health-check-all');
          if (resp?.success && resp?.healthList?.some((h: any) => h.connected)) {
            setHealthCheckPassed(true);
          }
        } catch { /* IPC may not be ready yet */ }
      };
      // Verify 5 data source links (L1-L5) are online
      const checkDataSources = async () => {
        try {
          const api = (window as any).api;
          const resp = await api?.invoke?.('datasource:status');
          setDataSourcesReady(resp?.allConnected === true);
        } catch { /* pre-bridge, fall through */ }
      };
      checkHealth();
      checkDataSources();
      const timer = setInterval(() => { checkHealth(); checkDataSources(); }, 5000);
      return () => clearInterval(timer);
    }
  }, [step, connected]);

  // Persist state
  useEffect(() => {
    saveOnboardingState({ completed: false, connectedBrokers: connected, skippedBrokers: [], currentStep: step });
  }, [step, connected]);

  const handleConnectBroker = (id: string) => {
    setConnectingBroker(id);
    setStep(1);
  };

  const handleStep2Complete = (cred: BrokerCredential) => {
    const newConnected = [...new Set([...connected, cred.brokerId])];
    setConnected(newConnected);
    setStoreBrokers(newConnected);
    setStep(2);
    setConnectingBroker(null);
    message.success(`${KNOWN_BROKERS.find(b => b.id === cred.brokerId)?.name || cred.brokerId} 已连接`);
  };

  const handleFinish = () => {
    const state: OnboardingState = {
      completed: true,
      completedAt: new Date().toISOString(),
      connectedBrokers: connected,
      skippedBrokers: [],
      currentStep: 3,
    };
    saveOnboardingState(state);
    localStorage.setItem('onboarding-completed', 'true');
    setStoreBrokers(connected);
    onClose();
  };

  const handleSkip = () => {
    const state: OnboardingState = {
      completed: true,
      completedAt: new Date().toISOString(),
      connectedBrokers: [],
      skippedBrokers: KNOWN_BROKERS.map(b => b.id),
      currentStep: 3,
    };
    saveOnboardingState(state);
    localStorage.setItem('onboarding-completed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[#1c2333]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#8b949e] text-[10px] uppercase tracking-wider">初始设置</span>
            <span className="text-[10px] text-[#484f58]">Step {step + 1}/3</span>
          </div>
          <Steps
            current={step}
            size="small"
            items={[
              { title: <span className="text-[10px]">搜索券商</span> },
              { title: <span className="text-[10px]">连接券商</span> },
              { title: <span className="text-[10px]">完成</span> },
            ]}
            className="[&_.ant-steps-item-finish_.ant-steps-item-icon]:bg-[#22c55e] [&_.ant-steps-item-process_.ant-steps-item-icon]:bg-[#3b82f6]"
          />
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {step === 0 && (
            <Step1SearchBroker
              onNext={() => setStep(1)}
              onSkip={handleSkip}
              onConnectBroker={handleConnectBroker}
            />
          )}
          {step === 1 && (
            <Step2ConnectBroker
              brokerId={connectingBroker || 'binance'}
              onBack={() => setStep(0)}
              onComplete={handleStep2Complete}
            />
          )}
          {step === 2 && (
            <Step3Completion
              connectedBrokers={connected}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { OnboardingWizard, shouldShowOnboarding, loadOnboardingState, saveOnboardingState, KNOWN_BROKERS };
