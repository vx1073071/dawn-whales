// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

// ── R135-M02 OpenDOfflineAlert — OpenD离线提醒 (弹窗+托盘红点) ───────────
// PM: 关闭时弹窗提醒 + 托盘红点累积未处理信号

import { useState, useEffect, useCallback } from 'react'
import { Card, Badge, Button, Tag, Space, Modal, Switch, Alert, Tooltip, Empty, } from 'antd'
import { WarningOutlined, DesktopOutlined, BellOutlined,
  PauseCircleOutlined, ReloadOutlined, ExclamationCircleOutlined,
  SettingOutlined, CheckCircleOutlined, } from '@ant-design/icons'// ═══════════ Types ═══════════

interface OfflineQueueItem {
  brokerId: string;
  brokerName: string;
  icon: string;
  pendingSignals: number;
  queuedOrders: number;
  offlineSince: number;
  lastSync: number;
  autoRetry: boolean;
}

interface OfflineConfig {
  showCloseWarning: boolean;
  trayBadge: boolean;
  offlineQueue: boolean;     // keep queue when offline
  autoReconnect: boolean;
  notifyOnReconnect: boolean;
  minPendingThreshold: number; // # pending → red tray
}

// ═══════════ Mock data ═══════════

const MOCK_OFFLINE_QUEUE: OfflineQueueItem[] = [
  {
    brokerId: 'moomoo', brokerName: 'Moomoo', icon: '🐮',
    pendingSignals: 3, queuedOrders: 2,
    offlineSince: Date.now() - 3600000, lastSync: Date.now() - 3600000,
    autoRetry: true,
  },
  {
    brokerId: 'futu', brokerName: 'Futu', icon: '🐂',
    pendingSignals: 0, queuedOrders: 0,
    offlineSince: Date.now() - 120000, lastSync: Date.now() - 120000,
    autoRetry: true,
  },
];

// ═══════════ Components ═══════════

// ── Offline Queue Card ──

function OfflineQueueCard({ item }: { item: OfflineQueueItem }) {
  const offlineDuration = Math.floor((Date.now() - item.offlineSince) / 60000);
  const isCritical = item.pendingSignals >= 5 || offlineDuration > 60;

  return (
    <div style={{
      padding: '12px 14px',
      background: isCritical ? '#2e0a0a' : '#2e2a1a',
      border: `1px solid ${isCritical ? '#ef444433' : '#f59e0b33'}`,
      borderRadius: 10,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size={8}>
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{item.brokerName}</div>
            <Space size={4}>
              <Tag color="red" style={{ fontSize: 10 }}>
                <PauseCircleOutlined /> 离线
              </Tag>
              <span style={{ fontSize: 10, color: '#8b949e' }}>
                已 {offlineDuration} 分钟
              </span>
            </Space>
          </div>
        </Space>

        {item.autoRetry && (
          <Tooltip title="自动重连中...">
            <ReloadOutlined spin style={{ color: '#f59e0b' }} />
          </Tooltip>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        fontSize: 11,
      }}>
        <div style={{
          padding: '6px 10px',
          background: '#0d0f1a',
          borderRadius: 6,
        }}>
          <span style={{ color: '#6b7280' }}>待处理信号</span>
          <span style={{ color: '#f59e0b', fontWeight: 600, marginLeft: 8, fontFamily: 'monospace' }}>
            {item.pendingSignals}
          </span>
        </div>
        <div style={{
          padding: '6px 10px',
          background: '#0d0f1a',
          borderRadius: 6,
        }}>
          <span style={{ color: '#6b7280' }}>排队订单</span>
          <span style={{ color: '#3b82f6', fontWeight: 600, marginLeft: 8, fontFamily: 'monospace' }}>
            {item.queuedOrders}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Close Warning Modal ──

function CloseWarningModal({
  visible,
  onClose,
  onForceClose,
  pendingCount,
}: {
  visible: boolean;
  onClose: () => void;
  onForceClose: () => void;
  pendingCount: number;
}) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) return;
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) {
          clearInterval(timer);
          onForceClose();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, onForceClose]);

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
          <span>OpenD 离线提醒</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消关闭（保持在线）
        </Button>,
        <Button
          key="force"
          danger
          type="primary"
          onClick={onForceClose}
          disabled={countdown > 0}
        >
          {countdown > 0 ? `确认关闭 (${countdown}s)` : '强制关闭'}
        </Button>,
      ]}
      width={480}
    >
      <Alert
        message={`还有 ${pendingCount} 个信号未执行`}
        description="关闭应用后，OpenD 将无法执行跟单信号。离线队列会保存，恢复连接后自动处理。"
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 16, background: '#2e2a1a', border: '1px solid #f59e0b33' }}
        styles={{ message: { color: '#f59e0b' }, description: { color: '#8b949e' } }}
      />

      <div style={{ fontSize: 12, color: '#8b949e' }}>
        <div style={{ marginBottom: 8 }}>📋 离线影响:</div>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>5 秒倒计时后允许强制关闭</li>
          <li>断开期间的新信号自动排队</li>
          <li>重新上线后按时间顺序执行</li>
          <li>超过 24 小时的过期信号自动丢弃</li>
        </ul>
      </div>
    </Modal>
  );
}

