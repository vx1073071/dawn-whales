// @ts-nocheck
// ── R139-M01 PauseRulesPanel — 暂停规则UI (亏N→停/连亏N→停/断路器) ──────
// PM: P1-6, 3h

import { useState, useCallback } from 'react';
import {
  Card, Switch, InputNumber, Slider, Space, Tag, Button, Alert, message,
  Descriptions, Badge,
} from 'antd';
import {
  PauseCircleOutlined, DollarOutlined, FallOutlined,
  ThunderboltOutlined, SafetyCertificateOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';

interface PauseRules {
  dailyLossLimit: number;       // USDT, 0=disabled
  consecutiveLossLimit: number;  // consecutive losing trades, 0=disabled
  maxDrawdownPct: number;        // % from peak, 0=disabled
  cooldownMinutes: number;       // minutes to pause after trigger
  autoResume: boolean;           // auto resume after cooldown
}

interface CircuitBreakerState {
  triggered: boolean;
  triggerReason: string;
  triggeredAt: number;
  cooldownUntil: number;
  dailyLoss: number;
  consecutiveLosses: number;
  maxDrawdown: number;
  drawdownFromPeak: number;
}

// ── Main PauseRulesPanel ──

export default function PauseRulesPanel() {
  const [rules, setRules] = useState<PauseRules>(() => {
    try {
      const saved = localStorage.getItem('dw:ct:pauseRules');
      return saved ? JSON.parse(saved) : {
        dailyLossLimit: 500,
        consecutiveLossLimit: 3,
        maxDrawdownPct: 8,
        cooldownMinutes: 30,
        autoResume: false,
      };
    } catch {
      return {
        dailyLossLimit: 500,
        consecutiveLossLimit: 3,
        maxDrawdownPct: 8,
        cooldownMinutes: 30,
        autoResume: false,
      };
    }
  });

  // Mock breaker state
  const [breaker, setBreaker] = useState<CircuitBreakerState>({
    triggered: false,
    triggerReason: '',
    triggeredAt: 0,
    cooldownUntil: 0,
    dailyLoss: 234.5,
    consecutiveLosses: 1,
    maxDrawdown: 3500,
    drawdownFromPeak: 4.2,
  });

  const handleSave = useCallback(() => {
    try { localStorage.setItem('dw:ct:pauseRules', JSON.stringify(rules)); } catch {}
    message.success('暂停规则已保存');
  }, [rules]);

  const handleResetBreaker = useCallback(() => {
    setBreaker((p) => ({ ...p, triggered: false, triggerReason: '', triggeredAt: 0, cooldownUntil: 0, dailyLoss: 0, consecutiveLosses: 0 }));
    message.info('断路器已重置');
  }, []);

  const updateRule = useCallback((key: keyof PauseRules, value: any) => {
    setRules((p) => ({ ...p, [key]: value }));
  }, []);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Breaker status */}
      <Card
        size="small"
        style={{
          background: breaker.triggered ? '#2e0a0a' : '#1a2e1a',
          border: `1px solid ${breaker.triggered ? '#ef444444' : '#22c55e44'}`,
          borderRadius: 10,
          marginBottom: 12,
        }}
        styles={{ body: { padding: '14px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ThunderboltOutlined style={{ fontSize: 18, color: breaker.triggered ? '#ef4444' : '#22c55e' }} />
            <div>
              <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600 }}>
                {breaker.triggered ? '⛔ 跟单已暂停' : '✅ 正常运行中'}
              </div>
              <div style={{ color: '#8b949e', fontSize: 11 }}>
                {breaker.triggered
                  ? `原因: ${breaker.triggerReason} · 冷却至 ${new Date(breaker.cooldownUntil).toLocaleTimeString()}`
                  : '未触发任何暂停规则'}
              </div>
            </div>
          </Space>
          {breaker.triggered && (
            <Button size="small" danger onClick={handleResetBreaker} icon={<ReloadOutlined />}>
              手动恢复
            </Button>
          )}
        </div>

        {/* Live stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginTop: 10,
        }}>
          {[
            { label: '今日亏损', value: `$${breaker.dailyLoss.toFixed(1)}`, warn: breaker.dailyLoss >= rules.dailyLossLimit && rules.dailyLossLimit > 0 },
            { label: '连亏次数', value: `${breaker.consecutiveLosses}`, warn: breaker.consecutiveLosses >= rules.consecutiveLossLimit && rules.consecutiveLossLimit > 0 },
            { label: '最大回撤', value: `$${breaker.maxDrawdown.toLocaleString()}`, warn: false },
            { label: '距峰值', value: `${breaker.drawdownFromPeak}%`, warn: breaker.drawdownFromPeak >= rules.maxDrawdownPct && rules.maxDrawdownPct > 0 },
          ].map((s) => (
            <div key={s.label} style={{
              padding: '6px 8px',
              background: s.warn ? '#2e0a0a' : '#0d0f1a',
              borderRadius: 6,
              textAlign: 'center',
              border: s.warn ? '1px solid #ef444433' : 'none',
            }}>
              <div style={{ fontSize: 9, color: s.warn ? '#ef4444' : '#6b7280' }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.warn ? '#ef4444' : '#e0e0e0', fontFamily: 'monospace' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Rules */}
      <Card
        size="small"
        title={<Space><SafetyCertificateOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#e0e0e0', fontSize: 14 }}>暂停规则</span></Space>}
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '14px' } }}
      >
        {/* Daily loss limit */}
        <div style={{
          padding: '12px',
          background: '#0d0f1a',
          borderRadius: 8,
          marginBottom: 10,
          border: rules.dailyLossLimit > 0 ? '1px solid #ef444422' : '1px solid #2a2d3e',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <DollarOutlined style={{ color: '#ef4444' }} />
              <span style={{ color: '#e0e0e0', fontSize: 13 }}>日亏损限额</span>
              <Tag color={rules.dailyLossLimit > 0 ? 'red' : 'default'}>
                {rules.dailyLossLimit > 0 ? `$${rules.dailyLossLimit}` : '关闭'}
              </Tag>
            </Space>
            <Switch
              size="small"
              checked={rules.dailyLossLimit > 0}
              onChange={(v) => updateRule('dailyLossLimit', v ? 500 : 0)}
            />
          </div>
          {rules.dailyLossLimit > 0 && (
            <div style={{ padding: '0 8px' }}>
              <Slider
                min={100}
                max={5000}
                step={50}
                value={rules.dailyLossLimit}
                onChange={(v) => updateRule('dailyLossLimit', v)}
                marks={{ 500: '$500', 1000: '$1K', 2500: '$2.5K', 5000: '$5K' }}
                styles={{ track: { background: '#ef4444' } }}
              />
              <div style={{ fontSize: 10, color: '#8b949e' }}>
                当日累计亏损达到 ${rules.dailyLossLimit} 时自动暂停所有跟单
              </div>
            </div>
          )}
        </div>

        {/* Consecutive loss limit */}
        <div style={{
          padding: '12px',
          background: '#0d0f1a',
          borderRadius: 8,
          marginBottom: 10,
          border: rules.consecutiveLossLimit > 0 ? '1px solid #ef444422' : '1px solid #2a2d3e',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <FallOutlined style={{ color: '#f59e0b' }} />
              <span style={{ color: '#e0e0e0', fontSize: 13 }}>连亏暂停</span>
              <Tag color={rules.consecutiveLossLimit > 0 ? 'gold' : 'default'}>
                {rules.consecutiveLossLimit > 0 ? `${rules.consecutiveLossLimit} 笔` : '关闭'}
              </Tag>
            </Space>
            <Switch
              size="small"
              checked={rules.consecutiveLossLimit > 0}
              onChange={(v) => updateRule('consecutiveLossLimit', v ? 3 : 0)}
            />
          </div>
          {rules.consecutiveLossLimit > 0 && (
            <div style={{ padding: '0 8px' }}>
              <InputNumber
                min={1}
                max={10}
                value={rules.consecutiveLossLimit}
                onChange={(v) => updateRule('consecutiveLossLimit', v || 3)}
                addonBefore="连续亏损"
                addonAfter="笔后暂停"
                style={{ width: '100%', marginBottom: 8 }}
              />
              <div style={{ fontSize: 10, color: '#8b949e' }}>
                连续亏损 {rules.consecutiveLossLimit} 笔后自动暂停，避免情绪化跟单
              </div>
            </div>
          )}
        </div>

        {/* Max drawdown */}
        <div style={{
          padding: '12px',
          background: '#0d0f1a',
          borderRadius: 8,
          marginBottom: 10,
          border: rules.maxDrawdownPct > 0 ? '1px solid #f9731622' : '1px solid #2a2d3e',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <ThunderboltOutlined style={{ color: '#f97316' }} />
              <span style={{ color: '#e0e0e0', fontSize: 13 }}>最大回撤</span>
              <Tag color={rules.maxDrawdownPct > 0 ? 'orange' : 'default'}>
                {rules.maxDrawdownPct > 0 ? `${rules.maxDrawdownPct}%` : '关闭'}
              </Tag>
            </Space>
            <Switch
              size="small"
              checked={rules.maxDrawdownPct > 0}
              onChange={(v) => updateRule('maxDrawdownPct', v ? 8 : 0)}
            />
          </div>
          {rules.maxDrawdownPct > 0 && (
            <div style={{ padding: '0 8px' }}>
              <Slider
                min={3}
                max={30}
                step={1}
                value={rules.maxDrawdownPct}
                onChange={(v) => updateRule('maxDrawdownPct', v)}
                marks={{ 5: '5%', 10: '10%', 20: '20%', 30: '30%' }}
                styles={{ track: { background: '#f97316' } }}
              />
              <div style={{ fontSize: 10, color: '#8b949e' }}>
                从最高点回撤 {rules.maxDrawdownPct}% 时自动暂停
              </div>
            </div>
          )}
        </div>

        {/* Cooldown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 12,
        }}>
          <div style={{
            padding: '10px',
            background: '#0d0f1a',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Space>
              <PauseCircleOutlined style={{ color: '#3b82f6' }} />
              <div>
                <div style={{ color: '#e0e0e0', fontSize: 12 }}>冷却时间</div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>触发后暂停时长</div>
              </div>
            </Space>
            <InputNumber
              min={5}
              max={240}
              value={rules.cooldownMinutes}
              onChange={(v) => updateRule('cooldownMinutes', v || 30)}
              addonAfter="分钟"
              size="small"
              style={{ width: 120 }}
            />
          </div>
          <div style={{
            padding: '10px',
            background: '#0d0f1a',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Space>
              <ReloadOutlined style={{ color: '#22c55e' }} />
              <div>
                <div style={{ color: '#e0e0e0', fontSize: 12 }}>自动恢复</div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>冷却后自动重启</div>
              </div>
            </Space>
            <Switch
              size="small"
              checked={rules.autoResume}
              onChange={(v) => updateRule('autoResume', v)}
            />
          </div>
        </div>

        <Button type="primary" onClick={handleSave} block style={{ marginTop: 12 }}>
          保存规则
        </Button>
      </Card>

      {/* Warning */}
      <Alert
        message="暂停规则生效后，所有跟单信号将在冷却期间自动排队。规则不限制手动交易。"
        type="warning"
        showIcon
        style={{ background: '#2e2a1a', border: '1px solid #f59e0b33', borderRadius: 8 }}
        styles={{ message: { color: '#e0e0e0', fontSize: 11 } }}
      />
    </div>
  );
}
