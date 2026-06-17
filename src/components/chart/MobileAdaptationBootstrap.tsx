import { useState } from 'react';

// ── Mobile Adaptation Bootstrap ── ML#4 R270 (2h)
// ⚠️ [R284] Contains demo/mock data. Production mode: use isProduction() guard or real API.

// Responsive layout, touch gesture hints, mobile nav

const MobileAdaptationBootstrap = () => {
  const [viewWidth, setViewWidth] = useState(375); // iPhone SE width
  const [showBreakpoints, setShowBreakpoints] = useState(true);

  const breakpoints = [
    { name: '手机竖屏', width: 375, emoji: '📱', priority: 'P0' },
    { name: '手机横屏', width: 667, emoji: '📱↔', priority: 'P1' },
    { name: '平板竖屏', width: 768, emoji: '📋', priority: 'P1' },
    { name: '平板横屏', width: 1024, emoji: '📋↔', priority: 'P2' },
    { name: '笔记本', width: 1366, emoji: '💻', priority: 'P2' },
    { name: '桌面', width: 1920, emoji: '🖥', priority: 'P3' },
  ];

  const preview = (
    <div style={{
      width: Math.max(280, Math.min(viewWidth, 600)),
      border: '2px solid #334155', borderRadius: '16px 16px 0 0',
      overflow: 'hidden', margin: '0 auto',
      background: '#0f172a',
    }}>
      {/* Mock status bar */}
      <div style={{ background: '#1e293b', padding: '4px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8' }}>
        <span>9:41</span>
        <span>📶 🔋</span>
      </div>

      {/* Mock header */}
      <div style={{ background: '#1e293b', padding: '8px 12px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9' }}>QUANT MOO</span>
          <span style={{ fontSize: 9, color: '#f59e0b' }}>v3.1.0</span>
        </div>
      </div>

      {/* Mock stock header */}
      <div style={{ padding: '10px 12px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>AAPL</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>Apple Inc. · NASDAQ</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>148.72</div>
            <div style={{ fontSize: 10, color: '#16a34a' }}>+1.24 (+0.84%)</div>
          </div>
        </div>
      </div>

      {/* Mock chart area */}
      <div style={{ height: 180, background: '#0a0f1a', display: 'flex', alignItems: 'flex-end', padding: 8, gap: 2 }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const h = 20 + Math.random() * 140;
          const green = Math.random() > 0.4;
          return (
            <div key={i} style={{ flex: 1, height: h, borderRadius: 1, background: green ? '#22c55e' : '#ef4444' }} />
          );
        })}
      </div>

      {/* Mock tabs */}
      <div style={{ display: 'flex', background: '#1e293b', borderBottom: '1px solid #334155', overflow: 'hidden' }}>
        {['📊', '📐', '📈', '🧠', '👥'].map((em, i) => (
          <button key={i} style={{
            flex: 1, padding: '6px 0', border: 'none', background: i === 0 ? '#334155' : 'transparent',
            fontSize: 12, cursor: 'pointer', color: i === 0 ? '#f1f5f9' : '#64748b',
          }}>{em}</button>
        ))}
      </div>

      {/* Mock content */}
      <div style={{ padding: '8px 12px', background: '#0f172a' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {['MA 148.0 ↑', 'RSI 54.3 →', 'MACD 金叉', 'VOL 12.5M'].map((t, i) => (
            <div key={i} style={{ padding: '6px 8px', background: '#1e293b', borderRadius: 4, fontSize: 9, color: '#94a3b8' }}>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Mock bottom bar */}
      <div style={{
        display: 'flex', background: '#1e293b', padding: '8px 12px', gap: 6,
        borderTop: '1px solid #334155',
      }}>
        <button style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>买入</button>
        <button style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>卖出</button>
      </div>
    </div>
  );

  return (
    <div className="mobile-adaptation" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 540 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>📱 移动端适配</span>
        <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={showBreakpoints} onChange={e => setShowBreakpoints(e.target.checked)} />
          显示断点
        </label>
      </div>

      {/* Width Slider */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: '#64748b' }}>280px</span>
        <input
          type="range" min={280} max={600} value={viewWidth}
          onChange={e => setViewWidth(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 9, color: '#64748b' }}>600px</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{viewWidth}px</span>
      </div>

      {/* Breakpoint Quick Select */}
      {showBreakpoints && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
          {breakpoints.map(bp => (
            <button key={bp.name} onClick={() => setViewWidth(bp.width)} style={{
              padding: '2px 6px', borderRadius: 8, border: 'none', fontSize: 8, cursor: 'pointer',
              background: Math.abs(viewWidth - bp.width) < 20 ? '#3b82f6' : '#f1f5f9',
              color: Math.abs(viewWidth - bp.width) < 20 ? 'white' : '#64748b',
            }}>
              {bp.emoji} {bp.name} · <span style={{
                color: bp.priority === 'P0' ? '#ef4444' : bp.priority === 'P1' ? '#f59e0b' : '#94a3b8',
                fontSize: 7,
              }}>{bp.priority}</span>
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      {preview}

      {/* Mobile-specific features */}
      <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#f8fafc' }}>
        <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 8, color: '#64748b' }}>
          📱 移动端专属特性
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
          {[
            { icon: '👆', title: '触摸手势', desc: '双指缩放/滑动切换周期/长按十字线' },
            { icon: '📳', title: '触觉反馈', desc: '下单/警报触发时振动' },
            { icon: '🔔', title: '移动推送', desc: '价格警报/策略信号/新闻' },
            { icon: '📲', title: '深度链接', desc: '通知直达个股详情页' },
            { icon: '🌐', title: '离线可用', desc: '缓存30天数据，断网可看' },
            { icon: '🔒', title: '生物识别', desc: 'Face ID/Touch ID登录' },
          ].map((feat, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>{feat.icon}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{feat.title}</div>
                <div style={{ color: '#94a3b8', fontSize: 8 }}>{feat.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Responsive checklist */}
      <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: '#eff6ff', fontSize: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#3b82f6' }}>✅ 响应式适配清单:</div>
        <div style={{ color: '#64748b', lineHeight: 1.6 }}>
          ✓ 布局：flexbox + grid + media query<br />
          ✓ 图表：canvas自适应 + DPR感知<br />
          ✓ 字体：rem单位 + 缩放<br />
          ✓ 触摸：44px最小触控区<br />
          ✓ 加载：320px大时优先轻量组件
        </div>
      </div>
    </div>
  );
};

export default MobileAdaptationBootstrap;