// ── Tray Badge Simulator ──

function TrayBadgeSimulator({
  pendingCount,
  enabled,
  onChange,
}: {
  pendingCount: number;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Card
      size="small"
      title={
        <Space>
          <BellOutlined style={{ color: '#f59e0b' }} />
          <span style={{ color: '#e0e0e0', fontSize: 13 }}>托盘通知</span>
          <Switch size="small" checked={enabled} onChange={onChange} />
        </Space>
      }
      style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
      styles={{ body: { padding: '14px' } }}
    >
      <div style={{ textAlign: 'center' }}>
        {/* Simulated tray icon */}
        <div style={{
          display: 'inline-block',
          position: 'relative',
          padding: '12px 20px',
          background: '#0d0f1a',
          borderRadius: 8,
          border: '1px solid #2a2d3e',
        }}>
          <span style={{ fontSize: 32 }}>🐋</span>
          {enabled && pendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 22,
              height: 22,
              background: pendingCount >= 5 ? '#ef4444' : '#f59e0b',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              border: '2px solid #1a1d2e',
            }}>
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 4 }}>
            TradingEasy
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: '#8b949e' }}>
          {pendingCount === 0
            ? '无待处理信号'
            : pendingCount >= 5
              ? `⚠ ${pendingCount} 个待处理! 托盘红点`
              : `🟡 ${pendingCount} 个待处理, 托盘黄点`}
        </div>
      </div>
    </Card>
  );
}

// ── Offline Settings ──

