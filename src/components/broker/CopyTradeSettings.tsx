// ── R131-M01 CopyTradeSettings — 跟单设置UI ──────────────────────────────
// PM: 选择信号源/金额/止损/券商, 确认启动跟单

import { useState, useCallback } from 'react';
import { Input, Button, Select, Slider, Tag, message, Modal } from 'antd';
import { DollarOutlined, SafetyCertificateOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';

// ═══════════ Types ═══════════

interface SignalProvider {
  id: string;
  name: string;
  exchange: string;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  fee: number; // % of profit
  riskLevel: 'low' | 'medium' | 'high';
  verified: boolean;
}

interface CopyTradeConfig {
  providerId: string;
  brokerId: string;
  maxAmount: number;       // USDT per signal
  maxPositionSize: number; // total USDT
  stopLossPct: number;     // %
  takeProfitPct: number;   // %
  maxSlippage: number;     // %
  enabled: boolean;
  mode: 'fixed' | 'ratio'; // fixed amount or % of provider
  ratioPct?: number;        // if mode=ratio
}

// ═══════════ Mock data ═══════════

const MOCK_SIGNAL_PROVIDERS: SignalProvider[] = [
  { id: 'sp1', name: 'AlphaQuant', exchange: 'Binance', winRate: 64.5, totalReturn: 380, sharpeRatio: 2.4, maxDrawdown: 18, fee: 15, riskLevel: 'medium', verified: true },
  { id: 'sp2', name: 'GoldenCross', exchange: 'Bybit', winRate: 58.2, totalReturn: 210, sharpeRatio: 1.8, maxDrawdown: 25, fee: 12, riskLevel: 'medium', verified: true },
  { id: 'sp3', name: 'ScalperBot', exchange: 'OKX', winRate: 71.3, totalReturn: 156, sharpeRatio: 2.1, maxDrawdown: 12, fee: 20, riskLevel: 'high', verified: false },
  { id: 'sp4', name: 'TrendRider', exchange: 'Bitget', winRate: 52.8, totalReturn: 89, sharpeRatio: 1.2, maxDrawdown: 32, fee: 8, riskLevel: 'low', verified: true },
  { id: 'sp5', name: 'WhaleTracker', exchange: 'Binance', winRate: 67.0, totalReturn: 520, sharpeRatio: 3.1, maxDrawdown: 15, fee: 25, riskLevel: 'low', verified: true },
];

const MOCK_BROKERS = [
  { id: 'binance', name: 'Binance 币安' },
  { id: 'okx', name: 'OKX' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'bitget', name: 'Bitget' },
];

// ═══════════ Component ═══════════

export function CopyTradeSettings() {
  const [providers] = useState(MOCK_SIGNAL_PROVIDERS);
  const [brokers] = useState(MOCK_BROKERS);
  const [config, setConfig] = useState<CopyTradeConfig>(() => {
    try {
      const saved = localStorage.getItem('dw-copytrade-config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      providerId: '', brokerId: 'binance', maxAmount: 1000,
      maxPositionSize: 5000, stopLossPct: 5, takeProfitPct: 10,
      maxSlippage: 0.5, enabled: false, mode: 'fixed', ratioPct: 50,
    };
  });
  const [confirmVisible, setConfirmVisible] = useState(false);

  const provider = providers.find(p => p.id === config.providerId);

  const handleSave = useCallback(() => {
    if (!config.providerId) { message.warning('请选择信号源'); return; }
    try { localStorage.setItem('dw-copytrade-config', JSON.stringify(config)); } catch {}
    message.success('跟单设置已保存');
  }, [config]);

  const handleStart = useCallback(() => {
    if (!config.providerId) { message.warning('请先选择信号源'); return; }
    setConfirmVisible(true);
  }, [config]);

  const handleConfirmStart = useCallback(() => {
    const updated = { ...config, enabled: true };
    setConfig(updated);
    try { localStorage.setItem('dw-copytrade-config', JSON.stringify(updated)); } catch {}
    setConfirmVisible(false);
    message.success('跟单已启动! 系统将自动执行来自 ' + provider?.name + ' 的交易信号');
  }, [config, provider]);

  const handleStop = useCallback(() => {
    const updated = { ...config, enabled: false };
    setConfig(updated);
    try { localStorage.setItem('dw-copytrade-config', JSON.stringify(updated)); } catch {}
    message.info('跟单已暂停');
  }, [config]);

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#e6edf3] text-sm font-bold mb-0.5">跟单设置</h3>
          <p className="text-[#484f58] text-[10px]">自动跟随信号源执行交易</p>
        </div>
        {config.enabled ? (
          <div className="flex items-center gap-2">
            <Tag color="green" className="text-[9px] animate-pulse">● 运行中</Tag>
            <Button danger size="small" icon={<StopOutlined />} onClick={handleStop} className="text-[10px]">暂停</Button>
          </div>
        ) : (
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handleStart} className="text-[10px] bg-[#3b82f6]">启动跟单</Button>
        )}
      </div>

      {/* Signal Provider */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#8b949e] flex items-center gap-1">
          <span>👤</span> 信号源
        </label>
        <Select
          value={config.providerId || undefined}
          onChange={(v) => setConfig(prev => ({ ...prev, providerId: v }))}
          placeholder="选择要跟随的信号源..."
          disabled={config.enabled}
          size="small"
          className="[&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d]"
          options={providers.map(p => ({
            value: p.id,
            label: (
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="flex items-center gap-1">
                  {p.verified && <SafetyCertificateOutlined className="text-[#3b82f6] text-[10px]" />}
                  <span className="text-[#c9d1d9]">{p.name}</span>
                  <Tag className="text-[7px] leading-none px-1" color={p.riskLevel === 'low' ? 'green' : p.riskLevel === 'medium' ? 'orange' : 'red'}>{p.riskLevel}</Tag>
                </span>
                <span className="text-[8px] text-[#484f58]">
                  +{p.totalReturn}% · {p.winRate}%胜率 · 夏普{p.sharpeRatio}
                </span>
              </div>
            ),
          }))}
        />
      </div>

      {/* Provider details */}
      {provider && (
        <div className="px-3 py-2 bg-[#0d1117] border border-[#1c2333] rounded text-[9px]">
          <div className="flex justify-between mb-0.5"><span className="text-[#8b949e]">总收益</span><span className="text-[#22c55e]">+{provider.totalReturn}%</span></div>
          <div className="flex justify-between mb-0.5"><span className="text-[#8b949e]">胜率</span><span className="text-[#c9d1d9]">{provider.winRate}%</span></div>
          <div className="flex justify-between mb-0.5"><span className="text-[#8b949e]">最大回撤</span><span className="text-[#ef4444]">{provider.maxDrawdown}%</span></div>
          <div className="flex justify-between mb-0.5"><span className="text-[#8b949e]">交易平台</span><span className="text-[#c9d1d9]">{provider.exchange}</span></div>
          <div className="flex justify-between"><span className="text-[#8b949e]">利润分润</span><span className="text-[#f59e0b]">{provider.fee}%</span></div>
        </div>
      )}

      {/* Broker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#8b949e] flex items-center gap-1">
          <span>🏦</span> 执行券商
        </label>
        <Select
          value={config.brokerId}
          onChange={(v) => setConfig(prev => ({ ...prev, brokerId: v }))}
          disabled={config.enabled}
          size="small"
          className="[&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[10px]"
          options={brokers.map(b => ({ value: b.id, label: b.name }))}
        />
      </div>

      {/* Amount mode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#8b949e] flex items-center gap-1">
          <DollarOutlined /> 金额设置
        </label>
        <div className="flex gap-2">
          <Select
            value={config.mode}
            onChange={(v) => setConfig(prev => ({ ...prev, mode: v }))}
            size="small"
            className="w-24 [&_.ant-select-selector]:bg-[#0d1117] [&_.ant-select-selector]:border-[#30363d] [&_.ant-select-selection-item]:text-[9px]"
            options={[
              { value: 'fixed', label: '固定金额' },
              { value: 'ratio', label: '按比例' },
            ]}
          />
          {config.mode === 'fixed' ? (
            <Input
              type="number" value={config.maxAmount} min={10} max={100000} step={10}
              onChange={(e) => setConfig(prev => ({ ...prev, maxAmount: Number(e.target.value) }))}
              suffix="USDT"
              disabled={config.enabled}
              className="flex-1 bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs"
            />
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <Slider
                value={config.ratioPct || 50} min={10} max={100}
                onChange={(v) => setConfig(prev => ({ ...prev, ratioPct: v }))}
                disabled={config.enabled}
                className="flex-1"
              />
              <span className="text-[#c9d1d9] text-xs w-12 text-right">{config.ratioPct || 50}%</span>
            </div>
          )}
        </div>
        {config.mode === 'fixed' && (
          <div className="text-[8px] text-[#484f58]">每笔跟单最大投入金额</div>
        )}
      </div>

      {/* Max position */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#8b949e]">最大持仓金额</label>
        <Input
          type="number" value={config.maxPositionSize} min={100} max={100000} step={100}
          onChange={(e) => setConfig(prev => ({ ...prev, maxPositionSize: Number(e.target.value) }))}
          suffix="USDT"
          disabled={config.enabled}
          className="bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs"
        />
        <div className="text-[8px] text-[#484f58]">所有跟单持仓的总金额上限</div>
      </div>

      {/* Stop Loss / Take Profit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#ef4444]">止损 %</label>
          <Input
            type="number" value={config.stopLossPct} min={0.5} max={50} step={0.5}
            onChange={(e) => setConfig(prev => ({ ...prev, stopLossPct: Number(e.target.value) }))}
            suffix="%"
            disabled={config.enabled}
            className="bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#22c55e]">止盈 %</label>
          <Input
            type="number" value={config.takeProfitPct} min={1} max={200} step={1}
            onChange={(e) => setConfig(prev => ({ ...prev, takeProfitPct: Number(e.target.value) }))}
            suffix="%"
            disabled={config.enabled}
            className="bg-[#0d1117] border-[#30363d] text-[#c9d1d9] text-xs"
          />
        </div>
      </div>

      {/* Slippage */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#8b949e]">最大滑点</label>
        <Slider
          value={config.maxSlippage} min={0.1} max={5} step={0.1}
          onChange={(v) => setConfig(prev => ({ ...prev, maxSlippage: v }))}
          disabled={config.enabled}
          marks={{ 0.5: '0.5%', 1: '1%', 3: '3%' }}
        />
      </div>

      {/* Save */}
      {!config.enabled && (
        <Button size="small" onClick={handleSave} className="text-xs">保存设置</Button>
      )}

      {/* Confirmation Modal */}
      <Modal
        open={confirmVisible}
        onCancel={() => setConfirmVisible(false)}
        onOk={handleConfirmStart}
        title="确认启动跟单"
        okText="确认启动"
        cancelText="取消"
      >
        <div className="flex flex-col gap-2 text-xs" style={{ fontFamily: 'monospace' }}>
          <div className="flex justify-between"><span className="text-[#8b949e]">信号源</span><span className="text-[#c9d1d9] font-bold">{provider?.name}</span></div>
          <div className="flex justify-between"><span className="text-[#8b949e]">券商</span><span className="text-[#c9d1d9]">{brokers.find(b => b.id === config.brokerId)?.name}</span></div>
          <div className="flex justify-between"><span className="text-[#8b949e]">每笔金额</span><span className="text-[#c9d1d9]">{config.mode === 'fixed' ? `${config.maxAmount} USDT` : `${config.ratioPct}%`}</span></div>
          <div className="flex justify-between"><span className="text-[#8b949e]">止损</span><span className="text-[#ef4444]">{config.stopLossPct}%</span></div>
          <div className="flex justify-between"><span className="text-[#8b949e]">分润</span><span className="text-[#f59e0b]">{provider?.fee}%</span></div>
          <div className="mt-2 px-2 py-1.5 bg-[#f59e0b10] border border-[#f59e0b30] rounded text-[9px] text-[#f59e0b]">
            ⚠️ 跟单有风险! 请确保已充分了解信号源的历史表现。平台不承担交易损失。
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CopyTradeSettings;
