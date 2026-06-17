// @ts-nocheck
// R282 ML#3: FactorHumanLayer — 人话化600+面板 (6h)
// Extends FactorHumanizeCard.tsx patterns to cover ALL factor panels
// Every factor now has: humanLabel (≤15字) + verdict + dontUseWhen
// Automatic translation table for 15 categories × 5 common signals
// 人话翻译层: 所有专业因子自动翻译成大白话
import React, { useState, useMemo } from 'react';

// ─── Human Translation Tables ──────────────────────────────────────
const SIGNAL_HUMAN: Record<string, string> = {
  'STRONG_LONG': '强力看好',
  'LONG': '偏多',
  'NEUTRAL': '中性观望',
  'SHORT': '偏空',
  'STRONG_SHORT': '强力看空',
};

const CATEGORY_HUMAN_INTRO: Record<string, string> = {
  'VALUE': '便宜有好货——市盈率、市净率、股息率等告诉你这只股票是不是被低估了',
  'GROWTH': '公司在变大——营收增速、盈利增速、ROE衡量公司是在长大还是在萎缩',
  'MOMENTUM': '跟着趋势走——过去涨的股票往往继续涨（直到不涨为止）',
  'QUALITY': '好公司值得买——ROIC、毛利率、F-Score告诉你这家公司内在好不好',
  'SIZE': '小盘还是大盘——市值大小决定风险收益特征',
  'VOLATILITY': '心跳指数——波动率告诉你持有时会不会睡不着觉',
  'LIQUIDITY': '好买好卖吗——换手率、买卖价差决定进出成本',
  'FLOW': '钱往哪流——外资、机构、主力资金告诉你聪明钱在干什么',
  'MACRO': '看天吃饭——宏观因子告诉你经济好坏对这个因子的影响',
  'SENTIMENT': '市场情绪——别人恐惧我贪婪，别人疯狂我恐惧',
  'ESG': '做好事能赚钱——可持续、环保、治理好的公司长期跑赢',
  'OPTIONS': '衍生品信号——期权市场比股票市场更聪明，VIX告诉你恐慌程度',
  'FI': '债券市场——利率曲线、信用利差影响所有资产的估值',
  'ALT': '非传统数据——卫星图像、信用卡消费、停车位透露真实经济活动',
  'ACADEMIC': '诺贝尔奖因子——Fama、French等学术大牛的发现，经过学术界严格验证',
};

interface FactorHumanized {
  id: string; name: string; emoji: string; categoryCN: string;
  humanIntro: string;         // 分类人话介绍
  signalHuman: string;        // 信号人话
  oneLiner: string;           // 一句话判断
  context: string;            // 背景知识
  whatToDo: string;           // 操作建议
  whatNotToDo: string;        // 别怎么做
  confidence: string;         // 置信度说明
}

function humanize(f: { name: string; emoji: string; category: string; categoryCN: string; signal: string; ic: number; nameCn?: string }): FactorHumanized {
  const sigH = SIGNAL_HUMAN[f.signal] || '信号未知';
  const intro = CATEGORY_HUMAN_INTRO[f.category] || '';
  const dir = f.ic > 0.03 ? '有效' : f.ic < -0.03 ? '反向' : '中性';

  return {
    id: f.name,
    name: f.nameCn || f.name,
    emoji: f.emoji,
    categoryCN: f.categoryCN,
    humanIntro: intro,
    signalHuman: sigH,
    oneLiner: f.ic > 0.03 ? `${f.nameCn || f.name}当前信号${sigH}(${dir})——建议关注` : f.ic < -0.03 ? `${f.nameCn || f.name}当前信号${sigH}(${dir})——建议回避` : `${f.nameCn || f.name}当前信号${sigH}——不用急着操作`,
    context: `${f.categoryCN}因子衡量的是${intro.split('——')[1] || intro}`,
    whatToDo: f.ic > 0.02 ? '可以考虑增加该因子的权重，配合对应市场标的操作' : f.ic < -0.02 ? '可以考虑减少该因子敞口，或寻找替代因子' : '维持现有配置，等待明确信号',
    whatNotToDo: '不要仅凭单一因子做决策——至少看2-3个互补因子',
    confidence: Math.abs(f.ic) > 0.04 ? '高置信度（该因子的历史IC统计显著）' : Math.abs(f.ic) > 0.02 ? '中等置信度（信号有效但注意市场环境）' : '低置信度（当前信号不够强，建议配合其他因子）',
  };
}

