/**
 * src/components/broker/ArbitragePanel.tsx
 * R3 CONC-08: Arbitrage monitoring panel + cross-broker copy trade UI
 *
 * Visualizes QuoteAggregator.scanArbitrageOpportunities results
 * and provides SmartOrderRouter.copyTrade configuration interface.
 */

import { useState, useMemo } from 'react';
import { ArbitrageEngine, type ArbitrageOpportunity } from '../../lib/chart/arbitrage-engine';

let _abEngine: ArbitrageEngine | null = null;
export function getArbitrageEngine(): ArbitrageEngine {
  if (!_abEngine) _abEngine = new ArbitrageEngine();
  return _abEngine;
}
import { Table, Button, Tag, Badge, Modal, Select, InputNumber, Space, Progress } from 'antd';
import { SwapOutlined, ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useBrokerData } from '../../hooks/useBrokerData';
import { ChartSkeleton, ChartError } from '../chart/ChartStates';

// ── Types ──────────────────────────────────────────────

interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  buyBrokerId: string;
  buyBrokerName: string;
  buyPrice: number;
  sellBrokerId: string;
  sellBrokerName: string;
  sellPrice: number;
  spreadPercent: number;
  estimatedProfit: number;
  timestamp: number;
}

interface CopyTradeConfig {
  id: string;
  sourceBrokerId: string;
  sourceBrokerName: string;
  targetBrokers: string[];
  ratio: number; // 0.1 ~ 1.0
  enabled: boolean;
  symbol?: string;
}

// ── Mock data ──────────────────────────────────────────

const MOCK_OPPORTUNITIES: ArbitrageOpportunity[] = [
  { id: 'ARB001', symbol: 'BTC-USDT', buyBrokerId: 'bybit', buyBrokerName: 'Bybit', buyPrice: 98230.5, sellBrokerId: 'binance', sellBrokerName: 'Binance', sellPrice: 98234.5, spreadPercent: 0.004, estimatedProfit: 4.0, timestamp: Date.now() - 30000 },
  { id: 'ARB002', symbol: 'ETH-USDT', buyBrokerId: 'okx', buyBrokerName: 'OKX', buyPrice: 5430.2, sellBrokerId: 'bitget', sellBrokerName: 'Bitget', sellPrice: 5432.8, spreadPercent: 0.048, estimatedProfit: 48.0, timestamp: Date.now() - 60000 },
  { id: 'ARB003', symbol: 'SOL-USDT', buyBrokerId: 'bitget', buyBrokerName: 'Bitget', buyPrice: 187.28, sellBrokerId: 'binance', sellBrokerName: 'Binance', sellPrice: 187.45, spreadPercent: 0.091, estimatedProfit: 91.0, timestamp: Date.now() - 120000 },
  { id: 'ARB004', symbol: 'DOGE-USDT', buyBrokerId: 'bybit', buyBrokerName: 'Bybit', buyPrice: 0.1232, sellBrokerId: 'binance', sellBrokerName: 'Binance', sellPrice: 0.1235, spreadPercent: 0.243, estimatedProfit: 243.0, timestamp: Date.now() - 180000 },
];

const MOCK_COPY_CONFIGS: CopyTradeConfig[] = [
  { id: 'CT001', sourceBrokerId: 'binance', sourceBrokerName: 'Binance', targetBrokers: ['okx', 'bybit'], ratio: 1.0, enabled: true, symbol: 'BTC-USDT' },
  { id: 'CT002', sourceBrokerId: 'futu', sourceBrokerName: 'Futu', targetBrokers: ['binance'], ratio: 0.5, enabled: false, symbol: '00700.HK' },
];

const BROKERS = [
  { id: 'binance', name: 'Binance', color: '#F0B90B' },
  { id: 'okx', name: 'OKX', color: '#00A2FF' },
  { id: 'bybit', name: 'Bybit', color: '#F7A600' },
  { id: 'bitget', name: 'Bitget', color: '#03A9F4' },
  { id: 'futu', name: 'Futu', color: '#22C55E' },
];

// ── Component ──────────────────────────────────────────

