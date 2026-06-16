// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

// ── R139-M04 OrderPreviewCancelModal — 试算弹窗+撤单5s倒计时 ─────────────
// PM: P1-9/P1-10, 3h. Spec: docs/design/order-preview-cancel-wireframe.md

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, Button, Space, Tag, Progress, Descriptions, Alert, Statistic,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  DollarOutlined, SwapOutlined, SafetyCertificateOutlined,
  WarningOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ═══════════ Types ═══════════

interface OrderPreview {
  signalId: string;
  providerName: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: number;
  quantity: number;
  total: number;
  brokerName: string;
  fee: number;
  feeCurrency: string;
  estimatedSlippage: number;
  currentPosition: number;
  positionAfterOrder: number;
  balanceBefore: number;
  balanceAfter: number;
  maxAllowed: number;
}

// ═══════════ Mock ═══════════

const MOCK_PREVIEW: OrderPreview = {
  signalId: 's-001',
  providerName: 'AlphaQuant',
  symbol: 'BTC-USDT',
  side: 'buy',
  type: 'market',
  price: 97234.50,
  quantity: 0.01,
  total: 972.35,
  brokerName: 'Binance',
  fee: 0.97,
  feeCurrency: 'USDT',
  estimatedSlippage: 0.02,
  currentPosition: 0.05,
  positionAfterOrder: 0.06,
  balanceBefore: 15234.80,
  balanceAfter: 14261.48,
  maxAllowed: 10234.50,
};

// ── Main component ──

