// @ts-nocheck

// ── R142-M01 DepositPage — 充值页面 (TRC-20/ERC-20+QR+状态轮询+通知) ────
// PM: 7h, 4 tasks in 1 file
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Button, Select, Tabs, Table, Tag, Space, QRCode, Input,
  Alert, message, Badge, Empty, Statistic, Descriptions, Tooltip,
} from 'antd';
import {
  DownloadOutlined, CopyOutlined, ReloadOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, WalletOutlined,
  ThunderboltOutlined, SafetyCertificateOutlined, DollarOutlined,
  HistoryOutlined, CalculatorOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface DepositRecord {
  id: string;
  chain: 'TRC20' | 'ERC20';
  amount: number;
  address: string;
  txHash: string;
  confirmations: number;
  requiredConfirmations: number;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

interface FeeItem {
  assetType: string;
  icon: string;
  rate: string;
  minFee: string;
  examples: { amount: number; fee: number }[];
}

// ═══════════ Mock ═══════════

const MOCK_DEPOSITS: DepositRecord[] = [
  { id: 'd1', chain: 'TRC20', amount: 5000, address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', txHash: '0xabc123def456...', confirmations: 20, requiredConfirmations: 20, status: 'completed', createdAt: Date.now() - 86400000, completedAt: Date.now() - 86300000 },
  { id: 'd2', chain: 'TRC20', amount: 2000, address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', txHash: '0x789ghi012jkl...', confirmations: 8, requiredConfirmations: 20, status: 'confirming', createdAt: Date.now() - 1800000 },
  { id: 'd3', chain: 'ERC20', amount: 1000, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', txHash: '0x345mno678pqr...', confirmations: 12, requiredConfirmations: 12, status: 'completed', createdAt: Date.now() - 43200000, completedAt: Date.now() - 43190000 },
  { id: 'd4', chain: 'TRC20', amount: 500, address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', txHash: '0x901stu234vwx...', confirmations: 1, requiredConfirmations: 20, status: 'confirming', createdAt: Date.now() - 600000 },
];

// v17.6 Fee Structure
const FEE_ITEMS: FeeItem[] = [
  { assetType: '股票/ETF', icon: '📈', rate: '0.1%', minFee: '2 USDT', examples: [{ amount: 1000, fee: 2 }, { amount: 5000, fee: 5 }, { amount: 10000, fee: 10 }] },
  { assetType: '期货(非加密)', icon: '📊', rate: '0.1%', minFee: '2 USDT', examples: [{ amount: 2000, fee: 2 }, { amount: 5000, fee: 5 }] },
  { assetType: '期权(非加密)', icon: '🎯', rate: '0.1%', minFee: '2 USDT', examples: [{ amount: 500, fee: 2 }, { amount: 2000, fee: 2 }] },
  { assetType: '加密现货', icon: '🪙', rate: '0.1%', minFee: '2 USDT', examples: [{ amount: 500, fee: 2 }, { amount: 5000, fee: 5 }, { amount: 10000, fee: 10 }] },
  { assetType: '加密合约', icon: '⚡', rate: '0.02%', minFee: '0.5 USDT', examples: [{ amount: 1000, fee: 0.5 }, { amount: 10000, fee: 2 }, { amount: 50000, fee: 10 }] },
];

// ═══════════ Helpers ═══════════

function copyText(text: string) { navigator.clipboard?.writeText(text); message.success('已复制'); }
function fmtTime(ts: number) { return new Date(ts).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
function fmtUsdt(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ═══════════ Components ═══════════

// ── Deposit Panel ──

function DepositPanel() {
  const [chain, setChain] = useState<'TRC20' | 'ERC20'>('TRC20');
  const [polling, setPolling] = useState(false);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const address = chain === 'TRC20'
    ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
    : '0xdAC17F958D2ee523a2206206994597C13D831ec7';

  const confirmBlock = chain === 'TRC20' ? 20 : 12;

  const togglePolling = useCallback(() => {
    if (polling) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      intervalRef.current = setInterval(() => {
        setLastCheck(Date.now());
        // Mock: random confirmation check
      }, 10000);
    }
  }, [polling]);

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, []);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>区块链</div>
        <Select value={chain} onChange={setChain} style={{ width: '100%' }}>
          <Select.Option value="TRC20">TRC-20 (推荐 · 低Gas · 20确认)</Select.Option>
          <Select.Option value="ERC20">ERC-20 (平台补贴Gas · 12确认)</Select.Option>
        </Select>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <QRCode value={address} size={200} style={{ margin: '0 auto' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <code style={{ padding: '6px 12px', background: '#0d0f1a', borderRadius: 4, color: '#e0e0e0', fontSize: 10, wordBreak: 'break-all', maxWidth: 300 }}>
            {address}
          </code>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(address)} />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{ padding: '8px', background: '#1a2e1a', borderRadius: 6, border: '1px solid #22c55e33', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>网络</div>
          <div style={{ color: '#22c55e', fontWeight: 700 }}>{chain}</div>
        </div>
        <div style={{ padding: '8px', background: '#0d0f1a', borderRadius: 6, border: '1px solid #2a2d3e', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>确认块数</div>
          <div style={{ color: '#e0e0e0', fontWeight: 700 }}>{confirmBlock}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          type={polling ? 'default' : 'primary'}
          onClick={togglePolling}
          icon={polling ? <ClockCircleOutlined /> : <ReloadOutlined />}
          block
        >
          {polling ? '停止轮询' : '开始监控 (10s)'}
        </Button>
        {polling && (
          <Tag color="processing" style={{ lineHeight: '30px' }}>
            上次检查: {fmtTime(lastCheck)}
          </Tag>
        )}
      </div>

      <Alert
        message={<span style={{ fontSize: 11 }}>仅支持 {chain} 网络 USDT。充值免手续费 (0%)，到账 {confirmBlock} 个区块确认后自动入账。</span>}
        type="info"
        showIcon={false}
        style={{ background: '#1a2e2a', border: '1px solid #3b82f633', borderRadius: 8, marginTop: 10 }}
      />
    </div>
  );
}

// ── Fee Display ──

function FeeDisplay() {
  const [previewAmount, setPreviewAmount] = useState(5000);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>输入金额预览手续费</div>
        <Input
          type="number"
          value={previewAmount}
          onChange={(e) => setPreviewAmount(Number(e.target.value) || 0)}
          prefix="$"
          suffix="USDT"
          style={{ background: '#0d0f1a' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FEE_ITEMS.map((item) => {
          const fee = Math.max(Number(item.minFee.replace(/[^0-9.]/g, '')), previewAmount * parseFloat(item.rate) / 100);
          return (
            <div key={item.assetType} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: '#0d0f1a',
              borderRadius: 8,
              border: '1px solid #2a2d3e',
            }}>
              <Space size={6}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <div>
                  <div style={{ color: '#e0e0e0', fontSize: 12, fontWeight: 500 }}>{item.assetType}</div>
                  <Tag color="blue" style={{ fontSize: 9 }}>{item.rate} · 最低 {item.minFee}</Tag>
                </div>
              </Space>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>
                  {fmtUsdt(fee)} USDT
                </div>
                <div style={{ color: '#6b7280', fontSize: 9 }}>
                  到账 {fmtUsdt(previewAmount - fee)} USDT
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fee Examples Table ──

function FeeExamplesTable() {
  return (
    <div>
      {FEE_ITEMS.map((item) => (
        <Card
          key={item.assetType}
          size="small"
          title={<Space><span>{item.icon}</span><span style={{ color: '#e0e0e0', fontSize: 13 }}>{item.assetType}</span><Tag color="blue">{item.rate}</Tag><Tag color="gold">最低{item.minFee}</Tag></Space>}
          style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, marginBottom: 8 }}
          styles={{ body: { padding: '10px 14px' } }}
        >
          <Table
            dataSource={item.examples}
            columns={[
              { title: '交易金额', dataIndex: 'amount', key: 'amount', render: (v: number) => <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>${v.toLocaleString()}</span> },
              { title: '手续费', dataIndex: 'fee', key: 'fee', render: (v: number) => <span style={{ color: '#f59e0b', fontFamily: 'monospace', fontWeight: 600 }}>{fmtUsdt(v)} USDT</span> },
              { title: '到账', key: 'net', render: (_:any, r:any) => <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>{fmtUsdt(r.amount - r.fee)} USDT</span> },
            ]}
            rowKey="amount"
            size="small"
            pagination={false}
            showHeader={true}
            rowClassName={() => 'dark-table-row'}
          />
        </Card>
      ))}
    </div>
  );
}

// ── Deposit History ──

function DepositHistory() {
  const [filter, setFilter] = useState<string>('all');

  const filtered = MOCK_DEPOSITS.filter((d) => {
    if (filter === 'pending') return d.status === 'pending' || d.status === 'confirming';
    if (filter === 'completed') return d.status === 'completed';
    return true;
  });

  const columns = [
    {
      title: '链',
      dataIndex: 'chain',
      key: 'chain',
      width: 65,
      render: (v: string) => <Tag color={v === 'TRC20' ? 'gold' : 'blue'}>{v === 'TRC20' ? 'TRC' : 'ERC'}</Tag>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 90,
      render: (v: number) => <span style={{ color: '#22c55e', fontWeight: 600, fontFamily: 'monospace' }}>+{fmtUsdt(v)}</span>,
    },
    {
      title: '确认',
      key: 'confirm',
      width: 80,
      render: (_:any, r:DepositRecord) => (
        <span style={{ color: r.confirmations >= r.requiredConfirmations ? '#22c55e' : '#f59e0b', fontSize: 11 }}>
          {r.confirmations}/{r.requiredConfirmations}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => {
        if (v === 'completed') return <Badge color="green" text="已到账" />;
        if (v === 'confirming') return <Badge color="gold" text="确认中" />;
        return <Badge color="default" text={v} />;
      },
    },
    {
      title: 'TxHash',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (v: string) => (
        <Tooltip title={v}>
          <code style={{ color: '#8b949e', fontSize: 10 }}>{v.slice(0, 16)}...</code>
        </Tooltip>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'time',
      width: 100,
      render: (v: number) => <span style={{ color: '#8b949e', fontSize: 10 }}>{fmtTime(v)}</span>,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 10 }}>
        {[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '处理中' },
          { key: 'completed', label: '已到账' },
        ].map((f) => (
          <Button
            key={f.key}
            size="small"
            type={filter === f.key ? 'primary' : 'default'}
            ghost={filter !== f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({MOCK_DEPOSITS.filter((d) => f.key === 'all' ? true : f.key === 'pending' ? (d.status === 'pending' || d.status === 'confirming') : d.status === 'completed').length})
          </Button>
        ))}
      </Space>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 笔` }}
        locale={{ emptyText: <Empty description="暂无充值记录" /> }}
        rowClassName={() => 'dark-table-row'}
      />
    </div>
  );
}

// ── Main DepositAndFeePage ──

export default function DepositAndFeePage() {
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
          <WalletOutlined style={{ fontSize: 20, color: '#22c55e' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 16 }}>充值 & 手续费</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>TRC-20/ERC-20 · 充值0% · 5类费率</div>
          </div>
        </Space>
        <Space>
          <Tag color="green">v17.6</Tag>
          <Tag color="gold">充值免费</Tag>
        </Space>
      </div>

      {/* Tabs */}
      <Card
        size="small"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '12px' } }}
      >
        <Tabs
          defaultActiveKey="deposit"
          size="small"
          items={[
            {
              key: 'deposit',
              label: <Space size={4}><DownloadOutlined /><span>充值</span></Space>,
              children: <DepositPanel />,
            },
            {
              key: 'feePreview',
              label: <Space size={4}><CalculatorOutlined /><span>手续费预览</span></Space>,
              children: <FeeDisplay />,
            },
            {
              key: 'feeTable',
              label: <Space size={4}><DollarOutlined /><span>费率表</span></Space>,
              children: <FeeExamplesTable />,
            },
            {
              key: 'history',
              label: <Space size={4}><HistoryOutlined /><span>充值记录</span></Space>,
              children: <DepositHistory />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
