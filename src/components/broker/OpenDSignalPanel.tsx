// @ts-nocheck
// ── R135-M01 OpenDSignalPanel — OpenD信号面板 (待处理+执行) ───────────────
// PM: GET /api/signal/pending → 列表 → 单个or批量执行 → POST回传

import { useState, useCallback, useEffect } from 'react';
import {
  Card, Button, Tag, Space, Badge, Table, Modal, Progress,
  Tooltip, Empty, message, Checkbox, Statistic, Alert,
} from 'antd';
import {
  ThunderboltOutlined, SyncOutlined, CheckCircleOutlined,
  CloseCircleOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ReloadOutlined, ApiOutlined, ArrowRightOutlined,
  CloudServerOutlined, DesktopOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface OpenDSignal {
  id: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  strategyName: string;
  strategyId: string;
  price: number;
  quantity: number;
  confidence: number;
  reason: string;
  brokerId: string;
  brokerName: string;
  receivedAt: number;
  status: 'pending' | 'executing' | 'executed' | 'failed' | 'skipped';
  executionPrice?: number;
  executionTime?: number;
  errorMessage?: string;
  retryCount: number;
}

interface BatchResult {
  signalId: string;
  success: boolean;
  price?: number;
  error?: string;
}

// ═══════════ Mock data ═══════════

const MOCK_OPEND_SIGNALS: OpenDSignal[] = [
  { id: 's101', symbol: 'HK.00700', signal: 'BUY', strategyName: 'MACD背驰', strategyId: 'macd-div', price: 388.60, quantity: 100, confidence: 88, reason: '日线MACD底背离+放量', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 120000, status: 'pending', retryCount: 0 },
  { id: 's102', symbol: 'HK.09988', signal: 'SELL', strategyName: '均线死叉', strategyId: 'ma-cross', price: 82.30, quantity: 200, confidence: 75, reason: '5日线下穿20日线+缩量', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 300000, status: 'pending', retryCount: 0 },
  { id: 's103', symbol: 'US.AAPL', signal: 'BUY', strategyName: '布林下轨', strategyId: 'bb-bottom', price: 198.50, quantity: 50, confidence: 82, reason: '触及布林下轨+RSI<30', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 600000, status: 'executing', retryCount: 1 },
  { id: 's104', symbol: 'US.TSLA', signal: 'SELL', strategyName: 'RSI超买', strategyId: 'rsi-over', price: 267.80, quantity: 30, confidence: 70, reason: 'RSI 78超买+缩量', brokerId: 'moomoo', brokerName: 'Moomoo', receivedAt: Date.now() - 900000, status: 'failed', errorMessage: 'OpenD 连接超时', retryCount: 2 },
  { id: 's105', symbol: 'HK.03690', signal: 'BUY', strategyName: '趋势突破', strategyId: 'trend-break', price: 112.40, quantity: 150, confidence: 91, reason: '突破200日线+成交量放大3倍', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 1800000, status: 'executed', executionPrice: 112.45, executionTime: Date.now() - 1700000, retryCount: 0 },
  { id: 's106', symbol: 'US.NVDA', signal: 'BUY', strategyName: 'VWAP支撑', strategyId: 'vwap-sup', price: 134.20, quantity: 40, confidence: 78, reason: '回踩VWAP获得支撑', brokerId: 'futu', brokerName: 'Futu', receivedAt: Date.now() - 2400000, status: 'pending', retryCount: 0 },
  { id: 's107', symbol: 'HK.00941', signal: 'SELL', strategyName: 'MACD死叉', strategyId: 'macd-dead', price: 68.75, quantity: 300, confidence: 65, reason: 'MACD0轴附近死叉', brokerId: 'moomoo', brokerName: 'Moomoo', receivedAt: Date.now() - 3000000, status: 'skipped', retryCount: 3 },
];

// ═══════════ Components ═══════════

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: '#f59e0b', icon: <ClockCircleOutlined />, label: '待执行' },
  executing: { color: '#3b82f6', icon: <SyncOutlined spin />, label: '执行中' },
  executed: { color: '#22c55e', icon: <CheckCircleOutlined />, label: '已执行' },
  failed: { color: '#ef4444', icon: <CloseCircleOutlined />, label: '失败' },
  skipped: { color: '#8b949e', icon: <PauseCircleOutlined />, label: '已跳过' },
};

// ── Signal Actions Toolbar ──

function ActionToolbar({
  selectedIds,
  onExecuteSelected,
  onRefresh,
  executing,
}: {
  selectedIds: string[];
  onExecuteSelected: () => void;
  onRefresh: () => void;
  executing: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      marginBottom: 12,
      padding: '10px 14px',
      background: '#1a1d2e',
      borderRadius: 8,
      border: '1px solid #2a2d3e',
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        onClick={onExecuteSelected}
        disabled={selectedIds.length === 0 || executing}
        loading={executing}
        size="small"
      >
        执行选中 ({selectedIds.length})
      </Button>
      <Button
        icon={<ReloadOutlined />}
        onClick={onRefresh}
        size="small"
      >
        刷新
      </Button>
      <div style={{ flex: 1 }} />
      <Space size={16}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          <DesktopOutlined /> 本机 OpenD
        </span>
        <span style={{ fontSize: 12, color: '#8b949e' }}>
          自动拉取间隔 5s
        </span>
      </Space>
    </div>
  );
}

