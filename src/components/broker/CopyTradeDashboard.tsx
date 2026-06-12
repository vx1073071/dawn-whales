// @ts-nocheck
// ── R134-M02 CopyTradeDashboard — 跟单仪表盘 (总资产/总收益/各券商分布) ──
// PM: 全局跟单状态一览

import { useState, useMemo } from 'react';
import {
  Card, Statistic, Tag, Space, Tooltip, Progress, Badge, Empty,
} from 'antd';
import {
  DollarOutlined, RiseOutlined, FallOutlined, PieChartOutlined,
  ThunderboltOutlined, SyncOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WalletOutlined, TrophyOutlined,
  BankOutlined, UserOutlined, TeamOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';

// ═══════════ Types ═══════════

interface BrokerPnL {
  brokerId: string;
  brokerName: string;
  icon: string;
  market: string;
  totalAsset: number;
  availableBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  todayPnL: number;
  pnlPct: number;
  positionCount: number;
  copyTradeCount: number;
  signalHitRate: number;
  status: 'active' | 'paused' | 'disconnected';
}

interface CopyTradeSummary {
  totalAsset: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalTodayPnL: number;
  totalYield: number;
  activeCopyTrades: number;
  pausedCopyTrades: number;
  signalReceived24h: number;
  signalExecuted24h: number;
  hitRate24h: number;
}

// ═══════════ Mock data ═══════════

const MOCK_BROKER_PNLS: BrokerPnL[] = [
  { brokerId: 'futu', brokerName: 'Futu', icon: '🐂', market: 'HK/US', totalAsset: 1523400, availableBalance: 234500, unrealizedPnL: 45600, realizedPnL: 128900, todayPnL: 3400, pnlPct: 2.3, positionCount: 12, copyTradeCount: 8, signalHitRate: 68, status: 'active' },
  { brokerId: 'binance', brokerName: 'Binance', icon: '🟡', market: 'Crypto', totalAsset: 892000, availableBalance: 123000, unrealizedPnL: 34200, realizedPnL: 56700, todayPnL: -2100, pnlPct: -1.2, positionCount: 5, copyTradeCount: 5, signalHitRate: 72, status: 'active' },
  { brokerId: 'okx', brokerName: 'OKX', icon: '⬜', market: 'Crypto', totalAsset: 456000, availableBalance: 67000, unrealizedPnL: 12300, realizedPnL: 23400, todayPnL: 890, pnlPct: 1.8, positionCount: 3, copyTradeCount: 3, signalHitRate: 65, status: 'active' },
  { brokerId: 'ib', brokerName: 'IBKR', icon: '🏦', market: 'US/Global', totalAsset: 345000, availableBalance: 345000, unrealizedPnL: 0, realizedPnL: 0, todayPnL: 0, pnlPct: 0, positionCount: 0, copyTradeCount: 0, signalHitRate: 0, status: 'disconnected' },
  { brokerId: 'tiger', brokerName: 'Tiger', icon: '🐯', market: 'US/HK', totalAsset: 234000, availableBalance: 120000, unrealizedPnL: 8900, realizedPnL: 4500, todayPnL: 1200, pnlPct: 0.9, positionCount: 4, copyTradeCount: 2, signalHitRate: 55, status: 'active' },
  { brokerId: 'bybit', brokerName: 'Bybit', icon: '🟠', market: 'Crypto', totalAsset: 312000, availableBalance: 45000, unrealizedPnL: -8900, realizedPnL: 15600, todayPnL: -3400, pnlPct: -2.8, positionCount: 2, copyTradeCount: 2, signalHitRate: 60, status: 'paused' },
  { brokerId: 'longbridge', brokerName: 'Longbridge', icon: '🌉', market: 'HK/US', totalAsset: 89000, availableBalance: 89000, unrealizedPnL: 0, realizedPnL: 0, todayPnL: 0, pnlPct: 0, positionCount: 0, copyTradeCount: 0, signalHitRate: 0, status: 'disconnected' },
];

// ═══════════ Sub-components ═══════════

// ── Asset Distribution Bar (CSS horizontal) ──

function AssetDistributionBar({ brokers, total }: { brokers: BrokerPnL[]; total: number }) {
  const COLORS = ['#F0B90B', '#22c55e', '#3b82f6', '#a78bfa', '#f59e0b', '#f97316', '#ec4899', '#8b949e'];

  if (total === 0) return <Empty description="无资产" />;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        height: 28,
        display: 'flex',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#0d0f1a',
        border: '1px solid #2a2d3e',
      }}>
        {brokers
          .filter((b) => b.totalAsset > 0)
          .map((b, i) => (
            <Tooltip key={b.brokerId} title={`${b.brokerName}: $${b.totalAsset.toLocaleString()} (${((b.totalAsset / total) * 100).toFixed(1)}%)`}>
              <div
                style={{
                  width: `${(b.totalAsset / total) * 100}%`,
                  height: '100%',
                  background: COLORS[i % COLORS.length],
                  minWidth: 2,
                  transition: 'width 0.3s ease',
                }}
              />
            </Tooltip>
          ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontSize: 11 }}>
        {brokers
          .filter((b) => b.totalAsset > 0)
          .map((b, i) => (
            <Space key={b.brokerId} size={4}>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: COLORS[i % COLORS.length],
                display: 'inline-block',
              }} />
              <span style={{ color: '#8b949e' }}>{b.brokerName}</span>
              <span style={{ color: '#e0e0e0', fontWeight: 600 }}>
                ${(b.totalAsset / 1000).toFixed(0)}K
              </span>
            </Space>
          ))}
      </div>
    </div>
  );
}

