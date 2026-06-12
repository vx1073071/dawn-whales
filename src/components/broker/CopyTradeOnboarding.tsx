// @ts-nocheck
// ── R140-M04 CopyTradeOnboarding — 首次引导教程 (4步) ────────────────────
// PM: P2-4, 3h. 选信号源→配券商→设风控→启动跟单

import { useState, useCallback } from 'react';
import {
  Modal, Steps, Button, Space, Tag, Result, Card,
} from 'antd';
import {
  UserOutlined, BankOutlined, SafetyCertificateOutlined,
  ThunderboltOutlined, CheckCircleOutlined, TeamOutlined,
  SettingOutlined, PlayCircleOutlined,
} from '@ant-design/icons';

// ═══════════ Steps ═══════════

const ONBOARDING_STEPS = [
  {
    title: '选择信号源',
    icon: <UserOutlined />,
    description: '浏览信号源市场，关注你信任的策略提供者',
    content: (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          👥 → 📊 → ⭐
        </div>
        <div style={{ color: '#e0e0e0', fontSize: 14, marginBottom: 8 }}>
          信号源是跟单的核心
        </div>
        <div style={{ color: '#8b949e', fontSize: 12, lineHeight: '20px', maxWidth: 400, margin: '0 auto' }}>
          信号源是盈利的策略提供者。他们有不同风格：
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          <Tag color="blue">趋势跟踪</Tag>
          <Tag color="green">均线交叉</Tag>
          <Tag color="gold">剥头皮</Tag>
          <Tag color="purple">网格交易</Tag>
          <Tag color="red">鲸鱼追踪</Tag>
        </div>
        <div style={{ marginTop: 16, padding: '10px 16px', background: '#1a2e1a', borderRadius: 8, border: '1px solid #22c55e33', fontSize: 11, color: '#8b949e' }}>
          💡 <span style={{ color: '#22c55e' }}>建议</span>: 先看胜率+夏普比率+最大回撤，选择2-3个不同风格的信号源分散风险
        </div>
      </div>
    ),
  },
  {
    title: '配置券商',
    icon: <BankOutlined />,
    description: '连接你的交易所账户，选择跟单券商',
    content: (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          🏦 ↔ 🐋
        </div>
        <div style={{ color: '#e0e0e0', fontSize: 14, marginBottom: 8 }}>
          选择跟单的交易所
        </div>
        <div style={{ color: '#8b949e', fontSize: 12, lineHeight: '20px', maxWidth: 400, margin: '0 auto' }}>
          系统支持 17 家券商，涵盖加密货币、美股、港股
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          <Tag color="gold">Binance</Tag>
          <Tag color="blue">OKX</Tag>
          <Tag color="orange">Bybit</Tag>
          <Tag color="cyan">Futu港美股</Tag>
          <Tag color="green">Tiger</Tag>
          <Tag color="purple">Schwab</Tag>
        </div>
        <div style={{ marginTop: 16, padding: '10px 16px', background: '#2e2a1a', borderRadius: 8, border: '1px solid #f59e0b33', fontSize: 11, color: '#8b949e' }}>
          ⚠ <span style={{ color: '#f59e0b' }}>注意</span>: Cloud券商(如Binance)云端执行，OpenD券商(如Futu)需本地运行
        </div>
      </div>
    ),
  },
  {
    title: '设置风控',
    icon: <SafetyCertificateOutlined />,
    description: '设定止损止盈和暂停规则，保护资金安全',
    content: (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          🛡️💰🛡️
        </div>
        <div style={{ color: '#e0e0e0', fontSize: 14, marginBottom: 8 }}>
          风控是第一优先级
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 400, margin: '12px auto' }}>
          <div style={{ padding: '10px', background: '#0d0f1a', borderRadius: 8, border: '1px solid #2a2d3e' }}>
            <div style={{ color: '#22c55e', fontWeight: 600 }}>止盈</div>
            <div style={{ color: '#e0e0e0' }}>盈利N%自动卖出</div>
          </div>
          <div style={{ padding: '10px', background: '#0d0f1a', borderRadius: 8, border: '1px solid #2a2d3e' }}>
            <div style={{ color: '#ef4444', fontWeight: 600 }}>止损</div>
            <div style={{ color: '#e0e0e0' }}>亏损N%自动止损</div>
          </div>
          <div style={{ padding: '10px', background: '#0d0f1a', borderRadius: 8, border: '1px solid #2a2d3e' }}>
            <div style={{ color: '#f59e0b', fontWeight: 600 }}>日亏损限额</div>
            <div style={{ color: '#e0e0e0' }}>达到N刀自动暂停</div>
          </div>
          <div style={{ padding: '10px', background: '#0d0f1a', borderRadius: 8, border: '1px solid #2a2d3e' }}>
            <div style={{ color: '#3b82f6', fontWeight: 600 }}>每单上限</div>
            <div style={{ color: '#e0e0e0' }}>单笔最大跟单金额</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: '10px 16px', background: '#1a2e1a', borderRadius: 8, border: '1px solid #22c55e33', fontSize: 11, color: '#8b949e' }}>
          💡 <span style={{ color: '#22c55e' }}>建议</span>: 止损5-8%，日亏损限额不超过总资产的3%，单笔不超过总资产1%
        </div>
      </div>
    ),
  },
  {
    title: '启动跟单',
    icon: <PlayCircleOutlined />,
    description: '确认设置，一键启动自动化跟单',
    content: (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          🚀
        </div>
        <div style={{ color: '#e0e0e0', fontSize: 14, marginBottom: 8 }}>
          一切就绪，准备启动
        </div>
        <div style={{ color: '#8b949e', fontSize: 12, lineHeight: '20px', maxWidth: 400, margin: '0 auto' }}>
          启动后，系统将自动：
        </div>
        <div style={{ textAlign: 'left', maxWidth: 360, margin: '12px auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', color: '#8b949e', fontSize: 12 }}>
            <CheckCircleOutlined style={{ color: '#22c55e' }} />
            接收信号源的实时交易信号
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', color: '#8b949e', fontSize: 12 }}>
            <CheckCircleOutlined style={{ color: '#22c55e' }} />
            自动在你配置的券商下单
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', color: '#8b949e', fontSize: 12 }}>
            <CheckCircleOutlined style={{ color: '#22c55e' }} />
            止损止盈自动执行
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', color: '#8b949e', fontSize: 12 }}>
            <CheckCircleOutlined style={{ color: '#22c55e' }} />
            暂停规则保护资金安全
          </div>
        </div>
        <div style={{ marginTop: 16, padding: '10px 16px', background: '#2e0a0a', borderRadius: 8, border: '1px solid #ef444433', fontSize: 11, color: '#8b949e' }}>
          ⚠ <span style={{ color: '#ef4444' }}>风险提示</span>: 跟单交易存在亏损风险。历史收益不代表未来表现。请勿投入超过你能承受损失的金额。
        </div>
      </div>
    ),
  },
];

