import { useState, useMemo } from 'react';

// ── Reverse Perspective / Bear Case Panel ── ML#7 R266 (2h)
// Shows the opposite viewpoint: why the trade could go wrong
// Behavioral finance: counters confirmation bias

interface Arguments {
  bullish: string[];
  bearish: string[];
  unknownUnknowns: string[];
}

interface ReversePerspectivePanelProps {
  symbol: string;
  price: number;
  changePct: number;
  arguments_: Arguments;
  consensusRating?: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

const ReversePerspectivePanel = ({
  symbol, price, changePct, arguments_, consensusRating = 'hold',
}: ReversePerspectivePanelProps) => {
  const [viewMode, setViewMode] = useState<'default' | 'reverse' | 'whatif'>('default');
  const [whatIfPct, setWhatIfPct] = useState(10);

  const isBullish = consensusRating === 'strong_buy' || consensusRating === 'buy';
  const isBearish = consensusRating === 'sell' || consensusRating === 'strong_sell';

  const dominantView = isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral';

  // Reverse perspective argument
  const reverseArgs = useMemo(() => {
    if (dominantView === 'bullish') return arguments_.bearish;
    if (dominantView === 'bearish') return arguments_.bullish;
    return [...arguments_.bearish, ...arguments_.bullish];
  }, [dominantView, arguments_]);

  // What-if scenarios
  const whatIfScenarios = useMemo(() => {
    const targetUp = price * (1 + whatIfPct / 100);
    const targetDown = price * (1 - whatIfPct / 100);
    return {
      up: {
        price: targetUp,
        gain: (targetUp - price).toFixed(2),
        triggers: ['财报超预期', '行业政策利好', '大资金进场', '技术突破', '降息预期'],
      },
      down: {
        price: targetDown,
        loss: (price - targetDown).toFixed(2),
        triggers: ['财报不及预期', '监管政策收紧', '大股东减持', '行业竞争加剧', '宏观衰退'],
      },
    };
  }, [price, whatIfPct]);

  const ratingLabel = {
    strong_buy: '强烈买入',
    buy: '买入',
    hold: '持有',
    sell: '卖出',
    strong_sell: '强烈卖出',
  }[consensusRating];

  const ratingColor = {
    strong_buy: '#16a34a',
    buy: '#22c55e',
    hold: '#f59e0b',
    sell: '#ef4444',
    strong_sell: '#dc2626',
  }[consensusRating];

  return (
    <div className="reverse-perspective" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 13, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🪞 反向观点</span>
        <span style={{
          fontSize: 10, padding: '1px 8px', borderRadius: 10,
          background: ratingColor + '15', color: ratingColor, fontWeight: 600,
        }}>
          共识: {ratingLabel}
        </span>
      </div>

      {/* View Mode Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {[
          { key: 'default' as const, label: '当前共识', emoji: '👥' },
          { key: 'reverse' as const, label: '反向论证', emoji: '🪞' },
          { key: 'whatif' as const, label: '情景推演', emoji: '🎭' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
              background: viewMode === tab.key ? '#3b82f6' : '#f1f5f9',
              color: viewMode === tab.key ? 'white' : '#64748b',
              fontWeight: viewMode === tab.key ? 600 : 400, fontSize: 11, cursor: 'pointer',
            }}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Default View: Both sides shown */}
      {viewMode === 'default' && (
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
            当前 {symbol} @ {price.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)，市场共识偏{dominantView === 'bullish' ? '乐观' : dominantView === 'bearish' ? '悲观' : '中性'}
          </div>

          {/* Bull Case */}
          <div style={{
            padding: 8, borderRadius: 6, marginBottom: 8,
            background: '#f0fdf4', borderLeft: '3px solid #16a34a',
          }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#16a34a', marginBottom: 4 }}>🟢 看多理由</div>
            {arguments_.bullish.map((arg, i) => (
              <div key={i} style={{ fontSize: 11, padding: '2px 0', display: 'flex', gap: 4 }}>
                <span style={{ color: '#16a34a' }}>✓</span>
                <span>{arg}</span>
              </div>
            ))}
          </div>

          {/* Bear Case */}
          <div style={{
            padding: 8, borderRadius: 6, marginBottom: 8,
            background: '#fef2f2', borderLeft: '3px solid #dc2626',
          }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#dc2626', marginBottom: 4 }}>🔴 看空理由</div>
            {arguments_.bearish.map((arg, i) => (
              <div key={i} style={{ fontSize: 11, padding: '2px 0', display: 'flex', gap: 4 }}>
                <span style={{ color: '#dc2626' }}>✗</span>
                <span>{arg}</span>
              </div>
            ))}
          </div>

          {/* Unknown Unknowns */}
          {arguments_.unknownUnknowns.length > 0 && (
            <div style={{
              padding: 8, borderRadius: 6, background: '#faf5ff', borderLeft: '3px solid #a855f7',
            }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#a855f7', marginBottom: 4 }}>❓ 未知因素</div>
              {arguments_.unknownUnknowns.map((arg, i) => (
                <div key={i} style={{ fontSize: 11, padding: '2px 0', display: 'flex', gap: 4 }}>
                  <span style={{ color: '#a855f7' }}>?</span>
                  <span>{arg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reverse View */}
      {viewMode === 'reverse' && (
        <div>
          <div style={{
            padding: 8, borderRadius: 6, marginBottom: 8,
            background: '#fef9c3', borderLeft: '3px solid #f59e0b',
            fontSize: 11,
          }}>
            <span style={{ fontWeight: 600 }}>💡 换个角度: </span>
            当前市场共识是<b>{ratingLabel}</b>，
            但历史上共识<i>高度一致时往往不是最佳入场时机</i>。
            以下是反向论证:
          </div>

          {reverseArgs.map((arg, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 6, marginBottom: 4,
              background: '#f8fafc', border: '1px solid #e5e7eb',
            }}>
              <span style={{ fontSize: 16, minWidth: 24, textAlign: 'center' }}>
                {dominantView === 'bullish' ? '🐻' : '🐂'}
              </span>
              <div style={{ flex: 1, fontSize: 11 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {dominantView === 'bullish' ? '空方视角:' : '多方视角:'}
                </div>
                <div style={{ color: '#64748b', lineHeight: 1.4 }}>{arg}</div>
              </div>
            </div>
          ))}

          <div style={{
            marginTop: 8, padding: 8, background: '#f0f9ff', borderRadius: 6,
            fontSize: 10, color: '#64748b',
          }}>
            🧠 心理学提示: 人类天生有"确认偏误"——只看到支持自己观点的证据。
            主动寻找反向论证是最便宜的保险。
          </div>
        </div>
      )}

      {/* What-If Scenarios */}
      {viewMode === 'whatif' && (
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
            当前节点: {symbol} @ {price.toFixed(2)} · 假想变动
          </div>

          {/* What-if slider */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>±</span>
            <input
              type="range"
              min={1}
              max={50}
              value={whatIfPct}
              onChange={e => setWhatIfPct(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{whatIfPct}%</span>
          </div>

          {/* Up Scenario */}
          <div style={{
            padding: 10, borderRadius: 8, marginBottom: 8,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#16a34a' }}>📈 上涨 {whatIfPct}%</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                {whatIfScenarios.up.price.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#16a34a', marginBottom: 6 }}>盈利 +{whatIfScenarios.up.gain}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>可能触发因素:</div>
            {whatIfScenarios.up.triggers.map((t, i) => (
              <span key={i} style={{
                display: 'inline-block', padding: '1px 6px', margin: '2px 4px 2px 0',
                background: '#dcfce7', borderRadius: 10, fontSize: 9, color: '#16a34a',
              }}>
                {t}
              </span>
            ))}
          </div>

          {/* Down Scenario */}
          <div style={{
            padding: 10, borderRadius: 8, marginBottom: 8,
            background: '#fef2f2', border: '1px solid #fecaca',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#dc2626' }}>📉 下跌 {whatIfPct}%</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>
                {whatIfScenarios.down.price.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#dc2626', marginBottom: 6 }}>亏损 -{whatIfScenarios.down.loss}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>可能触发因素:</div>
            {whatIfScenarios.down.triggers.map((t, i) => (
              <span key={i} style={{
                display: 'inline-block', padding: '1px 6px', margin: '2px 4px 2px 0',
                background: '#fef2f2', borderRadius: 10, fontSize: 9, color: '#dc2626',
              }}>
                {t}
              </span>
            ))}
          </div>

          {/* Actionable takeaways */}
          <div style={{
            padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 10, color: '#64748b', lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>💭 决策清单:</div>
            <div>• 如果涨{whatIfPct}%，我会怎么做？加仓/止盈/不动？</div>
            <div>• 如果跌{whatIfPct}%，我还能睡得着吗？</div>
            <div>• 这个跌幅在我的止损范围内吗？</div>
            <div>• 有没有对冲手段（期权/减仓/分散）？</div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{
        marginTop: 10, padding: 8, background: '#f8fafc',
        borderRadius: 6, fontSize: 10, color: '#94a3b8', textAlign: 'center',
      }}>
        🧘 投资不是选举——不用选边站。理解多空双方的理由，让自己的决策更有弹性。
      </div>
    </div>
  );
};

export default ReversePerspectivePanel;
