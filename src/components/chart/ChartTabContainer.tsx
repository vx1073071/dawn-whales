import { useState } from 'react';

// ── New Panel Integration: K-line Tabs ── ML#1 R271 (3h)
// Container that orchestrates all chart sub-panels into tabbed layout

type ChartPanelTab = 'kline' | 'tick' | 'footprint' | 'dom' | 'volume' | 'indicators' | 'drawing' | 'ai';

interface ChartTabContainerProps {
  symbol: string;
  defaultTab?: ChartPanelTab;
}

const ChartTabContainer = ({ symbol, defaultTab = 'kline' }: ChartTabContainerProps) => {
  const [activeTab, setActiveTab] = useState<ChartPanelTab>(defaultTab);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<'tools' | 'indicators' | 'patterns' | 'info'>('tools');

  const tabs: { key: ChartPanelTab; label: string; emoji: string; shortcut: string }[] = [
    { key: 'kline', label: 'K线', emoji: '📊', shortcut: '1' },
    { key: 'tick', label: '分时', emoji: '📈', shortcut: '2' },
    { key: 'footprint', label: '脚印', emoji: '👣', shortcut: '3' },
    { key: 'dom', label: 'DOM', emoji: '📖', shortcut: '4' },
    { key: 'volume', label: '量', emoji: '📦', shortcut: '5' },
    { key: 'indicators', label: '指标', emoji: '📐', shortcut: '6' },
    { key: 'drawing', label: '画线', emoji: '✏️', shortcut: '7' },
    { key: 'ai', label: 'AI', emoji: '🧠', shortcut: '8' },
  ];

  // Panel placeholders — real content goes in children slots
  const panelContent: Record<ChartPanelTab, string> = {
    kline: '📊 K线 / 蜡烛图 / 时间周期切换',
    tick: '📈 分时走势 / 均价线 / 昨日收盘参考',
    footprint: '👣 Footprint 脚印图 / Bid-Ask成交量',
    dom: '📖 DOM 订单簿深度 / 5-50档',
    volume: '📦 Volume Profile / 成交量分布',
    indicators: '📐 93个指标 / 6大类',
    drawing: '✏️ 68个画线工具',
    ai: '🧠 AI解读 / AI画线 / 反向观点',
  };

  return (
    <div style={{ fontFamily: 'system-ui', fontSize: 12, display: 'flex', height: '100%' }}>
      {/* ── Main Chart Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', borderBottom: '2px solid #e5e7eb',
          background: 'white', padding: '0 8px', overflowX: 'auto',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={`${tab.label} (${tab.shortcut})`}
              style={{
                padding: '8px 12px', border: 'none', background: 'transparent',
                borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.key ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === tab.key ? 600 : 400,
                fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                marginBottom: -2, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.emoji}</span>
              <span>{tab.label}</span>
              <kbd style={{
                fontSize: 7, background: '#f1f5f9', padding: '0 3px', borderRadius: 2,
                color: '#94a3b8',
              }}>{tab.shortcut}</kbd>
            </button>
          ))}

          {/* Toolbar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              marginLeft: 'auto', padding: '4px 8px', borderRadius: 4,
              border: '1px solid #e5e7eb', background: 'white', fontSize: 10, cursor: 'pointer',
              color: '#64748b',
            }}
          >
            {sidebarOpen ? '◀ 收起' : '▶ 工具'}
          </button>
        </div>

        {/* Chart Content */}
        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tabs.find(t => t.key === activeTab)?.emoji}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {tabs.find(t => t.key === activeTab)?.label} — {symbol}
            </div>
            <div>{panelContent[activeTab]}</div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
              快捷键: {activeTab} = 数字键 {tabs.find(t => t.key === activeTab)?.shortcut}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div style={{
          width: 240, borderLeft: '1px solid #e5e7eb', background: 'white',
          display: 'flex', flexDirection: 'column', fontSize: 11,
        }}>
          {/* Sidebar tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {[
              { key: 'tools' as const, label: '✏️ 工具' },
              { key: 'indicators' as const, label: '📐 指标' },
              { key: 'patterns' as const, label: '🔍 形态' },
              { key: 'info' as const, label: 'ℹ️ 信息' },
            ].map(sb => (
              <button key={sb.key} onClick={() => setSidebarPanel(sb.key)} style={{
                flex: 1, padding: '6px 0', border: 'none', background: sidebarPanel === sb.key ? '#f1f5f9' : 'transparent',
                fontSize: 9, cursor: 'pointer', borderBottom: sidebarPanel === sb.key ? '2px solid #3b82f6' : '2px solid transparent',
                color: sidebarPanel === sb.key ? '#3b82f6' : '#64748b',
              }}>{sb.label}</button>
            ))}
          </div>

          {/* Sidebar content */}
          <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
            {sidebarPanel === 'tools' && (
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>画线工具 (68)</div>
                <div>━ 水平线 (H) / 趋势线 (T)</div>
                <div>φ 斐波回撤 (F) / 扩展</div>
                <div>▭ 矩形 (U) / 椭圆 (O)</div>
                <div>🔺 江恩扇 (G) / 四方</div>
                <div>🦋 和谐形态 / 波浪</div>
                <div></div>
                <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>图表控制</div>
                <div>🔄 重置视图 (R)</div>
                <div>📷 截图 (Ctrl+Shift+S)</div>
                <div>📥 导出数据 (Ctrl+E)</div>
              </div>
            )}
            {sidebarPanel === 'indicators' && (
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>活跃指标</div>
                <div>📈 MA20 / MA60</div>
                <div>⚡ RSI(14)</div>
                <div>📶 MACD(12,26,9)</div>
                <div>🎗️ BOLL(20,2)</div>
                <div></div>
                <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>快速模板</div>
                <div>📊 基础 / 趋势 / 动量 / 波动</div>
                <div>🇨🇳 A股专用 / 日内交易</div>
              </div>
            )}
            {sidebarPanel === 'patterns' && (
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>检测到形态</div>
                <div>✅ W双底 (可靠 8/10)</div>
                <div>✅ 上升三角 (可靠 7/10)</div>
                <div></div>
                <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>形态库 (31)</div>
                <div>反转 15 / 持续 12 / 和谐 5</div>
                <div>波浪 6 / 单根 8 / 多根 8</div>
              </div>
            )}
            {sidebarPanel === 'info' && (
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>快捷键速查</div>
                <div>1-8 = 切换Tab</div>
                <div>←→ = 切换时间周期</div>
                <div>空格 = 播放/暂停</div>
                <div>R = 重置视图</div>
                <div>L = Level-2 / O = 下单</div>
                <div>S = 分屏 / C = 十字线</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartTabContainer;