// ── Main Onboarding Modal ──

interface CopyTradeOnboardingProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function CopyTradeOnboarding({ visible, onClose, onComplete }: CopyTradeOnboardingProps) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleNext = useCallback(() => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep((p) => p + 1);
    } else {
      setCompleted(true);
      try { localStorage.setItem('dw:ct:onboardingDone', 'true'); } catch {}
      onComplete();
    }
  }, [step, onComplete]);

  const handleClose = useCallback(() => {
    try { localStorage.setItem('dw:ct:onboardingDone', 'true'); } catch {}
    onClose();
  }, [onClose]);

  if (completed) {
    return (
      <Modal open={visible} onCancel={handleClose} footer={null} width={520}>
        <Result
          status="success"
          title={<span style={{ color: '#e0e0e0' }}>设置完成!</span>}
          subTitle={<span style={{ color: '#8b949e' }}>你已了解跟单的基本流程，现在可以开始探索了</span>}
          extra={[
            <Button key="start" type="primary" onClick={handleClose} icon={<ThunderboltOutlined />}>
              开始使用
            </Button>,
          ]}
          style={{ padding: '30px 0' }}
        />
      </Modal>
    );
  }

  const currentStep = ONBOARDING_STEPS[step];

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined style={{ color: '#f59e0b' }} />
          <span style={{ color: '#e0e0e0' }}>跟单入门引导</span>
          <Tag color="green" style={{ fontSize: 10 }}>Step {step + 1}/4</Tag>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="skip" onClick={handleClose}>
          跳过教程
        </Button>,
        step > 0 && (
          <Button key="prev" onClick={() => setStep((p) => p - 1)}>
            上一步
          </Button>
        ),
        <Button key="next" type="primary" onClick={handleNext} icon={step < ONBOARDING_STEPS.length - 1 ? <PlayCircleOutlined /> : <CheckCircleOutlined />}>
          {step < ONBOARDING_STEPS.length - 1 ? '下一步' : '完成'}
        </Button>,
      ].filter(Boolean)}
      width={560}
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 20, marginTop: 8 }}
        items={ONBOARDING_STEPS.map((s) => ({
          title: s.title,
          icon: <span style={{ fontSize: 14 }}>{s.icon}</span>,
        }))}
      />

      {/* Step content */}
      <Card
        size="small"
        style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
        styles={{ body: { padding: '12px' } }}
      >
        <div style={{ color: '#e0e0e0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          {currentStep.title}
        </div>
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
          {currentStep.description}
        </div>
        {currentStep.content}
      </Card>
    </Modal>
  );
}

// ── Hook for auto-show ──

export function useCopyTradeOnboarding() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem('dw:ct:onboardingDone');
    } catch {
      return true;
    }
  });

  const close = useCallback(() => setVisible(false), []);
  const complete = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem('dw:ct:onboardingDone', 'true'); } catch {}
  }, []);

  return { visible, close, complete };
}