// ── Broker PnL Card ──

function BrokerPnLCard({ broker }: { broker: BrokerPnL }) {
  const isConnected = broker.status !== 'disconnected';
  const isPositive = broker.todayPnL >= 0;

  return (
    <Card
      size="small"
      style={{
        background: broker.status === 'active' ? '#1a2e1a' : broker.status === 'paused' ? '#2e2a1a' : '#1a1d2e',
        border: `1px solid ${broker.status === 'active' ? '#22c55e33' : broker.status === 'paused' ? '#f59e0b33' : '#2a2d3e'}`,
        borderRadius: 10,
        marginBottom: 10,
      }}
      styles={{ body: { padding: '14px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Space size={8}>
          <span style={{ fontSize: 22 }}>{broker.icon}</span>
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{broker.brokerName}</div>
            <Tag color="cyan" style={{ fontSize: 9, lineHeight: '14px' }}>{broker.market}</Tag>
          </div>
        </Space>
        <Space>
          <Badge
            color={broker.status === 'active' ? '#22c55e' : broker.status === 'paused' ? '#f59e0b' : '#ef4444'}
            text={
              <span style={{ fontSize: 11, color: '#8b949e' }}>
                {broker.status === 'active' ? '活跃' : broker.status === 'paused' ? '暂停' : '断开'}
              </span>
            }
          />
          {broker.copyTradeCount > 0 && (
            <Tag color="blue">{broker.copyTradeCount} 跟单</Tag>
          )}
        </Space>
      </div>

      {/* Asset & PnL row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>总资产</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>
            ${(broker.totalAsset / 1000).toFixed(0)}<span style={{ fontSize: 12 }}>K</span>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>持仓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>
            {broker.positionCount}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>今日</div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: isPositive ? '#22c55e' : '#ef4444',
            fontFamily: 'monospace',
          }}>
            {isPositive ? '+' : ''}${(broker.todayPnL / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      {/* Detail row */}
      {isConnected && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          padding: '6px 10px',
          background: '#0d0f1a',
          borderRadius: 6,
          fontSize: 10,
          color: '#8b949e',
        }}>
          <div>浮盈 <span style={{ color: broker.unrealizedPnL >= 0 ? '#22c55e' : '#ef4444' }}>
            ${broker.unrealizedPnL >= 0 ? '+' : ''}{broker.unrealizedPnL.toLocaleString()}
          </span></div>
          <div>已实现 <span style={{ color: broker.realizedPnL >= 0 ? '#22c55e' : '#ef4444' }}>
            ${broker.realizedPnL >= 0 ? '+' : ''}{broker.realizedPnL.toLocaleString()}
          </span></div>
          <div>命中率 <span style={{ color: '#e0e0e0' }}>{broker.signalHitRate}%</span></div>
        </div>
      )}

      {/* PnL progress */}
      {isConnected && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
            <span>收益率</span>
            <span style={{ color: broker.pnlPct >= 0 ? '#22c55e' : '#ef4444' }}>
              {broker.pnlPct >= 0 ? '+' : ''}{broker.pnlPct}%
            </span>
          </div>
          <Progress
            percent={Math.abs(broker.pnlPct) * 10}
            size="small"
            showInfo={false}
            strokeColor={broker.pnlPct >= 0 ? '#22c55e' : '#ef4444'}
            trailColor="#1e2030"
          />
        </div>
      )}
    </Card>
  );
}

// ── Main CopyTradeDashboard ──

