import { useState } from 'react';

// ── Indicator Color & Grouping ── ML#2 R268 (3h)
// Color management, indicator groups, layout presets

interface ColorScheme {
  name: string;
  colors: string[];
  theme: 'light' | 'dark';
}

interface IndicatorGroup {
  id: string;
  name: string;
  indicators: string[];
  isDefault?: boolean;
}

interface IndicatorColorGroupPanelProps {
  activeIndicators: string[];
  indicatorColors: Record<string, string>;
  onColorChange: (id: string, color: string) => void;
  onGroupApply: (indicators: string[]) => void;
}

const PRESET_SCHEMES: ColorScheme[] = [
  { name: '经典', theme: 'light', colors: ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6'] },
  { name: 'TradingView', theme: 'dark', colors: ['#2962FF', '#E91E63', '#00E676', '#FFD600', '#651FFF', '#F50057', '#00E5FF', '#FF6D00', '#76FF03', '#1DE9B6'] },
  { name: 'Bloomberg', theme: 'dark', colors: ['#FF6600', '#00CC00', '#FF0000', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#FF9900', '#66FF00', '#FF3399'] },
  { name: '色盲友好', theme: 'light', colors: ['#0072B2', '#D55E00', '#009E73', '#F0E442', '#CC79A7', '#56B4E9', '#E69F00', '#000000', '#999999', '#666666'] },
  { name: '柔和', theme: 'light', colors: ['#7C9CBF', '#E88D7D', '#82B1A5', '#E8C77D', '#B08CBD', '#8ECAE6', '#F4A261', '#A8DADC', '#E9C46A', '#C3B299'] },
  { name: '高对比', theme: 'dark', colors: ['#FF4136', '#0074D9', '#2ECC40', '#FFDC00', '#B10DC9', '#01FF70', '#7FDBFF', '#F012BE', '#3D9970', '#001F3F'] },
];

const PRESET_GROUPS: IndicatorGroup[] = [
  { id: 'basic', name: '基础组合', indicators: ['ma', 'vol'], isDefault: true },
  { id: 'trend_set', name: '趋势套装', indicators: ['ma', 'ema', 'macd', 'adx'], isDefault: true },
  { id: 'mom_set', name: '动量套装', indicators: ['rsi', 'stoch', 'cci', 'mfi'], isDefault: true },
  { id: 'vol_set', name: '波动套装', indicators: ['boll', 'atr', 'keltner'], isDefault: true },
  { id: 'volume_set', name: '成交量套装', indicators: ['vol', 'obv', 'emv'], isDefault: true },
  { id: 'china_set', name: 'A股专用', indicators: ['chipPct', 'fundFlow', 'northBound', 'longHu'], isDefault: true },
  { id: 'day_trade', name: '日内交易', indicators: ['ema', 'vol', 'vwap', 'boll'], isDefault: true },
];

const IndicatorColorGroupPanel = ({ activeIndicators, indicatorColors, onColorChange, onGroupApply }: IndicatorColorGroupPanelProps) => {
  const [activeScheme, setActiveScheme] = useState('经典');
  const [customGroups, setCustomGroups] = useState<IndicatorGroup[]>([]);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const allGroups = [...PRESET_GROUPS, ...customGroups];

  const selectedScheme = PRESET_SCHEMES.find(s => s.name === activeScheme) || PRESET_SCHEMES[0];

  const applyScheme = (scheme: string) => {
    setActiveScheme(scheme);
    const s = PRESET_SCHEMES.find(sc => sc.name === scheme);
    if (!s) return;
    activeIndicators.forEach((id, i) => {
      onColorChange(id, s.colors[i % s.colors.length]);
    });
  };

  const saveCustomGroup = () => {
    if (!newGroupName || activeIndicators.length === 0) return;
    setCustomGroups([...customGroups, { id: `custom_${Date.now()}`, name: newGroupName, indicators: [...activeIndicators] }]);
    setNewGroupName('');
    setShowCustomEditor(false);
  };

  const removeGroup = (id: string) => {
    setCustomGroups(customGroups.filter(g => g.id !== id));
  };

  return (
    <div className="indicator-color-group" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🎨 指标颜色/分组</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{activeIndicators.length} 活跃指标</span>
      </div>

      {/* ── Color Schemes ── */}
      <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6, color: '#64748b' }}>🎨 配色方案</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESET_SCHEMES.map(scheme => (
          <button
            key={scheme.name}
            onClick={() => applyScheme(scheme.name)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: activeScheme === scheme.name ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              background: activeScheme === scheme.name ? '#eff6ff' : 'white', fontSize: 10, cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
              {scheme.colors.slice(0, 5).map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <span style={{ fontSize: 9, color: activeScheme === scheme.name ? '#3b82f6' : '#64748b' }}>
              {scheme.name} {scheme.theme === 'dark' ? '🌙' : '☀️'}
            </span>
          </button>
        ))}
      </div>

      {/* ── Individual Color Picker ── */}
      <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6, color: '#64748b' }}>🖌 单独设置</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {activeIndicators.map(id => (
          <div key={id} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
            borderRadius: 16, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 10,
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: indicatorColors[id] || selectedScheme.colors[activeIndicators.indexOf(id) % selectedScheme.colors.length],
              border: '1px solid rgba(0,0,0,0.1)',
            }} />
            <span style={{ fontWeight: 500 }}>{id.toUpperCase()}</span>
            <input
              type="color"
              value={indicatorColors[id] || '#3b82f6'}
              onChange={e => onColorChange(id, e.target.value)}
              style={{ width: 16, height: 16, border: 'none', cursor: 'pointer', background: 'transparent' }}
            />
          </div>
        ))}
      </div>

      {/* ── Preset Groups ── */}
      <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6, color: '#64748b' }}>
        📂 预设分组
        <button onClick={() => setShowCustomEditor(true)} style={{
          marginLeft: 8, padding: '1px 8px', borderRadius: 10, border: 'none',
          background: '#3b82f6', color: 'white', fontSize: 9, cursor: 'pointer',
        }}>+ 新建</button>
      </div>

      {/* Custom Group Editor */}
      {showCustomEditor && (
        <div style={{
          padding: 8, borderRadius: 6, background: '#f0f9ff', marginBottom: 8,
          border: '1px solid #bae6fd',
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="分组名称"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10 }}
            />
            <button onClick={saveCustomGroup} style={{
              padding: '4px 12px', borderRadius: 4, border: 'none',
              background: '#16a34a', color: 'white', fontSize: 10, cursor: 'pointer',
            }}>保存</button>
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
            保存当前 {activeIndicators.length} 个活跃指标为分组
          </div>
        </div>
      )}

      {/* Group Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {allGroups.map(group => (
          <div key={group.id} style={{
            padding: 6, borderRadius: 6, border: '1px solid #e5e7eb',
            background: 'white', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }} onClick={() => onGroupApply(group.indicators)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
                {group.name}
                {!group.isDefault && (
                  <button onClick={e => { e.stopPropagation(); removeGroup(group.id); }} style={{
                    marginLeft: 4, border: 'none', background: 'transparent', color: '#dc2626', fontSize: 10, cursor: 'pointer',
                  }}>✕</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {group.indicators.slice(0, 6).map((id, i) => (
                  <span key={i} style={{
                    fontSize: 8, padding: '0 4px', borderRadius: 4,
                    background: selectedScheme.colors[i % selectedScheme.colors.length] + '20',
                    color: selectedScheme.colors[i % selectedScheme.colors.length],
                  }}>{id.toUpperCase()}</span>
                ))}
                {group.indicators.length > 6 && (
                  <span style={{ fontSize: 8, color: '#94a3b8' }}>+{group.indicators.length - 6}</span>
                )}
              </div>
            </div>
            <span style={{ fontSize: 14, color: '#94a3b8' }}>→</span>
          </div>
        ))}
      </div>

      {/* Tip */}
      <div style={{
        marginTop: 10, padding: 8, background: '#f8fafc', borderRadius: 6,
        fontSize: 9, color: '#94a3b8', lineHeight: 1.5,
      }}>
        💡 点击分组可一键应用；颜色方案会应用于所有已激活指标；色盲友好方案确保可读性。
      </div>
    </div>
  );
};

export { PRESET_SCHEMES, PRESET_GROUPS };
export default IndicatorColorGroupPanel;
