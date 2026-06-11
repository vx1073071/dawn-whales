/**
 * src/pages/Admin/DeadLetterPanel.tsx
 * R108 S-38: Dead-letter queue recovery panel
 *
 * Features:
 * - Dead-letter list with type/date filtering
 * - Single retry/skip operations
 * - Batch retry (≤20) / batch skip
 * - Expand payload viewer
 * - Audit log (append-only)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Badge, Tag, Modal, Space, Tooltip, Select, DatePicker, message, Spin, Empty } from 'antd';
import { ReloadOutlined, EyeOutlined, CheckOutlined, CloseOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

// ── Types ──────────────────────────────────────────────

type DeadLetterType = 'DEDUCT_FAIL' | 'RATE_REJECT' | 'RECONCILE_FAIL';
type DeadLetterStatus = 'pending' | 'retrying' | 'retry_failed' | 'skipped';

interface DeadLetter {
  id: string;
  timestamp: number;
  tradeId: string;
  type: DeadLetterType;
  amount: number;
  reason: string;
  retryCount: number;
  status: DeadLetterStatus;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
}

interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: 'retry' | 'skip' | 'batch_retry' | 'batch_skip';
  deadLetterId: string;
  operator: string;
  detail: string;
}

// ── Mock data ──────────────────────────────────────────

const MOCK_DEAD_LETTERS: DeadLetter[] = [
  { id: 'DL001', timestamp: Date.now() - 600000, tradeId: 'TX-20260612-A001', type: 'DEDUCT_FAIL', amount: 50, reason: 'Insufficient balance', retryCount: 2, status: 'pending', requestPayload: { action: 'deduct', tradeId: 'TX-20260612-A001', amount: 50, currency: 'USDT' }, responsePayload: { error: 'Balance too low' } },
  { id: 'DL002', timestamp: Date.now() - 1200000, tradeId: 'TX-20260612-A002', type: 'RATE_REJECT', amount: 100, reason: 'Exchange rate stale (>5min)', retryCount: 1, status: 'pending', requestPayload: { action: 'topup', currency: 'CNY', amount: 1000 }, responsePayload: { error: 'Rate expired' } },
  { id: 'DL003', timestamp: Date.now() - 1800000, tradeId: 'TX-20260612-A003', type: 'RECONCILE_FAIL', amount: 0.5, reason: 'Amount mismatch: expected 100.000000 got 99.999500', retryCount: 3, status: 'retrying', requestPayload: { action: 'reconcile', reportId: 'RPT-001' }, responsePayload: { diff: -0.0005 } },
  { id: 'DL004', timestamp: Date.now() - 2400000, tradeId: 'TX-20260612-A004', type: 'DEDUCT_FAIL', amount: 25, reason: 'Rate provider timeout', retryCount: 0, status: 'pending', requestPayload: { action: 'deduct', tradeId: 'TX-20260612-A004' }, responsePayload: null },
  { id: 'DL005', timestamp: Date.now() - 3000000, tradeId: 'TX-20260612-A005', type: 'RATE_REJECT', amount: 200, reason: 'Invalid currency pair', retryCount: 0, status: 'skipped', requestPayload: { action: 'topup', currency: 'XYZ' }, responsePayload: { error: 'Unknown currency' } },
  { id: 'DL006', timestamp: Date.now() - 3600000, tradeId: 'TX-20260612-A006', type: 'DEDUCT_FAIL', amount: 75, reason: 'Network error', retryCount: 1, status: 'pending', requestPayload: { action: 'deduct', tradeId: 'TX-20260612-A006', amount: 75 }, responsePayload: null },
];

const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  { id: 'A001', timestamp: Date.now() - 300000, action: 'retry', deadLetterId: 'DL001', operator: 'admin', detail: 'Manual retry attempt #3' },
  { id: 'A002', timestamp: Date.now() - 600000, action: 'skip', deadLetterId: 'DL005', operator: 'admin', detail: 'Invalid currency, manually acknowledged' },
  { id: 'A003', timestamp: Date.now() - 900000, action: 'batch_retry', deadLetterId: 'DL001,DL002,DL004', operator: 'admin', detail: 'Batch retry 3 items' },
];

// ── Component ──────────────────────────────────────────

export default function DeadLetterPanel() {
  const { t } = useTranslation();
  const [letters, setLetters] = useState<DeadLetter[]>(MOCK_DEAD_LETTERS);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOG);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filterType, setFilterType] = useState<DeadLetterType | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<DeadLetter | null>(null);
  const [auditModal, setAuditModal] = useState(false);

  // ── Filtered data ──

  const filtered = useMemo(() => {
    if (filterType === 'ALL') return letters;
    return letters.filter(l => l.type === filterType);
  }, [letters, filterType]);

  // ── Actions ──

  const addAudit = useCallback((action: AuditLogEntry['action'], deadLetterId: string, detail: string) => {
    setAuditLog(prev => [{
      id: `A${Date.now()}`,
      timestamp: Date.now(),
      action,
      deadLetterId,
      operator: 'admin',
      detail,
    }, ...prev]);
  }, []);

  const handleRetry = useCallback(async (id: string) => {
    setLoading(true);
    setLetters(prev => prev.map(l => l.id === id ? { ...l, status: 'retrying' as const } : l));
    setTimeout(() => {
      setLetters(prev => prev.map(l => l.id === id ? { ...l, status: 'skipped' as const, retryCount: l.retryCount + 1 } : l));
      addAudit('retry', id, `Retry attempt #${(letters.find(l=>l.id===id)?.retryCount??0)+1}`);
      message.success(`DL ${id}: retry queued`);
      setLoading(false);
    }, 800);
  }, [addAudit, letters]);

  const handleSkip = useCallback((id: string, reason: string) => {
    setLetters(prev => prev.map(l => l.id === id ? { ...l, status: 'skipped' as const } : l));
    addAudit('skip', id, reason || 'Manually skipped');
    message.info(`DL ${id}: marked as skipped`);
  }, [addAudit]);

  const handleBatchRetry = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('No items selected'); return; }
    if (selectedRowKeys.length > 20) { message.warning('Max 20 items per batch'); return; }
    Modal.confirm({
      title: 'Batch Retry',
      content: `Retry ${selectedRowKeys.length} dead-letter items?`,
      onOk: () => {
        const ids = selectedRowKeys as string[];
        setLetters(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'retrying' as const } : l));
        setTimeout(() => {
          setLetters(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'skipped' as const, retryCount: l.retryCount + 1 } : l));
          addAudit('batch_retry', ids.join(','), `Batch retry ${ids.length} items`);
          message.success(`Batch retry: ${ids.length} items queued`);
          setSelectedRowKeys([]);
        }, 1200);
      },
    });
  }, [selectedRowKeys, addAudit]);

  const handleBatchSkip = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('No items selected'); return; }
    Modal.confirm({
      title: 'Batch Skip',
      content: `Mark ${selectedRowKeys.length} items as skipped?`,
      onOk: () => {
        const ids = selectedRowKeys as string[];
        setLetters(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'skipped' as const } : l));
        addAudit('batch_skip', ids.join(','), `Batch skip ${ids.length} items`);
        message.info(`Batch skip: ${ids.length} items`);
        setSelectedRowKeys([]);
      },
    });
  }, [selectedRowKeys, addAudit]);

  // ── Columns ──

  const typeLabel: Record<DeadLetterType, string> = {
    DEDUCT_FAIL: 'Points Deduct Fail',
    RATE_REJECT: 'Rate Reject',
    RECONCILE_FAIL: 'Reconcile Fail',
  };

  const typeColor: Record<DeadLetterType, string> = {
    DEDUCT_FAIL: 'red',
    RATE_REJECT: 'orange',
    RECONCILE_FAIL: 'purple',
  };

  const columns: ColumnsType<DeadLetter> = [
    { title: 'Time', dataIndex: 'timestamp', key: 'time', width: 160, render: (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'), sorter: (a, b) => a.timestamp - b.timestamp, defaultSortOrder: 'descend' },
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: 'Trade ID', dataIndex: 'tradeId', key: 'tradeId', width: 180, ellipsis: true },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 140, render: (t: DeadLetterType) => <Tag color={typeColor[t]}>{typeLabel[t]}</Tag> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => `${v.toFixed(6)} USDT` },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: 'Retries', dataIndex: 'retryCount', key: 'retries', width: 80, render: (n: number) => <Badge count={n} overflowCount={99} color={n > 2 ? 'red' : 'blue'} /> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: (s: DeadLetterStatus) => {
      const m: Record<DeadLetterStatus, { color: string; text: string }> = { pending: { color: 'processing', text: 'Pending' }, retrying: { color: 'warning', text: 'Retrying' }, retry_failed: { color: 'error', text: 'Failed' }, skipped: { color: 'default', text: 'Skipped' } };
      return <Badge status={m[s].color as any} text={m[s].text} />;
    }},
    { title: 'Actions', key: 'actions', width: 200, render: (_, record) => (
      <Space size="small">
        <Tooltip title="View payload"><Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(record)} disabled={record.status === 'skipped'} /></Tooltip>
        <Tooltip title="Retry"><Button size="small" icon={<ReloadOutlined />} onClick={() => handleRetry(record.id)} loading={record.status === 'retrying'} disabled={record.status === 'skipped'} /></Tooltip>
        <Tooltip title="Skip"><Button size="small" icon={<CheckOutlined />} onClick={() => handleSkip(record.id, 'Manually confirmed')} disabled={record.status === 'skipped'} /></Tooltip>
      </Space>
    )},
  ];

  // ── Stats ──

  const stats = useMemo(() => {
    const pending = letters.filter(l => l.status === 'pending' || l.status === 'retrying');
    const total = letters.length;
    const skipped = letters.filter(l => l.status === 'skipped').length;
    return { pending: pending.length, total, skipped };
  }, [letters]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ExclamationCircleOutlined className="text-red-400" />
            Dead Letter Queue
          </h1>
          <p className="text-gray-400 text-sm mt-1">Recover failed points deductions, rate rejections, and reconciliation errors</p>
        </div>
        <Space>
          <Button onClick={() => setAuditModal(true)}>Audit Log ({auditLog.length})</Button>
        </Space>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Total</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-[#1a1a2e] border border-red-500/20 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Pending / Retrying</div>
          <div className="text-2xl font-bold text-red-400">{stats.pending}</div>
        </div>
        <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
          <div className="text-gray-400 text-xs uppercase tracking-wide">Skipped</div>
          <div className="text-2xl font-bold text-gray-500">{stats.skipped}</div>
        </div>
      </div>

      {/* Filters + Batch */}
      <div className="mb-4 flex items-center justify-between">
        <Space>
          <Select value={filterType} onChange={(v: DeadLetterType | 'ALL') => setFilterType(v)} style={{ width: 160 }} options={[
            { label: 'All Types', value: 'ALL' },
            { label: 'Deduct Fail', value: 'DEDUCT_FAIL' },
            { label: 'Rate Reject', value: 'RATE_REJECT' },
            { label: 'Reconcile Fail', value: 'RECONCILE_FAIL' },
          ]} />
        </Space>
        <Space>
          <Button onClick={handleBatchRetry} icon={<ReloadOutlined />} disabled={selectedRowKeys.length === 0}>
            Batch Retry ({selectedRowKeys.length})
          </Button>
          <Button onClick={handleBatchSkip} icon={<CheckOutlined />} disabled={selectedRowKeys.length === 0}>
            Batch Skip ({selectedRowKeys.length})
          </Button>
        </Space>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `Total ${total} items` }}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys), getCheckboxProps: (r: DeadLetter) => ({ disabled: r.status === 'skipped' }) }}
        locale={{ emptyText: <Empty description="No dead letters" /> }}
        size="middle"
        className="dead-letter-table"
      />

      {/* Detail Modal */}
      <Modal title="Dead Letter Detail" open={!!detailModal} onCancel={() => setDetailModal(null)} footer={null} width={700}>
        {detailModal && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">ID:</span> <span className="text-white">{detailModal.id}</span></div>
              <div><span className="text-gray-500">Trade ID:</span> <span className="text-white">{detailModal.tradeId}</span></div>
              <div><span className="text-gray-500">Type:</span> <Tag color={typeColor[detailModal.type]}>{typeLabel[detailModal.type]}</Tag></div>
              <div><span className="text-gray-500">Amount:</span> <span className="text-white">{detailModal.amount.toFixed(6)} USDT</span></div>
              <div><span className="text-gray-500">Retry Count:</span> <span className="text-white">{detailModal.retryCount}</span></div>
              <div><span className="text-gray-500">Status:</span> <Badge status={detailModal.status === 'skipped' ? 'default' : 'processing'} text={detailModal.status} /></div>
            </div>
            <div><span className="text-gray-500">Reason:</span> <span className="text-red-400 ml-2">{detailModal.reason}</span></div>
            <div>
              <div className="text-gray-500 mb-1">Request Payload:</div>
              <pre className="bg-[#0D0D14] p-3 rounded text-xs text-green-400 overflow-x-auto">{JSON.stringify(detailModal.requestPayload, null, 2)}</pre>
            </div>
            {detailModal.responsePayload && (
              <div>
                <div className="text-gray-500 mb-1">Response Payload:</div>
                <pre className="bg-[#0D0D14] p-3 rounded text-xs text-yellow-400 overflow-x-auto">{JSON.stringify(detailModal.responsePayload, null, 2)}</pre>
              </div>
            )}
            {!detailModal.responsePayload && (
              <div className="text-gray-600 italic">No response received (network error)</div>
            )}
          </div>
        )}
      </Modal>

      {/* Audit Log Modal */}
      <Modal title="Audit Log" open={auditModal} onCancel={() => setAuditModal(false)} footer={null} width={800}>
        <Table
          rowKey="id"
          dataSource={auditLog}
          pagination={{ pageSize: 20 }}
          size="small"
          columns={[
            { title: 'Time', dataIndex: 'timestamp', width: 160, render: (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss') },
            { title: 'Action', dataIndex: 'action', width: 120, render: (a: string) => <Tag>{a}</Tag> },
            { title: 'DL ID', dataIndex: 'deadLetterId', width: 150, ellipsis: true },
            { title: 'Operator', dataIndex: 'operator', width: 80 },
            { title: 'Detail', dataIndex: 'detail', ellipsis: true },
          ]}
        />
      </Modal>
    </div>
  );
}