export default function CopyTradeDashboard() {
  const summary: CopyTradeSummary = useMemo(() => {
    const b = MOCK_BROKER_PNLS;
    return {
      totalAsset: b.reduce((s, x) => s + x.totalAsset, 0),
      totalUnrealizedPnL: b.reduce((s, x) => s + x.unrealizedPnL, 0),
      totalRealizedPnL: b.reduce((s, x) => s + x.realizedPnL, 0),
      totalTodayPnL: b.reduce((s, x) => s + x.todayPnL, 0),
      totalYield: b.reduce((s, x) => s + x.totalAsset, 0) > 0
        ? +((b.reduce((s, x) => s + x.realizedPnL + x.unrealizedPnL, 0) / b.reduce((s, x) => s + x.totalAsset, 0)) * 100).toFixed(1)
        : 0,
      activeCopyTrades: b.filter((x) => x.status === 'active').length,
      pausedCopyTrades: b.filter((x) => x.status === 'paused').length,
      signalReceived24h: 47,
      signalExecuted24h: 31,
      hitRate24h: 66,
    };
  }, []);

  const activeBrokers = MOCK_BROKER_PNLS.filter((b) => b.status !== 'disconnected');
  const isTodayPositive = summary.totalTodayPnL >= 0;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        {/* Total Asset */}
        <Card size="small" styles={{ body: { padding: '14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={6} style={{ marginBottom: 4 }}>
            <WalletOutlined style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>总资产</span>
          </Space>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#e0e0e0', fontFamily: 'monospace' }}>
            ${(summary.totalAsset / 1000000).toFixed(2)}<span style={{ fontSize: 14 }}>M</span>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>
            覆盖 {activeBrokers.length} 个券商
          </div>
        </Card>

        {/* Today PnL */}
        <Card size="small" styles={{ body: { padding: '14px' } }} style={{
          background: isTodayPositive ? '#0a2e0a' : '#2e0a0a',
          border: `1px solid ${isTodayPositive ? '#22c55e33' : '#ef444433'}`,
          borderRadius: 10,
        }}>
          <Space size={6} style={{ marginBottom: 4 }}>
            {isTodayPositive ? <RiseOutlined style={{ color: '#22c55e' }} /> : <FallOutlined style={{ color: '#ef4444' }} />}
            <span style={{ fontSize: 11, color: '#6b7280' }}>今日收益</span>
          </Space>
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            color: isTodayPositive ? '#22c55e' : '#ef4444',
            fontFamily: 'monospace',
          }}>
            {isTodayPositive ? '+' : ''}${summary.totalTodayPnL.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>
            {isTodayPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {' '}{getTimeString()}
          </div>
        </Card>

        {/* Realized PnL */}
        <Card size="small" styles={{ body: { padding: '14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={6} style={{ marginBottom: 4 }}>
            <TrophyOutlined style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>已实现收益</span>
          </Space>
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            color: summary.totalRealizedPnL >= 0 ? '#e0e0e0' : '#ef4444',
            fontFamily: 'monospace',
          }}>
            ${(summary.totalRealizedPnL / 1000).toFixed(1)}<span style={{ fontSize: 14 }}>K</span>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>总收益率 {summary.totalYield >= 0 ? '+' : ''}{summary.totalYield}%</div>
        </Card>

        {/* Signal stats */}
        <Card size="small" styles={{ body: { padding: '14px' } }} style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}>
          <Space size={6} style={{ marginBottom: 4 }}>
            <ThunderboltOutlined style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>24h信号</span>
          </Space>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#e0e0e0', fontFamily: 'monospace' }}>
            {summary.signalExecuted24h}<span style={{ fontSize: 14, color: '#8b949e' }}>/{summary.signalReceived24h}</span>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>执行率 {summary.hitRate24h}%</div>
        </Card>
      </div>

      {/* Asset Distribution */}
      <Card
        size="small"
        title={
          <Space>
            <PieChartOutlined style={{ color: '#3b82f6' }} />
            <span style={{ color: '#e0e0e0', fontSize: 14 }}>资产分布</span>
          </Space>
        }
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}
        styles={{ body: { padding: '16px' } }}
      >
        <AssetDistributionBar brokers={activeBrokers} total={summary.totalAsset} />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginTop: 14,
        }}>
          {activeBrokers
            .sort((a, b) => b.totalAsset - a.totalAsset)
            .map((b) => (
              <div key={b.brokerId} style={{
                padding: '8px',
                background: '#0d0f1a',
                borderRadius: 6,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{b.icon} {b.brokerName}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>
                  ${(b.totalAsset / 1000).toFixed(0)}K
                </div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>
                  {((b.totalAsset / summary.totalAsset) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Per-broker PnL Cards */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600, marginBottom: 10, padding: '0 4px' }}>
          📊 各券商详情
        </div>
        {MOCK_BROKER_PNLS.map((broker) => (
          <BrokerPnLCard key={broker.brokerId} broker={broker} />
        ))}
      </div>

      {/* Profit split reminder */}
      <Card
        size="small"
        style={{
          background: '#1a1d2e',
          border: '1px solid #2a2d3e',
          borderRadius: 10,
          marginTop: 4,
        }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#8b949e' }}>
          <Space size={2}>
            <BankOutlined style={{ color: '#3b82f6' }} />
            <span>平台 10%</span>
          </Space>
          <span>·</span>
          <Space size={2}>
            <UserOutlined style={{ color: '#f59e0b' }} />
            <span>信号源 15%</span>
          </Space>
          <span>·</span>
          <Space size={2}>
            <TeamOutlined style={{ color: '#22c55e' }} />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>你的 75%</span>
          </Space>
          <div style={{ flex: 1 }} />
          <Tag color="blue">利润自动扣除</Tag>
        </div>
      </Card>
    </div>
  );
}

function getTimeString() {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} 更新`;
}