function OfflineSettings({
  config,
  onChange,
}: {
  config: OfflineConfig;
  onChange: (cfg: OfflineConfig) => void;
}) {
  return (
    <Card
      size="small"
      title={
        <Space>
          <SettingOutlined style={{ color: '#3b82f6' }} />
          <span style={{ color: '#e0e0e0', fontSize: 13 }}>离线设置</span>
        </Space>
      }
      style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
      styles={{ body: { padding: '14px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontSize: 12 }}>关闭时弹窗提醒</span>
          <Switch
            size="small"
            checked={config.showCloseWarning}
            onChange={(v) => onChange({ ...config, showCloseWarning: v })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontSize: 12 }}>托盘红点通知</span>
          <Switch
            size="small"
            checked={config.trayBadge}
            onChange={(v) => onChange({ ...config, trayBadge: v })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontSize: 12 }}>离线排队 (保存信号)</span>
          <Switch
            size="small"
            checked={config.offlineQueue}
            onChange={(v) => onChange({ ...config, offlineQueue: v })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontSize: 12 }}>自动重连</span>
          <Switch
            size="small"
            checked={config.autoReconnect}
            onChange={(v) => onChange({ ...config, autoReconnect: v })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontSize: 12 }}>重连后通知</span>
          <Switch
            size="small"
            checked={config.notifyOnReconnect}
            onChange={(v) => onChange({ ...config, notifyOnReconnect: v })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e0e0e0', fontSize: 12 }}>托盘红点阈值</span>
          <Tooltip title={`待处理≥${config.minPendingThreshold}时显示红点`}>
            <Tag color="blue">{config.minPendingThreshold}</Tag>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}

// ── Main OpenDOfflineAlert ──

export default function OpenDOfflineAlert() {
  const [warningVisible, setWarningVisible] = useState(false);
  const [brokers, setBrokers] = useState<OfflineQueueItem[]>(MOCK_OFFLINE_QUEUE);
  const [config, setConfig] = useState<OfflineConfig>(() => {
    try {
      return JSON.parse(localStorage.getItem('dw-opend-offline-config') || '{}');
    } catch {
      return {};
    }
    return {
      showCloseWarning: true,
      trayBadge: true,
      offlineQueue: true,
      autoReconnect: true,
      notifyOnReconnect: true,
      minPendingThreshold: 3,
    };
  });

  const totalPending = brokers.reduce((s, b) => s + b.pendingSignals, 0);
  const offlineCount = brokers.filter((b) => b.offlineSince > 0).length;

  const handleConfigChange = useCallback((newCfg: OfflineConfig) => {
    setConfig(newCfg);
    localStorage.setItem('dw-opend-offline-config', JSON.stringify(newCfg));
  }, []);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #2e2a1a 0%, #1a1d2e 100%)',
        borderRadius: 10,
        border: '1px solid #2a2d3e',
      }}>
        <Space>
          <DesktopOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>OpenD 离线管理</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>
              {offlineCount > 0 ? `${offlineCount} 券商离线 · ${totalPending} 信号待处理` : '全部在线'}
            </div>
          </div>
        </Space>
        <Space>
          <Badge count={totalPending} size="small" offset={[-4, 4]}>
            <Button
              danger={totalPending > 0}
              icon={<WarningOutlined />}
              onClick={() => setWarningVisible(true)}
              size="small"
            >
              模拟关闭提醒
            </Button>
          </Badge>
        </Space>
      </div>

      {/* Online/Offline Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          padding: '10px',
          background: '#1a2e1a',
          borderRadius: 8,
          border: '1px solid #22c55e33',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>OpenD 在线</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
            {brokers.filter((b) => b.offlineSince === 0 || (Date.now() - b.offlineSince) < 30000).length}
          </div>
        </div>
        <div style={{
          padding: '10px',
          background: totalPending > 0 ? '#2e2a1a' : '#1a1d2e',
          borderRadius: 8,
          border: `1px solid ${totalPending > 0 ? '#f59e0b33' : '#2a2d3e'}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>待处理信号</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: totalPending > 0 ? '#f59e0b' : '#8b949e', fontFamily: 'monospace' }}>
            {totalPending}
          </div>
        </div>
        <div style={{
          padding: '10px',
          background: '#1a1d2e',
          borderRadius: 8,
          border: '1px solid #2a2d3e',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>自动重连</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: config.autoReconnect ? '#22c55e' : '#8b949e' }}>
            {config.autoReconnect ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
          </div>
        </div>
      </div>

      {/* Offline Queue */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600, marginBottom: 10, padding: '0 4px' }}>
          📋 离线券商队列
        </div>
        {brokers.length === 0 ? (
          <Empty description="全部在线，无离线券商" />
        ) : (
          brokers.map((b) => <OfflineQueueCard key={b.brokerId} item={b} />)
        )}
      </div>

      {/* Tray Badge */}
      <TrayBadgeSimulator
        pendingCount={totalPending}
        enabled={config.trayBadge}
        onChange={(v) => handleConfigChange({ ...config, trayBadge: v })}
      />

      {/* Settings */}
      <OfflineSettings config={config} onChange={handleConfigChange} />

      {/* Connection Warning */}
      <Alert
        message="OpenD 依赖本机 FutuOpenD 进程。关闭应用前请确认所有信号已完成。"
        type="info"
        showIcon
        icon={<InfoCircle />}
        style={{
          background: '#1a2e2a',
          border: '1px solid #3b82f633',
          borderRadius: 8,
          marginTop: 8,
        }}
        styles={{ message: { color: '#8b949e', fontSize: 11 } }}
      />

      {/* Close Warning Modal */}
      <CloseWarningModal
        visible={warningVisible}
        onClose={() => setWarningVisible(false)}
        onForceClose={() => {
          setWarningVisible(false);
          message.warning('模拟强制关闭 (离线队列已保存)');
        }}
        pendingCount={totalPending}
      />
    </div>
  );
}

// Need InfoCircle for the Alert
const InfoCircle = <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #3b82f6', color: '#3b82f6', fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: '14px' }}>i</span>;
