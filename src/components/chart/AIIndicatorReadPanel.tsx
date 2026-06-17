import { useState, useMemo, useCallback } from 'react';

// ── Indicator AI Interpretation UI ── ML#2 R266 (6h)
// AI reads 15 indicators and gives human-language analysis
// Cost: 1.5 USDT/次 (per v17.6 pricing)

interface IndicatorValue {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  description: string;
}

interface AIIndicatorReadProps {
  indicators: IndicatorValue[];
  symbol: string;
  price: number;
  timeframe: string;
}

const AIIndicatorReadPanel = ({ indicators, symbol, price, timeframe }: AIIndicatorReadProps) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<null | {
    summary: string;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    compositeScore: number; // -100 to +100
    keySignals: { name: string; reading: string; level: string }[];
    riskNote: string;
    suggestion: string;
  }>(null);

  const signalGroups = useMemo(() => {
    const groups: Record<string, IndicatorValue[]> = {
      '趋势': ['MA', 'EMA', 'MACD', 'DMI', 'SAR'].map(n => indicators.find(i => i.name === n)).filter(Boolean) as IndicatorValue[],
      '动量': ['RSI', 'CCI', 'MFI', 'ROC', 'WR'].map(n => indicators.find(i => i.name === n)).filter(Boolean) as IndicatorValue[],
      '波动': ['BOLL', 'ATR', 'Keltner'].map(n => indicators.find(i => i.name === n)).filter(Boolean) as IndicatorValue[],
      '成交量': ['VOL', 'OBV', 'CMF'].map(n => indicators.find(i => i.name === n)).filter(Boolean) as IndicatorValue[],
    };
    return groups;
  }, [indicators]);

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    // Simulate AI analysis (real would call DeepSeek API)
    setTimeout(() => {
      const bullish = indicators.filter(i => i.signal === 'bullish').length;
      const bearish = indicators.filter(i => i.signal === 'bearish').length;
      const neutral = indicators.filter(i => i.signal === 'neutral').length;
      const compScore = Math.round(((bullish - bearish) / (bullish + bearish + neutral || 1)) * 100);

      setResult({
        summary: compScore > 30 ? `${symbol} 指标面偏多，${bullish}个看涨/${bearish}个看跌信号。${timeframe}周期趋势指标一致性强。`
          : compScore < -30 ? `${symbol} 指标面偏空，${bearish}个看跌/${bullish}个看涨信号。注意关键支撑位。`
          : `${symbol} 指标面中性偏震荡，${bullish}多:${bearish}空，观望或短线操作为主。`,
        bullishCount: bullish,
        bearishCount: bearish,
        neutralCount: neutral,
        compositeScore: compScore,
        keySignals: indicators
          .filter(i => Math.abs(i.strength) > 60)
          .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))
          .slice(0, 5)
          .map(i => ({
            name: i.name,
            reading: i.value.toFixed(2),
            level: i.strength > 75 ? '强烈' : i.strength > 50 ? '明显' : '一般',
          })),
        riskNote: indicators.some(i => i.name === 'ATR' && i.value > (price * 0.03))
          ? '⚠️ ATR偏高，波动加大，适当缩小仓位'
          : '波动正常，风险可控',
        suggestion: compScore > 40 ? '可关注回调买入机会' : compScore < -40 ? '建议观望或减仓' : '短线可做T，中长线等趋势明朗',
      });
      setAnalyzing(false);
    }, 1200);
  }, [indicators, symbol, price, timeframe]);

  return (
    <div className="indicator-ai-read" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 13, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🧠 指标AI解读</span>
        <span style={{ fontSize: 10, color: '#f59e0b', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
          1.5 USDT/次
        </span>
      </div>

      {/* Indicator Signal Overview */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        {Object.entries(signalGroups).map(([group, inds]) => (
          <div key={group} style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>{group}</div>
            {inds.map(ind => (
              <div key={ind.name} style={{
                display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2,
                fontSize: 10, padding: '1px 4px', borderRadius: 3,
                background: ind.signal === 'bullish' ? '#dcfce7' : ind.signal === 'bearish' ? '#fef2f2' : '#f8fafc',
              }}>
                <span style={{ fontWeight: 600 }}>{ind.name}</span>
                <span style={{
                  color: ind.signal === 'bullish' ? '#16a34a' : ind.signal === 'bearish' ? '#dc2626' : '#64748b',
                  fontSize: 9,
                }}>
                  {ind.signal === 'bullish' ? '↑' : ind.signal === 'bearish' ? '↓' : '–'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Analyze Button */}
      {!result && (
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          style={{
            width: '100%', padding: '8px 0', border: 'none', borderRadius: 6,
            background: analyzing ? '#93c5fd' : '#3b82f6', color: 'white',
            fontWeight: 600, cursor: analyzing ? 'default' : 'pointer', fontSize: 13,
          }}
        >
          {analyzing ? '⏳ AI分析中...' : '🔍 一键解读 (1.5 USDT)'}
        </button>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 10 }}>
          {/* Score Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              flex: 1, height: 8, borderRadius: 4,
              background: `linear-gradient(to right, #dc2626, #fbbf24 50%, #16a34a)`,
            }}>
              <div style={{
                height: 8, width: `${Math.abs(result.compositeScore)}%`,
                marginLeft: result.compositeScore >= 0 ? '50%' : `${50 - Math.abs(result.compositeScore)}%`,
                background: result.compositeScore >= 0 ? '#16a34a' : '#dc2626',
                borderRadius: 4, transition: 'width 0.5s',
              }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: result.compositeScore >= 0 ? '#16a34a' : '#dc2626' }}>
              {result.compositeScore > 0 ? '+' : ''}{result.compositeScore}
            </span>
          </div>

          {/* Summary */}
          <div style={{
            background: '#f0f9ff', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 8,
            borderLeft: '3px solid #3b82f6',
          }}>
            {result.summary}
          </div>

          {/* Key Signals */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>🔑 关键信号:</div>
            {result.keySignals.map((sig, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                <span style={{ fontWeight: 500 }}>{sig.name}</span>
                <span>{sig.reading}</span>
                <span style={{ color: '#f59e0b', fontSize: 10 }}>{sig.level}</span>
              </div>
            ))}
          </div>

          {/* Risk + Suggestion */}
          <div style={{ fontSize: 11, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>⚠️ 风险: </span>
            <span style={{ color: '#dc2626' }}>{result.riskNote}</span>
          </div>
          <div style={{ fontSize: 11 }}>
            <span style={{ fontWeight: 600 }}>💡 建议: </span>
            <span style={{ color: '#3b82f6' }}>{result.suggestion}</span>
          </div>

          {/* Re-analyze */}
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            style={{
              width: '100%', marginTop: 8, padding: 6, border: '1px solid #d1d5db',
              borderRadius: 6, background: 'white', fontSize: 11, cursor: 'pointer',
            }}
          >
            {analyzing ? '⏳ ...' : '🔄 重新分析'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!result && !analyzing && (
        <div style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 11 }}>
          点击按钮，AI将综合分析 {indicators.length} 个指标的信号强度和一致性
        </div>
      )}
    </div>
  );
};

export default AIIndicatorReadPanel;