// ── Execution Progress Modal ──

function ExecutionProgressModal({
  visible,
  signals,
  onClose,
}: {
  visible: boolean;
  signals: OpenDSignal[];
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);

  const startExecution = useCallback(async () => {
    setRunning(true);
    const res: BatchResult[] = [];
    for (let i = 0; i < signals.length; i++) {
      // Simulate API call per signal
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
      const success = Math.random() > 0.15;
      res.push({
        signalId: signals[i].id,
        success,
        price: success ? signals[i].price + (Math.random() - 0.5) * 0.5 : undefined,
        error: success ? undefined : '超时',
      });
      setResults([...res]);
      setProgress(((i + 1) / signals.length) * 100);
    }
    setRunning(false);
    message.success(`批量执行完成: ${res.filter((r) => r.success).length}/${res.length} 成功`);
  }, [signals]);

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#f59e0b' }} />
          <span>批量执行 {signals.length} 个信号</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose} disabled={running}>关闭</Button>,
        <Button key="start" type="primary" onClick={startExecution} loading={running} disabled={running}>
          {running ? '执行中...' : '开始执行'}
        </Button>,
      ]}
      width={520}
    >
      <Progress percent={Math.round(progress)} status={progress === 100 ? 'success' : 'active'} />

      <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 12 }}>
        {results.map((r, i) => {
          const s = signals.find((x) => x.id === r.signalId);
          return (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              background: '#0d0f1a',
              borderRadius: 6,
              marginBottom: 4,
              border: `1px solid ${r.success ? '#22c55e33' : '#ef444433'}`,
              fontSize: 12,
            }}>
              <Space size={8}>
                {r.success
                  ? <CheckCircleOutlined style={{ color: '#22c55e' }} />
                  : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
                <span style={{ color: '#e0e0e0' }}>{s?.symbol}</span>
                <Tag color={s?.signal === 'BUY' ? 'green' : 'red'} style={{ fontSize: 10 }}>
                  {s?.signal}
                </Tag>
              </Space>
              <Space>
                {r.success && r.price !== undefined && (
                  <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>
                    ${r.price.toFixed(2)}
                  </span>
                )}
                {r.error && (
                  <Tag color="red" style={{ fontSize: 10 }}>{r.error}</Tag>
                )}
              </Space>
            </div>
          );
        })}
        {signals.slice(results.length).map((s) => (
          <div key={s.id} style={{
            padding: '8px 10px',
            background: '#0d0f1a',
            borderRadius: 6,
            marginBottom: 4,
            border: '1px solid #2a2d3e',
            fontSize: 12,
            color: '#8b949e',
          }}>
            <Space size={8}>
              <ClockCircleOutlined />
              <span>{s.symbol}</span>
              <Tag color={s.signal === 'BUY' ? 'green' : 'red'} style={{ fontSize: 10 }}>
                {s.signal}
              </Tag>
              <span>等待中...</span>
            </Space>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Main OpenDSignalPanel ──

export default function OpenDSignalPanel() {
  const [signals, setSignals] = useState<OpenDSignal[]>(MOCK_OPEND_SIGNALS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [execModalVisible, setExecModalVisible] = useState(false);
  const [executing, setExecuting] = useState(false);

  const pending = signals.filter((s) => s.status === 'pending');
  const failed = signals.filter((s) => s.status === 'failed');

  const handleRefresh = useCallback(() => {
    message.info('刷新信号列表...');
  }, []);

  const handleExecuteSingle = useCallback((id: string) => {
    setSignals((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: 'executing' as const } : s
      )
    );
    // Simulate execution
    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'executed' as const, executionPrice: s.price + (Math.random() - 0.5) * 0.3, executionTime: Date.now() }
            : s
        )
      );
      message.success(`信号 ${id} 执行完成`);
    }, 800 + Math.random() * 400);
  }, []);

  const handleBatchExecute = useCallback(() => {
    const toExec = signals.filter((s) => selectedIds.includes(s.id) && s.status === 'pending');
    if (toExec.length === 0) {
      message.warning('无待执行信号');
      return;
    }
    setExecuting(true);
    setSignals((prev) =>
      prev.map((s) =>
        selectedIds.includes(s.id) && s.status === 'pending'
          ? { ...s, status: 'executing' as const }
          : s
      )
    );

    // Simulate batch execution
    setTimeout(() => {
      setSignals((prev) =>
        prev.map((s) => {
          if (selectedIds.includes(s.id) && s.status === 'executing') {
            const success = Math.random() > 0.2;
            return {
              ...s,
              status: success ? ('executed' as const) : ('failed' as const),
              executionPrice: success ? s.price + (Math.random() - 0.5) * 0.5 : undefined,
              executionTime: success ? Date.now() : undefined,
              errorMessage: success ? undefined : '下单超时',
              retryCount: success ? s.retryCount : s.retryCount + 1,
            };
          }
          return s;
        })
      );
      setExecuting(false);
      setSelectedIds([]);
      message.success('批量执行完成');
    }, 2000);
  }, [signals, selectedIds]);

  const columns: any[] = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: any, r: OpenDSignal) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          disabled={r.status !== 'pending'}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds((prev) => [...prev, r.id]);
            } else {
              setSelectedIds((prev) => prev.filter((x) => x !== r.id));
            }
          }}
        />
      ),
    },
    {
      title: '代码',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      render: (v: string) => <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 12 }}>{v}</span>,
    },
    {
      title: '方向',
      dataIndex: 'signal',
      key: 'signal',
      width: 65,
      render: (v: string) => (
        <Tag color={v === 'BUY' ? 'green' : 'red'} style={{ fontSize: 10 }}>
          {v === 'BUY' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 80,
      render: (v: number) => <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: 12 }}>${v.toFixed(2)}</span>,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 60,
      render: (v: number) => <span style={{ color: '#e0e0e0', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategy',
      width: 100,
      render: (v: string) => <Tag color="blue" style={{ fontSize: 10 }}>{v}</Tag>,
    },
    {
      title: '置信',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 55,
      render: (v: number) => (
        <span style={{
          color: v >= 80 ? '#22c55e' : v >= 60 ? '#f59e0b' : '#ef4444',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {v}%
        </span>
      ),
    },
    {
      title: '券商',
      dataIndex: 'brokerName',
      key: 'broker',
      width: 70,
      render: (v: string) => <Tag color="cyan" style={{ fontSize: 10 }}>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string, r: OpenDSignal) => {
        const sc = STATUS_CONFIG[v];
        return (
          <Space size={4}>
            {r.retryCount > 0 && v === 'failed' && (
              <Tooltip title={`已重试 ${r.retryCount} 次`}>
                <SyncOutlined style={{ color: '#f59e0b', fontSize: 10 }} />
              </Tooltip>
            )}
            <Tag color={sc.color} style={{ fontSize: 10 }}>
              {sc.icon} {sc.label}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_: any, r: OpenDSignal) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecuteSingle(r.id)}
            >
              执行
            </Button>
          )}
          {r.status === 'failed' && (
            <Button
              size="small"
              danger
              ghost
              icon={<ReloadOutlined />}
              onClick={() => handleExecuteSingle(r.id)}
            >
              重试
            </Button>
          )}
          {r.status === 'executing' && (
            <SyncOutlined spin style={{ color: '#3b82f6' }} />
          )}
          {r.status === 'executed' && (
            <CheckCircleOutlined style={{ color: '#22c55e' }} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1a2e1a 0%, #1a1d2e 100%)',
        borderRadius: 10,
        border: '1px solid #2a2d3e',
      }}>
        <Space>
          <ApiOutlined style={{ fontSize: 20, color: '#22c55e' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>OpenD 信号面板</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>
              桌面端拉取 · OpenD本地执行 · 结果回传服务器
            </div>
          </div>
        </Space>
        <Space size={12}>
          <Tooltip title="待执行">
            <Badge count={pending.length} size="small">
              <Tag color="gold" style={{ fontSize: 11 }}>待处理</Tag>
            </Badge>
          </Tooltip>
          <Tooltip title="失败">
            <Badge count={failed.length} size="small">
              <Tag color="red" style={{ fontSize: 11 }}>失败</Tag>
            </Badge>
          </Tooltip>
        </Space>
      </div>

      {/* Connection / Alert */}
      <Alert
        message={
          <Space>
            <DesktopOutlined />
            <span>本机 OpenD 运行中 · Futu:11111 (lv3) · Moomoo:11112 (lv2)</span>
            <Tag color="green" style={{ fontSize: 10 }}>已连接</Tag>
          </Space>
        }
        type="success"
        showIcon={false}
        style={{
          background: '#0a2e0a',
          border: '1px solid #22c55e33',
          borderRadius: 8,
          marginBottom: 10,
        }}
        styles={{ message: { color: '#e0e0e0' } }}
      />

      {/* Toolbar */}
      <ActionToolbar
        selectedIds={selectedIds}
        onExecuteSelected={handleBatchExecute}
        onRefresh={handleRefresh}
        executing={executing}
      />

      {/* Signals Table */}
      <Card
        size="small"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '8px' } }}
      >
        <Table
          dataSource={signals}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, size: 'small', showTotal: (t: number) => `共 ${t} 条` }}
          locale={{ emptyText: <Empty description="无待处理信号" /> }}
          rowClassName={() => 'dark-table-row'}
        />
      </Card>

      {/* Stats Footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginTop: 10,
      }}>
        {[
          { label: '待执行', value: pending.length, color: '#f59e0b' },
          { label: '执行中', value: signals.filter((s) => s.status === 'executing').length, color: '#3b82f6' },
          { label: '已完成', value: signals.filter((s) => s.status === 'executed').length, color: '#22c55e' },
          { label: '失败', value: failed.length, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '8px',
            background: '#1a1d2e',
            borderRadius: 6,
            border: '1px solid #2a2d3e',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#6b7280' }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