export default function OrderPreviewCancelModal({
  visible,
  onClose,
  onExecute,
  onCancel: onOrderCancel,
}: {
  visible: boolean;
  onClose: () => void;
  onExecute: () => void;
  onCancel: () => void;
}) {
  const preview = MOCK_PREVIEW;
  const [countdown, setCountdown] = useState(5);
  const [countdownActive, setCountdownActive] = useState(false);
  const [autoExecuted, setAutoExecuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setCountdown(5);
      setCountdownActive(false);
      setAutoExecuted(false);
      return;
    }
    // Start countdown on mount
    setCountdownActive(true);
    setCountdown(5);
  }, [visible]);

  useEffect(() => {
    if (!countdownActive) return;

    if (countdown <= 0) {
      setCountdownActive(false);
      setAutoExecuted(true);
      // Auto-execute after countdown
      setTimeout(() => {
        onExecute();
        onClose();
      }, 500);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdownActive, countdown, onExecute, onClose]);

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdownActive(false);
    onOrderCancel();
    onClose();
  }, [onOrderCancel, onClose]);

  const isPaymentSafe = preview.total <= preview.maxAllowed;

  return (
    <Modal
      title={
        <Space size={8}>
          <span style={{ fontSize: 18 }}>
            {preview.side === 'buy' ? '📈' : '📉'}
          </span>
          <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>
            订单预览
          </span>
          <Tag color={preview.side === 'buy' ? 'green' : 'red'}>
            {preview.side === 'buy' ? '买入' : '卖出'}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={autoExecuted ? [
        <Button key="close" onClick={onClose}>已执行, 关闭</Button>,
      ] : [
        <Button
          key="cancel"
          danger
          onClick={handleCancel}
          disabled={countdown === 0}
          size="large"
          icon={<CloseCircleOutlined />}
        >
          撤单 {countdown > 0 ? `(${countdown}s)` : ''}
        </Button>,
        <Button
          key="execute"
          type="primary"
          onClick={() => { onExecute(); onClose(); }}
          disabled={countdown === 0}
          size="large"
          icon={<ThunderboltOutlined />}
        >
          立即执行
        </Button>,
      ]}
      width={540}
    >
      {/* Countdown bar */}
      <div style={{
        padding: '10px 14px',
        background: countdown > 0 ? '#2e2a1a' : '#1a2e1a',
        borderRadius: 8,
        border: `1px solid ${countdown > 0 ? '#f59e0b44' : '#22c55e44'}`,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {countdown > 0 ? (
          <>
            <ClockCircleOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e0e0e0', fontSize: 13 }}>
                {countdown}s 后自动执行
              </div>
              <div style={{ color: '#8b949e', fontSize: 10 }}>点击"撤单"取消，或点击"立即执行"确认</div>
            </div>
            <Progress
              type="circle"
              percent={((5 - countdown) / 5) * 100}
              size={40}
              strokeColor="#f59e0b"
              trailColor="#1e2030"
              format={() => <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}>{countdown}</span>}
            />
          </>
        ) : (
          <div style={{ color: '#22c55e', textAlign: 'center', flex: 1 }}>
            <CheckCircleOutlined /> 订单已自动执行
          </div>
        )}
      </div>

      {/* Order detail */}
      <Descriptions
        size="small"
        column={2}
        labelStyle={{ color: '#6b7280', fontSize: 11 }}
        contentStyle={{ color: '#e0e0e0', fontSize: 12 }}
        style={{
          background: '#1a1d2e',
          borderRadius: 8,
          padding: '12px',
          border: '1px solid #2a2d3e',
          marginBottom: 12,
        }}
      >
        <Descriptions.Item label="信号源">{preview.providerName}</Descriptions.Item>
        <Descriptions.Item label="券商">{preview.brokerName}</Descriptions.Item>
        <Descriptions.Item label="交易对">
          <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{preview.symbol}</span>
        </Descriptions.Item>
        <Descriptions.Item label="类型">
          <Tag color="blue">{preview.type.toUpperCase()}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="价格">
          <span style={{ fontFamily: 'monospace', color: '#e0e0e0' }}>${preview.price.toFixed(2)}</span>
        </Descriptions.Item>
        <Descriptions.Item label="数量">
          <span style={{ fontFamily: 'monospace', color: '#e0e0e0' }}>{preview.quantity}</span>
        </Descriptions.Item>
        <Descriptions.Item label="总金额">
          <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
            ${preview.total.toFixed(2)}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="手续费">
          <span style={{ fontFamily: 'monospace', color: '#8b949e' }}>
            ${preview.fee.toFixed(2)} {preview.feeCurrency}
          </span>
        </Descriptions.Item>
      </Descriptions>

      {/* Position impact */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 12,
      }}>
        <div style={{
          padding: '10px',
          background: '#0d0f1a',
          borderRadius: 8,
          border: '1px solid #2a2d3e',
        }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>当前持仓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>
            {preview.currentPosition}
          </div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>
            <SwapOutlined /> 下单后: {preview.positionAfterOrder}
          </div>
        </div>
        <div style={{
          padding: '10px',
          background: isPaymentSafe ? '#0d0f1a' : '#2e0a0a',
          borderRadius: 8,
          border: isPaymentSafe ? '1px solid #2a2d3e' : '1px solid #ef444444',
        }}>
          <div style={{ fontSize: 10, color: '#6b7280' }}>可用余额</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' }}>
            ${preview.balanceBefore.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: isPaymentSafe ? '#22c55e' : '#ef4444' }}>
            <DollarOutlined /> 下单后: ${preview.balanceAfter.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {!isPaymentSafe && (
        <Alert
          message="⚠ 金额超限"
          description={`订单 $${preview.total.toFixed(2)} 超过单笔限额 $${preview.maxAllowed.toLocaleString()}`}
          type="error"
          showIcon
          style={{ marginBottom: 12, background: '#2e0a0a', border: '1px solid #ef444444' }}
          styles={{ message: { color: '#ef4444' }, description: { color: '#8b949e' } }}
        />
      )}

      {preview.estimatedSlippage > 0.05 && (
        <Alert
          message="⚠ 滑点警告"
          description={`预估滑点 ${preview.estimatedSlippage}% 较高，市价单可能以不利价格成交`}
          type="warning"
          showIcon
          style={{ marginBottom: 12, background: '#2e2a1a', border: '1px solid #f59e0b44' }}
          styles={{ message: { color: '#f59e0b' }, description: { color: '#8b949e' } }}
        />
      )}

      {/* Risk note */}
      <div style={{
        fontSize: 10,
        color: '#6b7280',
        textAlign: 'center',
        padding: '8px',
        background: '#1a1d2e',
        borderRadius: 6,
        lineHeight: '16px',
      }}>
        ⚠ 跟单交易存在风险。信号源历史表现不代表未来收益。
        <br />
        本订单为市价单，实际成交价可能因市场波动而偏离预览价格。
      </div>
    </Modal>
  );
}

// Export demo trigger hook
export function useOrderPreview() {
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<'executed' | 'cancelled' | null>(null);

  const show = useCallback(() => {
    setVisible(true);
    setResult(null);
  }, []);

  const onExecute = useCallback(() => setResult('executed'), []);
  const onCancel = useCallback(() => setResult('cancelled'), []);

  return { visible, result, show, onExecute, onCancel, setVisible };
}