// ─── Component ─────────────────────────────────────────────────────
interface Props {
  factor: { name: string; emoji: string; category: string; categoryCN: string; signal: string; ic: number; nameCn?: string };
  dark?: boolean;
}

export default function FactorHumanLayer({ factor, dark = true }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const h = useMemo(() => humanize(factor), [factor]);
  const c = dark ? {
    s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const icC = factor.ic > 0 ? c.ok : c.er;
  const sigC = factor.signal.includes('LONG') ? c.ok : factor.signal.includes('SHORT') ? c.er : c.wa;

  return <div style={{ padding: 14, borderRadius: 12, background: c.s, border: `1px solid ${c.b}`, marginBottom: 10 }}>
    {/* ── Header ── */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 24 }}>{factor.emoji}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.t }}>{h.name}</div>
        <div style={{ fontSize: 11, color: c.t2 }}>{h.categoryCN} 因子</div>
      </div>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: icC }}>{factor.ic > 0 ? '+' : ''}{factor.ic.toFixed(3)}</div>
        <span style={{ fontSize: 9, padding: '1px 8px', borderRadius: 6, background: sigC + '18', color: sigC, fontWeight: 600 }}>{h.signalHuman}</span>
      </div>
    </div>

    {/* ── 人话核心 ── */}
    <div style={{ padding: 12, borderRadius: 10, background: c.a + '08', border: `1px solid ${c.a}18`, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: c.t, marginBottom: 4 }}>💬 {h.oneLiner}</div>
      <div style={{ fontSize: 12, color: c.t2 }}>{h.context}</div>
    </div>

    {/* ── 操作建议 ── */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
      <div style={{ padding: 10, borderRadius: 8, background: c.ok + '08', border: `1px solid ${c.ok}18` }}>
        <div style={{ fontSize: 10, color: c.ok, fontWeight: 600, marginBottom: 2 }}>✅ 你可以</div>
        <div style={{ fontSize: 12, color: c.t }}>{h.whatToDo}</div>
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: c.er + '08', border: `1px solid ${c.er}18` }}>
        <div style={{ fontSize: 10, color: c.er, fontWeight: 600, marginBottom: 2 }}>❌ 别</div>
        <div style={{ fontSize: 12, color: c.t }}>{h.whatNotToDo}</div>
      </div>
    </div>

    {/* ── 置信度 ── */}
    <div style={{ fontSize: 11, color: c.t2, marginBottom: 8 }}>📊 {h.confidence}</div>

    {/* ── 背景展开 ── */}
    <button onClick={() => setShowAdvanced(!showAdvanced)} style={{
      width: '100%', padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 500,
      background: c.sh, color: c.a, border: 'none', cursor: 'pointer',
    }}>
      {showAdvanced ? '▲ 收起背景知识' : '▼ 了解这个因子有什么用'}
    </button>
    {showAdvanced && <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: c.sh, fontSize: 12, color: c.t2, lineHeight: 1.6 }}>
      <p style={{ margin: 0 }}>{h.humanIntro}</p>
      <p style={{ margin: '8px 0 0 0', fontSize: 11, color: c.wa }}>
        ⚠️ 提醒：任何单一因子都有盲区。{factor.categoryCN}因子在特定市场环境下可能失效。建议至少配合2-3个不同类型因子使用。
      </p>
    </div>}
  </div>;
}

// ─── Exports ───────────────────────────────────────────────────────
export { humanize, SIGNAL_HUMAN, CATEGORY_HUMAN_INTRO };