export default function ArbitragePanel() {
  const { data: ipdOpps, loading, error, refetch, source } = useBrokerData<ArbitrageOpportunity[]>({
    channel: 'broker:scanArbitrage',
    params: { threshold: 0.05 },
    mockData: MOCK_OPPORTUNITIES,
    pollInterval: 3000,
  });
  const [opportunities] = useState(ipdOpps || MOCK_OPPORTUNITIES);
  const [copyConfigs, setCopyConfigs] = useState(MOCK_COPY_CONFIGS);
  const [addModal, setAddModal] = useState(false);
  const [scanThreshold, setScanThreshold] = useState(0.05); // 0.05%
  const [newConfig, setNewConfig] = useState<Partial<CopyTradeConfig>>({
    sourceBrokerId: 'binance',
    targetBrokers: ['okx'],
    ratio: 1.0,
    enabled: true,
  });

  const filtered = useMemo(() => {
    return opportunities.filter(o => o.spreadPercent >= scanThreshold);
  }, [opportunities, scanThreshold]);

  const toggleCopy = (id: string) => {
    setCopyConfigs(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const addCopyConfig = () => {
    if (!newConfig.sourceBrokerId || (newConfig.targetBrokers || []).length === 0) return;
    setCopyConfigs(prev => [...prev, {
      id: `CT${Date.now()}`,
      sourceBrokerId: newConfig.sourceBrokerId!,
      sourceBrokerName: BROKERS.find(b => b.id === newConfig.sourceBrokerId)?.name || '',
      targetBrokers: newConfig.targetBrokers!,
      ratio: newConfig.ratio || 1.0,
      enabled: true,
      symbol: newConfig.symbol,
    }]);
    setAddModal(false);
    setNewConfig({ sourceBrokerId: 'binance', targetBrokers: ['okx'], ratio: 1.0, enabled: true });
  };

  const arbColumns: ColumnsType<ArbitrageOpportunity> = [
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', width: 120, render: (s: string) => <span className="text-white font-mono font-bold">{s}</span> },
    { title: 'Buy At', key: 'buy', width: 180, render: (_: unknown, r: ArbitrageOpportunity) => (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BROKERS.find(b => b.id === r.buyBrokerId)?.color }} />
        <span className="text-gray-300 text-xs">{r.buyBrokerName}</span>
        <span className="text-green-400 font-mono text-xs">{r.buyPrice.toLocaleString()}</span>
      </div>
    )},
    { title: '', key: 'arrow', width: 40, render: () => <SwapOutlined className="text-gray-500" /> },
    { title: 'Sell At', key: 'sell', width: 180, render: (_: unknown, r: ArbitrageOpportunity) => (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BROKERS.find(b => b.id === r.sellBrokerId)?.color }} />
        <span className="text-gray-300 text-xs">{r.sellBrokerName}</span>
        <span className="text-red-400 font-mono text-xs">{r.sellPrice.toLocaleString()}</span>
      </div>
    )},
    { title: 'Spread', dataIndex: 'spreadPercent', key: 'spread', width: 100, render: (v: number) => (
      <Tag color={v > 0.15 ? 'red' : v > 0.05 ? 'orange' : 'green'}>{v.toFixed(3)}%</Tag>
    )},
    { title: 'Est. Profit', dataIndex: 'estimatedProfit', key: 'profit', width: 110, render: (v: number) => (
      <span className="text-green-400 font-mono">+${v.toFixed(2)}</span>
    )},
    { title: 'Age', dataIndex: 'timestamp', key: 'age', width: 80, render: (ts: number) => {
      const sec = Math.floor((Date.now() - ts) / 1000);
      return <span className="text-gray-500">{sec}s ago</span>;
    }},
  ];

  const copyColumns: ColumnsType<CopyTradeConfig> = [
    { title: 'Signal', key: 'source', width: 150, render: (_: unknown, r: CopyTradeConfig) => (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BROKERS.find(b => b.id === r.sourceBrokerId)?.color }} />
        <span className="text-white text-xs">{r.sourceBrokerName}</span>
      </div>
    )},
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', width: 120, render: (s?: string) => <span className="text-gray-400 text-xs">{s || 'ALL'}</span> },
    { title: 'Target', key: 'targets', render: (_: unknown, r: CopyTradeConfig) => (
      <Space size={4}>
        {r.targetBrokers.map(t => {
          const b = BROKERS.find(x => x.id === t);
          return <Tag key={t} color={b?.color} className="text-[10px]">{b?.name || t}</Tag>;
        })}
      </Space>
    )},
    { title: 'Ratio', dataIndex: 'ratio', key: 'ratio', width: 100, render: (r: number) => (
      <Progress percent={r * 100} size="small" showInfo={true} format={() => `${Math.round(r * 100)}%`} strokeColor={r === 1 ? '#52c41a' : '#1890ff'} />
    )},
    { title: 'Status', key: 'enabled', width: 100, render: (_: unknown, r: CopyTradeConfig) => (
      r.enabled ? <Badge status="processing" text="Active" /> : <Badge status="default" text="Paused" />
    )},
    { title: 'Action', key: 'action', width: 100, render: (_: unknown, r: CopyTradeConfig) => (
      <Button size="small" type={r.enabled ? 'default' : 'primary'} onClick={() => toggleCopy(r.id)}>
        {r.enabled ? 'Pause' : 'Resume'}
      </Button>
    )},
  ];

  if (loading) return <ChartSkeleton rows={5} />;
  if (error) return <ChartError title="套利扫描失败" message={error} onRetry={refetch} />;

  return (
    <div className="p-4 space-y-6">
      {/* ── Arbitrage Opportunities ── */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <ThunderboltOutlined className="text-yellow-400" />
            Arbitrage Opportunities
            {source === 'ipc' && <Tag color="green" className="text-[8px]">LIVE</Tag>}
          </h3>
          <Space>
            <span className="text-gray-400 text-xs">Min spread:</span>
            <Select
              value={scanThreshold}
              onChange={setScanThreshold}
              size="small"
              style={{ width: 100 }}
              options={[
                { label: '0.01%', value: 0.01 },
                { label: '0.05%', value: 0.05 },
                { label: '0.10%', value: 0.10 },
                { label: '0.15%', value: 0.15 },
              ]}
            />
            <Tag color="blue">{filtered.length} opportunities</Tag>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={arbColumns}
          dataSource={filtered}
          pagination={{ pageSize: 10, size: 'small' }}
          size="small"
          locale={{ emptyText: 'No arbitrage found above threshold' }}
        />
      </div>

      {/* ── Copy Trade Config ── */}
      <div className="bg-[#1a1a2e] border border-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <CopyOutlined className="text-blue-400" />
            Copy Trade Configuration
          </h3>
          <Button type="primary" size="small" icon={<CopyOutlined />} onClick={() => setAddModal(true)}>
            Add Copy Config
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={copyColumns}
          dataSource={copyConfigs}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No copy trade configs' }}
        />
      </div>

      {/* Add Modal */}
      <Modal
        title="New Copy Trade Configuration"
        open={addModal}
        onCancel={() => setAddModal(false)}
        onOk={addCopyConfig}
        okText="Add"
      >
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs block mb-1">Signal Source Broker</label>
            <Select
              value={newConfig.sourceBrokerId}
              onChange={(v) => setNewConfig(p => ({ ...p, sourceBrokerId: v }))}
              style={{ width: '100%' }}
              options={BROKERS.map(b => ({ label: b.name, value: b.id }))}
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Target Brokers</label>
            <Select
              mode="multiple"
              value={newConfig.targetBrokers}
              onChange={(v) => setNewConfig(p => ({ ...p, targetBrokers: v }))}
              style={{ width: '100%' }}
              options={BROKERS.filter(b => b.id !== newConfig.sourceBrokerId).map(b => ({ label: b.name, value: b.id }))}
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Copy Ratio</label>
            <InputNumber
              value={newConfig.ratio}
              onChange={(v) => setNewConfig(p => ({ ...p, ratio: v ?? 1.0 }))}
              min={0.1}
              max={1.0}
              step={0.1}
              style={{ width: '100%' }}
              addonAfter="× signal size"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Symbol (optional, leave empty for ALL)</label>
            <Select
              value={newConfig.symbol}
              onChange={(v) => setNewConfig(p => ({ ...p, symbol: v }))}
              style={{ width: '100%' }}
              allowClear
              placeholder="All symbols"
              options={['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT'].map(s => ({ label: s, value: s }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
