// ── R219 ML#2: ContextualAITrigger — 上下文AI触发点 (嵌入模板各处) ──────────
// 3+触发点/模板: 因子旁 / 铁律旁 / 回测旁 / 参数旁
// AI按钮内嵌在各UI区域, 不跳转, 弹窗/侧边栏显示
// 静默扣费: 后端计费(模板已含deepSeekChat配置, 1U/轮)
// 不退费声明, dwell>30s 提示, dismiss=不收费
// 9语言i18n, Ant Modal形式

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button, Modal, Card, Tag, Space, Tooltip, Tabs, Progress, Alert } from 'antd';
import {
  RobotOutlined, BulbOutlined, ThunderboltOutlined,
  CloseOutlined, CheckCircleOutlined, StopOutlined,
  RocketOutlined, AimOutlined, LineChartOutlined,
  ExperimentOutlined, FieldTimeOutlined,
} from '@ant-design/icons';
import i18n from '../../i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export type TriggerContext = 'factor' | 'goldenRule' | 'backtest' | 'parameter' | 'risk';

export interface AIResponse {
  type: 'suggestion' | 'explanation' | 'optimization' | 'warning';
  title: string;
  body: string;
  confidence: number;
  cost: number;
  actions?: { label: string; onClick: () => void }[];
}

export interface ContextualAITriggerProps {
  context: TriggerContext;
  data: Record<string, unknown>;
  symbol?: string;
  onApply?: (response: AIResponse) => void;
  variant?: 'inline' | 'icon' | 'button';
  size?: 'small' | 'middle';
}

// ── i18n ────────────────────────────────────────────────────────────────────

const I18N = (key: string) => i18n.t(`contextualAI.${key}`);

// ── Mock AI responses by context ────────────────────────────────────────────

const MOCK_RESPONSES: Record<TriggerContext, AIResponse[]> = {
  factor: [
    {
      type: 'explanation',
      title: '该因子当前状态解读',
      body: '该因子当前IC=0.045, 处于历史30%分位, 短期预测力偏弱。建议权重降至5-8%以降低过拟合风险。\n\n历史回测显示: 牛市环境下贡献+18%收益, 熊市贡献-12%亏损。\n\n建议操作: 当前仓位持有, 等待IC回升至0.06以上再加大权重。',
      confidence: 78,
      cost: 1,
      actions: [
        { label: '降低权重至5%', onClick: () => { /* dispatch */ } },
        { label: '保持当前权重', onClick: () => { /* dispatch */ } },
      ],
    },
  ],
  goldenRule: [
    {
      type: 'warning',
      title: '止损规则过于宽松',
      body: '当前规则"RSI<30买入"未定义止损, 历史上类似策略最大回撤达35%, 超过健康阈值(20%)。\n\n建议添加: "买入后5%止损" 或 "持仓超过10天强制平仓"。\n\n影响: 增加止损后, 预期年化收益降低2-3%, 但最大回撤降至18%。',
      confidence: 85,
      cost: 1,
      actions: [
        { label: '应用5%止损', onClick: () => { /* dispatch */ } },
        { label: '查看完整回测', onClick: () => { /* dispatch */ } },
      ],
    },
  ],
  backtest: [
    {
      type: 'optimization',
      title: '回测结果优化建议',
      body: '当前回测Sharpe=1.42, 胜率=58%, 但最大回撤=28%偏高。\n\n优化方向:\n1. 添加ATR动态止损(当前价-2×ATR), 预期回撤降至18%\n2. 增加市场状态过滤(仅在牛市运行), 预期Sharpe提升至1.65\n3. 减少同时持仓数(5→3), 预期夏普提升至1.55\n\n推荐先尝试方案1(回撤-10%, 收益-1%)。',
      confidence: 82,
      cost: 1.5,
      actions: [
        { label: '应用ATR止损', onClick: () => { /* dispatch */ } },
        { label: '查看详细对比', onClick: () => { /* dispatch */ } },
      ],
    },
  ],
  parameter: [
    {
      type: 'suggestion',
      title: '参数交互影响分析',
      body: '检测到当前参数组合(stopLoss=2%, takeProfit=4%)在震荡市表现不佳:\n- 胜率仅45%(理想55%+)\n- 平均盈利小于平均亏损\n\n建议调整方向:\n- takeProfit提至6-8% (让利润奔跑)\n- 或stopLoss收紧至1.5% (快速止损)\n\n预期改善: 胜率提升至52%, 盈亏比从1.0改善至1.6。',
      confidence: 75,
      cost: 1,
    },
  ],
  risk: [
    {
      type: 'warning',
      title: '组合集中度风险',
      body: '当前组合前3大持仓占总资金62%, 集中度风险偏高(建议<50%)。\n\n建议: 减持最大持仓15%, 分散到2-3个低相关性品种。\n\n影响: 预期组合年化波动率从28%降至21%, Sharpe从0.95提升至1.12。',
      confidence: 88,
      cost: 1,
      actions: [
        { label: '查看分散方案', onClick: () => { /* dispatch */ } },
      ],
    },
  ],
};

