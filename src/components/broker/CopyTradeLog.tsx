// @ts-nocheck
// ── R139-M02 CopyTradeLog — 跟单日志页面 (时间线/筛选/CSV导出) ───────────
// PM: P1-7, 4h

import { useState, useMemo, useCallback } from 'react';
import {
  Card, Input, Select, DatePicker, Button, Tag, Space, Timeline,
  Modal, Empty, message,
} from 'antd';
import {
  SearchOutlined, FilterOutlined, DownloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  ClockCircleOutlined, DollarOutlined, ExclamationCircleOutlined,
  FileTextOutlined, ThunderboltOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ═══════════ Types ═══════════

interface LogEntry {
  id: string;
  timestamp: number;
  type: 'signal' | 'execution' | 'fill' | 'cancel' | 'error' | 'pause' | 'resume' | 'config';
  level: 'info' | 'success' | 'warn' | 'error';
  title: string;
  detail: string;
  brokerName?: string;
  providerName?: string;
  symbol?: string;
  amount?: number;
  pnl?: number;
}

// ═══════════ Mock ═══════════

const MOCK_LOGS: LogEntry[] = [
  { id: 'l1', timestamp: Date.now() - 60000, type: 'fill', level: 'success', title: '跟单成交', detail: 'AlphaQuant: BTC-USDT 买入 0.01 @ $97,234', brokerName: 'Binance', providerName: 'AlphaQuant', symbol: 'BTC-USDT', amount: 972.34, pnl: 156.8 },
  { id: 'l2', timestamp: Date.now() - 120000, type: 'execution', level: 'info', title: '开始执行', detail: '收到信号 s-006, 正在下单 Binance', brokerName: 'Binance', providerName: 'WhaleTracker', symbol: 'BTC-USDT' },
  { id: 'l3', timestamp: Date.now() - 180000, type: 'signal', level: 'info', title: '收到信号', detail: 'WhaleTracker 发出 BTC-USDT 买入信号, 置信度 92%', providerName: 'WhaleTracker', symbol: 'BTC-USDT' },
  { id: 'l4', timestamp: Date.now() - 360000, type: 'error', level: 'error', title: '跟单失败', detail: 'AlphaQuant: BNB-USDT 买入失败 - 余额不足', brokerName: 'Binance', providerName: 'AlphaQuant', symbol: 'BNB-USDT' },
  { id: 'l5', timestamp: Date.now() - 600000, type: 'pause', level: 'warn', title: '跟单暂停', detail: '日亏损达到 $500 限额, 自动暂停 30 分钟' },
  { id: 'l6', timestamp: Date.now() - 900000, type: 'resume', level: 'success', title: '跟单恢复', detail: '冷却时间结束, 自动恢复跟单' },
  { id: 'l7', timestamp: Date.now() - 1200000, type: 'fill', level: 'success', title: '跟单成交', detail: 'GoldenCross: SOL-USDT 卖出 5 @ $187.50', brokerName: 'OKX', providerName: 'GoldenCross', symbol: 'SOL-USDT', amount: 937.5, pnl: 42.1 },
  { id: 'l8', timestamp: Date.now() - 1800000, type: 'config', level: 'info', title: '设置变更', detail: '止损从 5%→8%, 止盈从 10%→15%' },
  { id: 'l9', timestamp: Date.now() - 2400000, type: 'cancel', level: 'warn', title: '撤单成功', detail: '手动撤销 BTC-USDT 限价单 (#1234)', brokerName: 'Binance', symbol: 'BTC-USDT' },
  { id: 'l10', timestamp: Date.now() - 3000000, type: 'fill', level: 'success', title: '跟单成交', detail: 'WhaleTracker: ETH-USDT 卖出 0.3 @ $3,850', brokerName: 'OKX', providerName: 'WhaleTracker', symbol: 'ETH-USDT', amount: 1155, pnl: 15.3 },
  { id: 'l11', timestamp: Date.now() - 3600000, type: 'error', level: 'error', title: 'OpenD断连', detail: 'Futu OpenD 连接超时 (120s), 3个信号排队中', brokerName: 'Futu' },
  { id: 'l12', timestamp: Date.now() - 4800000, type: 'signal', level: 'info', title: '收到信号', detail: 'ScalperBot 发出 DOGE-USDT 买入信号, 置信度 78%', providerName: 'ScalperBot', symbol: 'DOGE-USDT' },
];

// ═══════════ Config ═══════════

const TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  signal: { color: '#3b82f6', icon: <ThunderboltOutlined />, label: '信号' },
  execution: { color: '#f59e0b', icon: <SyncOutlined />, label: '执行' },
  fill: { color: '#22c55e', icon: <CheckCircleOutlined />, label: '成交' },
  cancel: { color: '#8b949e', icon: <CloseCircleOutlined />, label: '撤单' },
  error: { color: '#ef4444', icon: <ExclamationCircleOutlined />, label: '错误' },
  pause: { color: '#f97316', icon: <ClockCircleOutlined />, label: '暂停' },
  resume: { color: '#22c55e', icon: <CheckCircleOutlined />, label: '恢复' },
  config: { color: '#a78bfa', icon: <FileTextOutlined />, label: '配置' },
};

