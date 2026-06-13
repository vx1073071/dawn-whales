// @ts-nocheck
// ⚠️ @deprecated v17.6 R150 (2026-06-13): Use WalletFullPage.tsx instead.
// WalletFullPage is the single unified wallet entry point with all features
// (balance/withdraw/transfer/tip/overview integrated in one page).
// ── R141-M01 WalletPage — 钱包页面 (余额+充值+提现+转账) ──────────────────
// PM: 钱包页面框架, 8h
import { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Tabs, Input, Select, Space, Tag, Statistic,
  Modal, message, Descriptions, Empty, Table, Badge, QRCode,
  Alert, Tooltip,
} from 'antd';
import {
  WalletOutlined, DollarOutlined, ArrowUpOutlined, ArrowDownOutlined,
  SwapOutlined, HistoryOutlined, CopyOutlined, ReloadOutlined,
  SafetyCertificateOutlined, ThunderboltOutlined, QrcodeOutlined,
  SendOutlined, DownloadOutlined, BankOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useWalletStore, type TransactionType, type TransactionStatus } from '@/stores/walletStore';

// ═══════════ Helpers ═══════════

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
  message.success('已复制');
}

function fmtUsdt(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const TX_TYPE_LABELS: Record<TransactionType, { label: string; color: string }> = {
  deposit: { label: '充值', color: '#22c55e' },
  withdraw: { label: '提现', color: '#ef4444' },
  transfer_in: { label: '收款', color: '#22c55e' },
  transfer_out: { label: '转出', color: '#f59e0b' },
  tip_sent: { label: '打赏', color: '#f59e0b' },
  tip_received: { label: '收到打赏', color: '#22c55e' },
  trade_fee: { label: '交易费', color: '#8b949e' },
  ai_fee: { label: 'AI费', color: '#8b949e' },
  marketplace_buy: { label: '购买', color: '#3b82f6' },
  marketplace_sell: { label: '售出', color: '#22c55e' },
  refund: { label: '退款', color: '#a78bfa' },
  reward: { label: '奖励', color: '#f59e0b' },
};

const STATUS_TAGS: Record<TransactionStatus, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'gold', icon: <></> },
  completed: { color: 'green', icon: <CheckCircleOutlined /> },
  failed: { color: 'red', icon: <></> },
  cancelled: { color: 'default', icon: <></> },
};

// ═══════════ Sub-components ═══════════

// ── Balance Card ──

