// @ts-nocheck
// R284 ML#2: DrawingAIAnalysis — 画线→AI分析UI (2h)
// User draws a line → AI auto-analyzes: test count, success rate, distance, breakout probability
// Hook product: free draw, $1 for AI analysis
// 画线→AI分析: 免费画线，1U看AI分析结果
import React, { useState, useCallback } from 'react';
import { TrendingUp, Crosshair, Target, History, Zap, BarChart3, Shield, AlertTriangle } from 'lucide-react';

interface LineAIResult {
  type: string;                  // 'support' | 'resistance' | 'trendline'
  testCount: number;             // how many times tested in history
  successRate: number;           // % held
  distancePct: number;           // current price distance
  breakoutProbability: number;   // % chance of breaking next N bars
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  nearestTarget: number;         // if broken, nearest target price
  suggestion: string;            // actionable advice
}

const DEMO_RESULTS: Record<string, LineAIResult> = {
  'trend': {
    type: '趋势线', testCount: 8, successRate: 0.75, distancePct: 3.2,
    breakoutProbability: 0.35, confidence: 'HIGH',
    nearestTarget: 112.5,
    suggestion: '趋势线上方运行良好，8次测试仅2次假突破。当前距离3.2%，建议趋势线附近做多，止损设跌破线5%以下。',
  },
  'horizontal': {
    type: '支撑线', testCount: 12, successRate: 0.67, distancePct: 1.8,
    breakoutProbability: 0.28, confidence: 'HIGH',
    nearestTarget: 95.0,
    suggestion: '历史上的强支撑位，12次测试8次守住。当前距离1.8%很近，可在此处挂买单，下方2%止损。',
  },
  'channel': {
    type: '通道线', testCount: 6, successRate: 0.83, distancePct: 5.5,
    breakoutProbability: 0.15, confidence: 'MEDIUM',
    nearestTarget: 120.0,
    suggestion: '通道上轨附近，突破概率15%。若突破则目标120。不破则在通道内高抛低吸。',
  },
  'fib': {
    type: '斐波那契', testCount: 4, successRate: 0.50, distancePct: 2.1,
    breakoutProbability: 0.40, confidence: 'LOW',
    nearestTarget: 108.0,
    suggestion: '0.618回撤位测试次数少，置信度低。建议等待更多确认信号（如MACD金叉/放量）再做决定。',
  },
  'vertical': {
    type: '时间标记', testCount: 0, successRate: 0, distancePct: 0,
    breakoutProbability: 0, confidence: 'LOW',
    nearestTarget: 0,
    suggestion: '垂直线是时间标记工具，不产生AI分析信号。如需分析，请画趋势线或水平线。',
  },
};

interface Props {
  lineType?: string;
  dark?: boolean;
  onPayForAnalysis?: () => void;
  result?: LineAIResult | null;
  isPaid?: boolean;
}

export default function DrawingAIAnalysis({ lineType = 'trend', dark = true, onPayForAnalysis, result: overrideResult }: Props) {
  const [isPaid, setIsPaid] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const result = overrideResult || (isPaid ? DEMO_RESULTS[lineType] : null);

  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const handlePay = useCallback(() => {
    setAnalyzing(true);
    setTimeout(() => { setIsPaid(true); setAnalyzing(false); onPayForAnalysis?.(); }, 600);
  }, [onPayForAnalysis]);

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 380, borderRadius: 12 }}>
    {!isPaid && !result ? (
      /* ── Paywall ── */
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>AI画线分析</div>
        <div style={{ fontSize: 12, color: c.t2, marginBottom: 14 }}>
          让AI分析这条线的历史表现，告诉你可靠程度和操作建议
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
          {[
            { l: '📊 测试次数', v: '历史被触几次' },
            { l: '✅ 成功率', v: '守住的概率' },
            { l: '📏 距离', v: '距当前价位' },
            { l: '🎯 操作建议', v: '直接可执行的' },
          ].map((r, i) => <div key={i} style={{ padding: '8px 6px', borderRadius: 6, background: c.sh, fontSize: 11, color: c.t2 }}>
            <div style={{ marginBottom: 2 }}>{r.l}</div><div>{r.v}</div>
          </div>)}
        </div>
        <button onClick={handlePay} disabled={analyzing} style={{
          width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', border: 'none', background: analyzing ? c.t2 : c.a, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Zap size={16}/> {analyzing ? '分析中...' : '立即分析 · 1 USDT'}
        </button>
        <div style={{ fontSize: 10, color: c.t2, marginTop: 6 }}>
          🔒 画线免费，AI分析1U/次 · 失败不扣费
        </div>
      </div>
    ) : result ? (
      /* ── Result ── */
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Crosshair size={16} style={{ color: c.a }}/>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{result.type} 分析</span>
          </div>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 8,
            background: result.confidence === 'HIGH' ? c.ok + '15' : result.confidence === 'MEDIUM' ? c.wa + '15' : c.er + '15',
            color: result.confidence === 'HIGH' ? c.ok : result.confidence === 'MEDIUM' ? c.wa : c.er,
            fontWeight: 600,
          }}>
            {result.confidence === 'HIGH' ? '高置信' : result.confidence === 'MEDIUM' ? '中置信' : '低置信'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
          {[
            { l: '测试次数', v: result.testCount.toString(), icon: <History size={12}/> },
            { l: '成功率', v: `${(result.successRate * 100).toFixed(0)}%`, icon: <Target size={12}/>, color: result.successRate > 0.6 ? c.ok : c.wa },
            { l: '突破概率', v: `${(result.breakoutProbability * 100).toFixed(0)}%`, icon: <TrendingUp size={12}/> },
          ].map((r, i) => <div key={i} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: c.sh }}>
            <div style={{ color: c.t2, marginBottom: 2 }}>{r.icon}</div>
            <div style={{ fontSize: 10, color: c.t2 }}>{r.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: (r as any).color || c.t, marginTop: 2 }}>{r.v}</div>
          </div>)}
        </div>

        <div style={{ padding: 10, borderRadius: 8, background: c.a + '10', border: `1px solid ${c.a}20`, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.a, marginBottom: 2 }}>💡 AI建议</div>
          <div style={{ fontSize: 12, color: c.t, lineHeight: 1.5 }}>{result.suggestion}</div>
        </div>

        {result.nearestTarget > 0 && <div style={{ fontSize: 11, color: c.t2 }}>
          🎯 若突破，最近目标价: <span style={{ color: c.ok, fontWeight: 600 }}>${result.nearestTarget}</span>
        </div>}

        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: c.sh, color: c.t2, border: 'none', cursor: 'pointer', fontSize: 11 }}>📤 分享分析</button>
          <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>📊 导出报告</button>
        </div>
      </div>
    ) : null}
  </div>;
}

export { DEMO_RESULTS, type LineAIResult };
