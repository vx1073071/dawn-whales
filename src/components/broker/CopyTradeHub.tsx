// ── R137-M01 CopyTradeHub — 跟单统一入口 (Tab容器) ────────────────────────
// PM: 统一路由+Sidebar入口, Tab切换12个子组件
// Contains: 配置/状态/历史/通知/信号源/券商 6 tabs

import { useState, useEffect } from 'react';
import { Tabs, Space, Badge, Button } from 'antd';
import {
  SettingOutlined, DashboardOutlined, ClockCircleOutlined,
  BellOutlined, UserOutlined, BankOutlined,
  ThunderboltOutlined, StopOutlined,
} from '@ant-design/icons';
import { useCopyTradeStore } from '@/stores/copyTradeStore';
import { migrateLocalStorage } from '@/lib/localStorageMigration';

// Lazy sub-tabs
import { CopyTradeSettings } from '@/components/broker/CopyTradeSettings';
import CopyTradeDashboard from '@/components/broker/CopyTradeDashboard';
import CopyTradeStatusBar from '@/components/broker/CopyTradeStatusBar';
import TradeHistoryPanel from '@/components/broker/TradeHistoryPanel';
import CopyTradeNotifications from '@/components/broker/CopyTradeNotifications';
import SignalProviderManage from '@/components/broker/SignalProviderManage';
import CopyTradeBrokerSelector from '@/components/broker/CopyTradeBrokerSelector';

export default function CopyTradeHub() {
  const [activeTab, setActiveTab] = useState('status');
  const unreadCount = useCopyTradeStore((s) => s.unreadCount());
  const killSwitch = useCopyTradeStore((s) => s.killSwitch);
  const setKillSwitch = useCopyTradeStore((s) => s.setKillSwitch);
  const config = useCopyTradeStore((s) => s.config);

  // Run migration on mount
  useEffect(() => {
    migrateLocalStorage();
  }, []);

  const tabItems = [
    {
      key: 'status',
      label: (
        <Space size={4}>
          <DashboardOutlined />
          <span>状态</span>
        </Space>
      ),
      children: <CopyTradeStatusBar />,
    },
    {
      key: 'dashboard',
      label: (
        <Space size={4}>
          <DashboardOutlined />
          <span>仪表盘</span>
        </Space>
      ),
      children: <CopyTradeDashboard />,
    },
    {
      key: 'config',
      label: (
        <Space size={4}>
          <SettingOutlined />
          <span>配置</span>
          {config.enabled && (
            <Badge status="processing" color="green" style={{ marginLeft: 2 }} />
          )}
        </Space>
      ),
      children: <CopyTradeSettings />,
    },
    {
      key: 'history',
      label: (
        <Space size={4}>
          <ClockCircleOutlined />
          <span>历史</span>
        </Space>
      ),
      children: <TradeHistoryPanel />,
    },
    {
      key: 'notifications',
      label: (
        <Space size={4}>
          <BellOutlined />
          <span>通知</span>
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" style={{ fontSize: 10 }} />
          )}
        </Space>
      ),
      children: <CopyTradeNotifications />,
    },
    {
      key: 'providers',
      label: (
        <Space size={4}>
          <UserOutlined />
          <span>信号源</span>
        </Space>
      ),
      children: <SignalProviderManage />,
    },
    {
      key: 'brokers',
      label: (
        <Space size={4}>
          <BankOutlined />
          <span>券商</span>
        </Space>
      ),
      children: <CopyTradeBrokerSelector />,
    },
  ];

  return (
    <div style={{ padding: '12px 8px', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '10px 16px',
        background: killSwitch
          ? 'linear-gradient(135deg, #2e0a0a 0%, #1a1d2e 100%)'
          : 'linear-gradient(135deg, #1a1d2e 0%, #232740 100%)',
        borderRadius: 10,
        border: `1px solid ${killSwitch ? '#ef444444' : '#2a2d3e'}`,
      }}>
        <Space>
          <ThunderboltOutlined style={{ fontSize: 20, color: killSwitch ? '#ef4444' : '#f59e0b' }} />
          <div>
            <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 16 }}>
              🐋 跟单中心
            </div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>
              {config.enabled
                ? `${config.mode === 'fixed' ? `固定 $${config.maxAmount}` : `比例 ${config.ratioPct}%`} · ${config.providerId ? '已选择信号源' : '未选择信号源'}`
                : '跟单未启动'}
            </div>
          </div>
        </Space>

        {/* Kill Switch */}
        <Button
          danger={!killSwitch}
          type={killSwitch ? 'primary' : 'default'}
          ghost={!killSwitch}
          icon={killSwitch ? <ThunderboltOutlined /> : <StopOutlined />}
          onClick={() => setKillSwitch(!killSwitch)}
          size="small"
        >
          {killSwitch ? '⛔ 已紧急停止' : '一键全停'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="small"
        style={{ color: '#e0e0e0' }}
        tabBarStyle={{
          background: '#1a1d2e',
          borderRadius: 8,
          padding: '4px 8px',
          marginBottom: 8,
          border: '1px solid #2a2d3e',
        }}
      />
    </div>
  );
}