function BalanceCard() {
  const balance = useWalletStore((s) => s.balance);
  const loading = useWalletStore((s) => s.loading);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);

  useEffect(() => { fetchBalance(); }, []);

  return (
    <Card
      style={{
        background: 'linear-gradient(135deg, #1a1d2e 0%, #232740 100%)',
        border: '1px solid #2a2d3e',
        borderRadius: 12,
        marginBottom: 12,
      }}
      styles={{ body: { padding: '20px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Space size={6} style={{ marginBottom: 8 }}>
            <WalletOutlined style={{ color: '#f59e0b', fontSize: 16 }} />
            <span style={{ color: '#8b949e', fontSize: 12 }}>USDT 钱包</span>
          </Space>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#e0e0e0', fontFamily: 'monospace' }}>
            {loading ? '...' : fmtUsdt(balance.total)}
          </div>
          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
            ≈ ${balance.total.toFixed(2)} USD
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchBalance}
          loading={loading}
          size="small"
          type="text"
          style={{ color: '#8b949e' }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        marginTop: 14,
      }}>
        <div style={{ padding: '8px', background: '#0d0f1a', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#6b7280' }}>可用</div>
          <div style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>{fmtUsdt(balance.available)}</div>
        </div>
        <div style={{ padding: '8px', background: '#0d0f1a', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#6b7280' }}>冻结</div>
          <div style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>{fmtUsdt(balance.frozen)}</div>
        </div>
        <div style={{ padding: '8px', background: '#0d0f1a', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#6b7280' }}>待确认</div>
          <div style={{ color: '#3b82f6', fontWeight: 700, fontFamily: 'monospace' }}>{fmtUsdt(balance.pendingDeposit)}</div>
        </div>
      </div>
    </Card>
  );
}

// ── Deposit Modal ──

function DepositModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const deposit = useWalletStore((s) => s.deposit);
  const [chain, setChain] = useState<'TRC20' | 'ERC20'>('TRC20');
  const [amount, setAmount] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  // Mock address
  const address = chain === 'TRC20' ? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' : '0xdAC17F958D2ee523a2206206994597C13D831ec7';

  const handleDeposit = useCallback(async () => {
    setSubmitting(true);
    await deposit({ chain, amount });
    setSubmitting(false);
    onClose();
  }, [chain, amount, deposit, onClose]);

  return (
    <Modal title={<Space><DownloadOutlined /><span>充值 USDT</span></Space>} open={visible} onCancel={onClose} footer={null} width={460}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Select value={chain} onChange={setChain} style={{ width: 200, marginBottom: 12 }}>
          <Select.Option value="TRC20">TRC-20 (推荐, 低Gas)</Select.Option>
          <Select.Option value="ERC20">ERC-20 (平台补贴Gas)</Select.Option>
        </Select>
        <div style={{ marginBottom: 12 }}>
          <QRCode value={address} size={160} icon="/logo.svg" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <code style={{ padding: '6px 12px', background: '#0d0f1a', borderRadius: 4, color: '#e0e0e0', fontSize: 11 }}>{address}</code>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(address)} />
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#8b949e' }}>
          仅支持 {chain} 网络的 USDT。充值免手续费，充多少到多少。
        </div>
      </div>
    </Modal>
  );
}

// ── Withdraw Modal ──

function WithdrawModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const withdraw = useWalletStore((s) => s.withdraw);
  const balance = useWalletStore((s) => s.balance);
  const [chain, setChain] = useState<'TRC20' | 'ERC20'>('TRC20');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fee = Math.max(Number(amount) * 0.001, 2);

  const handleWithdraw = useCallback(async () => {
    if (!address || !amount) return message.warning('请填写地址和金额');
    setSubmitting(true);
    await withdraw({ chain, address, amount: Number(amount) });
    setSubmitting(false);
    onClose();
  }, [chain, address, amount, withdraw, onClose]);

  return (
    <Modal
      title={<Space><ArrowUpOutlined /><span>提现 USDT</span></Space>}
      open={visible}
      onCancel={onClose}
      onOk={handleWithdraw}
      confirmLoading={submitting}
      okText="确认提现"
      width={460}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>区块链</div>
          <Select value={chain} onChange={setChain} style={{ width: '100%' }}>
            <Select.Option value="TRC20">TRC-20</Select.Option>
            <Select.Option value="ERC20">ERC-20</Select.Option>
          </Select>
        </div>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>提现地址</div>
          <Input placeholder={`${chain} 地址`} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>金额 (可用: {fmtUsdt(balance.available)} USDT)</div>
          <Input type="number" placeholder="最低 2 USDT" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="USDT" />
        </div>
        {amount && (
          <div style={{ padding: '8px 12px', background: '#0d0f1a', borderRadius: 6, fontSize: 12, color: '#8b949e' }}>
            手续费: {fee.toFixed(2)} USDT (0.1%) · 到账: {(Number(amount) - fee).toFixed(2)} USDT
          </div>
        )}
      </Space>
    </Modal>
  );
}

// ── Transfer Modal ──

function TransferModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const transfer = useWalletStore((s) => s.transfer);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fee = Number(amount) * 0.003;

  const handleTransfer = useCallback(async () => {
    if (!recipient || !amount) return message.warning('请填写接收方和金额');
    setSubmitting(true);
    await transfer({ recipientId: recipient, amount: Number(amount), note });
    setSubmitting(false);
    onClose();
  }, [recipient, amount, note, transfer, onClose]);

  return (
    <Modal
      title={<Space><SwapOutlined /><span>转账</span></Space>}
      open={visible}
      onCancel={onClose}
      onOk={handleTransfer}
      confirmLoading={submitting}
      okText="确认转账"
      width={460}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>接收方 ID</div>
          <Input placeholder="用户ID" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </div>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>金额</div>
          <Input type="number" placeholder="金额" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="USDT" />
        </div>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>备注 (可选)</div>
          <Input placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {amount && (
          <div style={{ padding: '8px 12px', background: '#0d0f1a', borderRadius: 6, fontSize: 12, color: '#8b949e' }}>
            手续费: {fee.toFixed(2)} USDT (发方 0.3%) · 收方也需支付 0.3%
          </div>
        )}
      </Space>
    </Modal>
  );
}

// ── Transaction Table ──

function TransactionHistory() {
  const transactions = useWalletStore((s) => s.transactions);
  const loading = useWalletStore((s) => s.loading);
  const fetchTransactions = useWalletStore((s) => s.fetchTransactions);

  useEffect(() => { fetchTransactions(); }, []);

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v: TransactionType) => {
        const t = TX_TYPE_LABELS[v] || { label: v, color: '#8b949e' };
        return <Tag color={t.color} style={{ fontSize: 10 }}>{t.label}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (v: number, r: any) => (
        <span style={{ color: v >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600, fontFamily: 'monospace' }}>
          {v >= 0 ? '+' : ''}{fmtUsdt(v)} USDT
        </span>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'desc',
      render: (v: string, r: any) => (
        <div>
          <div style={{ color: '#e0e0e0', fontSize: 12 }}>{v}</div>
          {r.counterparty && <span style={{ color: '#6b7280', fontSize: 10 }}>@{r.counterparty}</span>}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: TransactionStatus) => {
        const s = STATUS_TAGS[v];
        return <Badge color={s.color} text={v === 'completed' ? '完成' : v === 'pending' ? '处理中' : v} />;
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'time',
      width: 100,
      render: (v: number) => <span style={{ color: '#8b949e', fontSize: 11 }}>{fmtTime(v)}</span>,
    },
  ];

  return (
    <Table
      dataSource={transactions}
      columns={columns}
      rowKey="id"
      size="small"
      loading={loading}
      pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 笔` }}
      locale={{ emptyText: <Empty description="暂无交易记录" /> }}
      rowClassName={() => 'dark-table-row'}
    />
  );
}

// ── Quick Actions ──

function QuickActions({ onAction }: { onAction: (a: string) => void }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 8,
      marginBottom: 12,
    }}>
      {[
        { key: 'deposit', icon: <DownloadOutlined />, label: '充值', color: '#22c55e' },
        { key: 'withdraw', icon: <ArrowUpOutlined />, label: '提现', color: '#ef4444' },
        { key: 'transfer', icon: <SwapOutlined />, label: '转账', color: '#3b82f6' },
        { key: 'refresh', icon: <ReloadOutlined />, label: '刷新', color: '#8b949e' },
      ].map((a) => (
        <Button
          key={a.key}
          size="large"
          style={{
            height: 60,
            background: '#1a1d2e',
            border: '1px solid #2a2d3e',
            borderRadius: 10,
            color: a.color,
            fontSize: 12,
          }}
          icon={a.icon}
          onClick={() => onAction(a.key)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// ═══════════ Main Wallet Page ═══════════

export default function WalletPage() {
  const [depositVisible, setDepositVisible] = useState(false);
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const fetchTransactions = useWalletStore((s) => s.fetchTransactions);

  const handleAction = useCallback((action: string) => {
    if (action === 'deposit') setDepositVisible(true);
    else if (action === 'withdraw') setWithdrawVisible(true);
    else if (action === 'transfer') setTransferVisible(true);
    else if (action === 'refresh') { fetchBalance(); fetchTransactions(); }
  }, [fetchBalance, fetchTransactions]);

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
          <WalletOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 16 }}>USDT 钱包</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>充值免费 · 提现0.1% · 转账0.3%</div>
          </div>
        </Space>
        <Tag color="green" style={{ fontSize: 10 }}>v17.6</Tag>
      </div>

      {/* Balance */}
      <BalanceCard />

      {/* Quick Actions */}
      <QuickActions onAction={handleAction} />

      {/* Security notice */}
      <Alert
        message={<span style={{ fontSize: 11 }}>🔒 钱包余额由服务端计算，客户端不参与财务计算。6层安全防御+双记账。</span>}
        type="info"
        showIcon={false}
        style={{ background: '#1a2e2a', border: '1px solid #3b82f633', borderRadius: 8, marginBottom: 12 }}
      />

      {/* Transactions */}
      <Card
        size="small"
        title={<Space><HistoryOutlined style={{ color: '#3b82f6' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>交易记录</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '8px' } }}
      >
        <TransactionHistory />
      </Card>

      {/* Modals */}
      <DepositModal visible={depositVisible} onClose={() => setDepositVisible(false)} />
      <WithdrawModal visible={withdrawVisible} onClose={() => setWithdrawVisible(false)} />
      <TransferModal visible={transferVisible} onClose={() => setTransferVisible(false)} />
    </div>
  );
}