const CONTEXT_META: Record<TriggerContext, { icon: React.ReactNode; label: string; color: string }> = {
  factor: { icon: <ExperimentOutlined />, label: '因子分析', color: '#22c55e' },
  goldenRule: { icon: <AimOutlined />, label: '铁律检查', color: '#f59e0b' },
  backtest: { icon: <LineChartOutlined />, label: '回测解读', color: '#60a5fa' },
  parameter: { icon: <FieldTimeOutlined />, label: '参数影响', color: '#a78bfa' },
  risk: { icon: <RocketOutlined />, label: '风险分析', color: '#ef4444' },
};

// ── Main component ──────────────────────────────────────────────────────────

export default function ContextualAITrigger({
  context,
  data: _data,
  symbol,
  onApply,
  variant = 'inline',
  size = 'small',
}: ContextualAITriggerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dwellTime, setDwellTime] = useState(0);
  const [showDwellTip, setShowDwellTip] = useState(false);
  const [tab, setTab] = useState<'analysis' | 'history'>('analysis');
  const dwellTimerRef = useRef<number | null>(null);
  const dwellIntervalRef = useRef<number | null>(null);

  const meta = CONTEXT_META[context];
  const cost = MOCK_RESPONSES[context][0]?.cost ?? 1;

  // ── dwell timer (>30s trigger warning) ──
  useEffect(() => {
    if (!open) return;
    const start = Date.now();
    dwellIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setDwellTime(elapsed);
      if (elapsed > 30 && !showDwellTip) {
        setShowDwellTip(true);
      }
    }, 1000);
    return () => {
      if (dwellIntervalRef.current) window.clearInterval(dwellIntervalRef.current);
    };
  }, [open, showDwellTip]);

  // ── 触发AI ──
  const triggerAI = useCallback(async () => {
    if (loading) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setResponse(null);
    setDwellTime(0);
    setShowDwellTip(false);

    try {
      // Simulate API call delay
      await new Promise(r => setTimeout(r, 1200));
      const responses = MOCK_RESPONSES[context] || [];
      if (responses.length === 0) {
        setError('No AI response available');
        return;
      }
      setResponse(responses[0]);
    } catch (e: unknown) {
      setError((e as Error).message || 'AI call failed');
    } finally {
      setLoading(false);
    }
  }, [context, loading]);

  // ── 关闭处理 ──
  const handleClose = useCallback(() => {
    if (dwellTimerRef.current) window.clearTimeout(dwellTimerRef.current);
    if (dwellIntervalRef.current) window.clearInterval(dwellIntervalRef.current);
    setOpen(false);
    setDwellTime(0);
    setShowDwellTip(false);
    // No charge if dismissed before response
  }, []);

  // ── 应用建议 ──
  const handleApply = useCallback(() => {
    if (response && onApply) {
      onApply(response);
    }
    setOpen(false);
  }, [response, onApply]);

  // ── 渲染触发按钮 ──
  const renderTrigger = () => {
    if (variant === 'icon') {
      return (
        <Tooltip title={`${I18N('trigger')} (${cost}U)`}>
          <Button
            type="text"
            size={size}
            icon={<RobotOutlined style={{ color: meta.color }} />}
            onClick={triggerAI}
            style={{ border: 'none' }}
          />
        </Tooltip>
      );
    }
    if (variant === 'button') {
      return (
        <Button
          size={size}
          icon={<RobotOutlined />}
          onClick={triggerAI}
          style={{ background: meta.color, borderColor: meta.color, color: '#fff' }}
        >
          {I18N('trigger')}
        </Button>
      );
    }
    return (
      <Tag
        icon={meta.icon}
        color={meta.color}
        onClick={triggerAI}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <RobotOutlined /> {I18N('aiAsk')} · {cost}U
      </Tag>
    );
  };

  return (
    <>
      {renderTrigger()}

      <Modal
        open={open}
        onCancel={handleClose}
        footer={null}
        width={640}
        title={
          <Space>
            <RobotOutlined style={{ color: meta.color, fontSize: 20 }} />
            <span style={{ color: '#e0e0e0' }}>{I18N('title')}</span>
            <Tag color={meta.color}>{meta.label}</Tag>
            {symbol && <Tag color="blue">{symbol}</Tag>}
          </Space>
        }
        closeIcon={<CloseOutlined style={{ color: '#9ca3af' }} />}
        styles={{ body: { padding: 0 } }}
        style={{ top: 40 }}
      >
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'analysis' | 'history')}
          items={[
            {
              key: 'analysis',
              label: <span><BulbOutlined /> {I18N('analysis')}</span>,
              children: (
                <div style={{ padding: '16px 24px' }}>
                  {/* Disclaimer banner */}
                  <Alert
                    type="info"
                    showIcon
                    message={I18N('noRefund')}
                    description={`${I18N('cost')}: ${cost} USDT · ${I18N('nonRefundable')}`}
                    style={{ marginBottom: 12 }}
                  />

                  {/* Dwell warning (>30s) */}
                  {showDwellTip && (
                    <Alert
                      type="warning"
                      showIcon
                      message={I18N('longDwell')}
                      description={`${I18N('dwellTime')}: ${dwellTime}s · ${I18N('dwellHint')}`}
                      style={{ marginBottom: 12 }}
                    />
                  )}

                  {loading && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Progress type="circle" percent={50} status="active" />
                      <div style={{ color: '#9ca3af', marginTop: 12 }}>
                        <ThunderboltOutlined /> {I18N('analyzing')} {meta.label}...
                      </div>
                    </div>
                  )}

                  {error && (
                    <Alert type="error" showIcon message={I18N('error')} description={error} />
                  )}

                  {response && !loading && (
                    <Card
                      size="small"
                      styles={{ body: { padding: '14px 16px' } }}
                      style={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 10 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>
                            {response.type === 'warning' ? <StopOutlined style={{ color: '#ef4444' }} /> : <CheckCircleOutlined style={{ color: '#22c55e' }} />}
                            <span style={{ marginLeft: 6 }}>{response.title}</span>
                          </div>
                          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                            {I18N('confidence')}: <span style={{ color: meta.color }}>{response.confidence}%</span>
                          </div>
                        </div>
                        <Tag color={response.type === 'warning' ? 'red' : 'blue'}>
                          {response.type.toUpperCase()}
                        </Tag>
                      </div>

                      <div style={{
                        color: '#d1d5db', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 6, padding: '10px 12px',
                        maxHeight: 320, overflowY: 'auto',
                      }}>
                        {response.body}
                      </div>

                      {response.actions && response.actions.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {response.actions.map((act, i) => (
                            <Button
                              key={i}
                              type={i === 0 ? 'primary' : 'default'}
                              size="small"
                              onClick={() => { act.onClick(); handleApply(); }}
                              style={i === 0 ? { background: meta.color, borderColor: meta.color } : {}}
                            >
                              {act.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}

                  {!loading && !response && !error && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
                      <RobotOutlined style={{ fontSize: 40, color: '#374151' }} />
                      <div style={{ marginTop: 8 }}>{I18N('clickToStart')}</div>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'history',
              label: <span><FieldTimeOutlined /> {I18N('history')}</span>,
              children: (
                <div style={{ padding: '16px 24px' }}>
                  <Alert type="info" showIcon message={I18N('noHistory')} />
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
}

// ── 辅助: 快捷组合 ────────────────────────────────────────────────────────

export function FactorAIButton({ factorId, ...props }: { factorId: string } & Partial<ContextualAITriggerProps>) {
  return <ContextualAITrigger context="factor" data={{ factorId }} {...props} />;
}

export function BacktestAIButton({ strategyId, ...props }: { strategyId: string } & Partial<ContextualAITriggerProps>) {
  return <ContextualAITrigger context="backtest" data={{ strategyId }} {...props} />;
}

export function RiskAIButton({ portfolioId, ...props }: { portfolioId: string } & Partial<ContextualAITriggerProps>) {
  return <ContextualAITrigger context="risk" data={{ portfolioId }} {...props} />;
}

export function GoldenRuleAIButton({ ruleIndex, ...props }: { ruleIndex: number } & Partial<ContextualAITriggerProps>) {
  return <ContextualAITrigger context="goldenRule" data={{ ruleIndex }} {...props} />;
}

export function ParameterAIButton({ paramName, ...props }: { paramName: string } & Partial<ContextualAITriggerProps>) {
  return <ContextualAITrigger context="parameter" data={{ paramName }} {...props} />;
}