const LEVEL_COLORS: Record<string, string> = {
  info: '#8b949e',
  success: '#22c55e',
  warn: '#f59e0b',
  error: '#ef4444',
};

// ── Detail Modal ──

function LogDetailModal({
  entry,
  visible,
  onClose,
}: {
  entry: LogEntry | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;
  const tc = TYPE_CONFIG[entry.type];

  return (
    <Modal
      title={<Space>{tc.icon} <span style={{ color: '#e0e0e0' }}>{tc.label}详情</span></Space>}
      open={visible}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600 }}>{entry.title}</div>
        <div style={{ color: '#8b949e', fontSize: 12 }}>{entry.detail}</div>
        <div style={{ color: '#6b7280', fontSize: 11 }}>
          {dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss')}
        </div>
        {entry.symbol && <Tag color="cyan">{entry.symbol}</Tag>}
        {entry.brokerName && <Tag color="blue">{entry.brokerName}</Tag>}
        {entry.providerName && <Tag color="gold">{entry.providerName}</Tag>}
        {entry.amount !== undefined && (
          <div style={{ color: '#e0e0e0', fontSize: 13 }}>金额: ${entry.amount.toFixed(2)}</div>
        )}
        {entry.pnl !== undefined && (
          <div style={{ color: entry.pnl >= 0 ? '#22c55e' : '#ef4444', fontSize: 13 }}>
            PnL: ${entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── CSV Export (download) ──

function downloadCSV(logs: LogEntry[]) {
  const header = '时间,类型,级别,标题,详情,券商,信号源,币种,金额,PnL';
  const rows = logs.map((l) =>
    [
      dayjs(l.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      l.type,
      l.level,
      l.title,
      `"${l.detail.replace(/"/g, '""')}"`,
      l.brokerName || '',
      l.providerName || '',
      l.symbol || '',
      l.amount || '',
      l.pnl || '',
    ].join(',')
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `copytrade-log-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  message.success('日志已导出');
}

// ── Main CopyTradeLog ──

export default function CopyTradeLog() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const filtered = useMemo(() => {
    return MOCK_LOGS.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (!l.title.toLowerCase().includes(q) && !l.detail.toLowerCase().includes(q) && !(l.symbol || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (typeFilter.length > 0 && !typeFilter.includes(l.type)) return false;
      if (levelFilter.length > 0 && !levelFilter.includes(l.level)) return false;
      if (dateRange[0] && l.timestamp < dateRange[0].valueOf()) return false;
      if (dateRange[1] && l.timestamp > dateRange[1].endOf('day').valueOf()) return false;
      return true;
    });
  }, [search, typeFilter, levelFilter, dateRange]);

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    errors: filtered.filter((l) => l.level === 'error').length,
    fills: filtered.filter((l) => l.type === 'fill').length,
    pauses: filtered.filter((l) => l.type === 'pause').length,
  }), [filtered]);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Filter bar */}
      <Card
        size="small"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 10 }}
        styles={{ body: { padding: '12px' } }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索日志..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 180, background: '#0d0f1a' }}
          />
          <Select
            mode="multiple"
            placeholder="类型"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ minWidth: 140 }}
            options={Object.entries(TYPE_CONFIG).map(([k, v]) => ({
              label: <Space size={4}>{v.icon} {v.label}</Space>,
              value: k,
            }))}
            allowClear
          />
          <Select
            mode="multiple"
            placeholder="级别"
            value={levelFilter}
            onChange={setLevelFilter}
            style={{ minWidth: 110 }}
            options={[
              { label: '✅ 成功', value: 'success' },
              { label: 'ℹ 信息', value: 'info' },
              { label: '⚠ 警告', value: 'warn' },
              { label: '❌ 错误', value: 'error' },
            ]}
            allowClear
          />
          <DatePicker.RangePicker
            value={dateRange as any}
            onChange={(dates) => setDateRange(dates as any)}
            size="small"
            style={{ background: '#0d0f1a' }}
          />
          <div style={{ flex: 1 }} />
          <Space>
            <Tag color="blue" style={{ fontSize: 10 }}>
              <FileTextOutlined /> {stats.total}
            </Tag>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => downloadCSV(filtered)}
              disabled={filtered.length === 0}
            >
              导出CSV
            </Button>
          </Space>
        </div>
      </Card>

      {/* Stat bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 10,
      }}>
        {[
          { label: '总记录', value: stats.total, color: '#e0e0e0' },
          { label: '成交', value: stats.fills, color: '#22c55e' },
          { label: '错误', value: stats.errors, color: '#ef4444' },
          { label: '暂停', value: stats.pauses, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '8px',
            background: '#1a1d2e',
            borderRadius: 6,
            border: '1px solid #2a2d3e',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: '#6b7280' }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <Card
        size="small"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '12px' } }}
      >
        {filtered.length === 0 ? (
          <Empty description="无日志记录" />
        ) : (
          <Timeline
            items={filtered.map((l) => {
              const tc = TYPE_CONFIG[l.type];
              return {
                color: LEVEL_COLORS[l.level] || '#8b949e',
                dot: <span style={{ color: tc.color, fontSize: 14 }}>{tc.icon}</span>,
                children: (
                  <div
                    onClick={() => { setDetailEntry(l); setDetailVisible(true); }}
                    style={{
                      padding: '8px 12px',
                      background: '#0d0f1a',
                      borderRadius: 6,
                      border: `1px solid ${LEVEL_COLORS[l.level]}22`,
                      cursor: 'pointer',
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <span style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 500 }}>{l.title}</span>
                        <Tag color={tc.color} style={{ fontSize: 9, lineHeight: '14px' }}>{tc.label}</Tag>
                      </Space>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>
                        {dayjs(l.timestamp).format('HH:mm:ss')}
                      </span>
                    </div>
                    <div style={{ color: '#8b949e', fontSize: 11, marginTop: 2 }}>{l.detail}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {l.symbol && <Tag color="cyan" style={{ fontSize: 9, lineHeight: '14px' }}>{l.symbol}</Tag>}
                      {l.brokerName && <Tag color="blue" style={{ fontSize: 9, lineHeight: '14px' }}>{l.brokerName}</Tag>}
                      {l.providerName && <Tag color="gold" style={{ fontSize: 9, lineHeight: '14px' }}>{l.providerName}</Tag>}
                    </div>
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      <LogDetailModal entry={detailEntry} visible={detailVisible} onClose={() => setDetailVisible(false)} />
    </div>
  );
}
