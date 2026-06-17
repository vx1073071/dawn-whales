import { useState } from 'react';

// ── 68 Drawing Tools Replacement Wrapper ── ML#6 R271 (3h)
// Wraps the old DrawingToolbar with the new 68-tool DrawingToolboxMIT

interface DrawingReplacementProps {
  symbol: string;
  onToolSelect: (toolId: string) => void;
  activeTool?: string;
}

const DrawingReplacementWrapper = ({ onToolSelect }: DrawingReplacementProps) => {
  const [recentTools, setRecentTools] = useState<string[]>(['trend_line', 'horiz_line', 'fib_retrace']);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Quick access groups (condensed 68 → top 24)
  const quickGroups = [
    {
      name: '常用',
      tools: [
        { id: 'trend_line', icon: '╱', label: '趋势', shortcut: 'T' },
        { id: 'horiz_line', icon: '━', label: '水平', shortcut: 'H' },
        { id: 'fib_retrace', icon: 'φ', label: '斐波', shortcut: 'F' },
        { id: 'rectangle', icon: '▭', label: '矩形', shortcut: 'U' },
        { id: 'text', icon: 'T', label: '文字', shortcut: 'N' },
        { id: 'arrow', icon: '➤', label: '箭头', shortcut: 'W' },
      ],
    },
    {
      name: '通道',
      tools: [
        { id: 'parallel_channel', icon: '⏸', label: '平行', shortcut: 'Shift+P' },
        { id: 'andrews_pitchfork', icon: '🪶', label: '叉', shortcut: 'Alt+A' },
        { id: 'linreg_channel', icon: '📈', label: '回归', shortcut: 'Shift+L' },
      ],
    },
    {
      name: '形态',
      tools: [
        { id: 'gartley', icon: '🦋', label: 'Gartley', shortcut: 'Alt+1' },
        { id: 'double_bottom', icon: 'W', label: 'W底', shortcut: '' },
        { id: 'head_shoulders', icon: '👤', label: '头肩', shortcut: '' },
      ],
    },
    {
      name: '测量',
      tools: [
        { id: 'ruler', icon: '📏', label: '测距', shortcut: 'M' },
        { id: 'risk_reward', icon: '⚖️', label: '风报', shortcut: 'Shift+M' },
        { id: 'long_pos', icon: '📈', label: '做多', shortcut: 'Alt+L' },
      ],
    },
  ];

  const handleToolClick = (toolId: string) => {
    setSelectedTool(selectedTool === toolId ? null : toolId);
    onToolSelect(toolId);
    // Add to recent
    setRecentTools(prev => {
      const next = [toolId, ...prev.filter(t => t !== toolId)].slice(0, 8);
      return next;
    });
  };

  return (
    <div style={{ padding: 8, fontFamily: 'system-ui', fontSize: 11, background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
      {/* Quick Groups */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {quickGroups.map(group => (
          <div key={group.name} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', minWidth: 28, textAlign: 'right' }}>{group.name}</span>
            {group.tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                style={{
                  padding: '4px 8px', borderRadius: 4, border: `1px solid ${selectedTool === tool.id ? '#3b82f6' : '#e5e7eb'}`,
                  background: selectedTool === tool.id ? '#eff6ff' :
                               recentTools.slice(0, 4).includes(tool.id) ? '#fefce8' : 'white',
                  cursor: 'pointer', fontSize: 11, minWidth: 28,
                  color: selectedTool === tool.id ? '#3b82f6' : '#64748b',
                }}
              >
                {tool.icon}
              </button>
            ))}
          </div>
        ))}

        {/* More button (opens full 68 toolbox) */}
        <button
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb',
            background: 'white', cursor: 'pointer', fontSize: 10, color: '#3b82f6', marginLeft: 'auto',
          }}
          title="全部68个画线工具"
        >
          全部68 ▾
        </button>
      </div>

      {/* Active tool indicator */}
      {selectedTool && (
        <div style={{
          marginTop: 4, padding: '4px 8px', borderRadius: 4,
          background: '#eff6ff', fontSize: 9, color: '#3b82f6',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>✅ 当前工具: {selectedTool.replace(/_/g, ' ')}</span>
          <span style={{ color: '#94a3b8' }}>点击图表绘制 | Esc 取消 | Ctrl+Z 撤销</span>
        </div>
      )}
    </div>
  );
};

export default DrawingReplacementWrapper;
