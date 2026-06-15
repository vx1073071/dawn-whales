// ── R224 ML#1 (G1+G2): 图表工具栏自定义 + 面板状态记忆 ──────────────────
// G1: 可自定义的K线图工具栏 (指标开关/周期/复权 持久化到localStorage)
// G2: 面板折叠状态记忆 (persisted to localStorage across sessions)
// 9语言i18n

import { useState, useCallback } from 'react';
import { Tooltip, message } from 'antd';
import {
  SettingOutlined, ReloadOutlined,
  EyeOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import i18n from '../../i18n';

const I18N = (k: string) => i18n.t(`chartToolbar.${k}`);

// ═══════════════════════════════════════════════════════════════════════
// G1: 图表工具栏自定义
// ═══════════════════════════════════════════════════════════════════════

export interface ChartToolbarConfig {
  showVolume: boolean;
  showCrosshair: boolean;
  showTooltip: boolean;
  showLegend: boolean;
  showZoom: boolean;
  showIndicators: boolean;
  timeframe: string;
  candleType: string;
  theme: 'dark' | 'light';
}

const DEFAULT_CONFIG: ChartToolbarConfig = {
  showVolume: true,
  showCrosshair: true,
  showTooltip: true,
  showLegend: true,
  showZoom: true,
  showIndicators: true,
  timeframe: 'D',
  candleType: 'candle',
  theme: 'dark',
};

const STORAGE_KEY = 'dw_chart_toolbar_v2';

function loadConfig(): ChartToolbarConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: ChartToolbarConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
}

export function useChartToolbarConfig() {
  const [config, setConfigState] = useState<ChartToolbarConfig>(loadConfig);

  const setConfig = useCallback((partial: Partial<ChartToolbarConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }, []);

  const toggle = useCallback((key: keyof ChartToolbarConfig) => {
    setConfig({ [key]: !config[key] });
  }, [config, setConfig]);

  const reset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    message.success(I18N('resetToDefault'));
  }, [setConfig]);

  return { config, setConfig, toggle, reset };
}

/** 工具栏UI组件 */
export function ChartToolbarPanel({
  config, onToggle, onReset,
}: {
  config: ChartToolbarConfig;
  onToggle: (key: keyof ChartToolbarConfig) => void;
  onReset: () => void;
}) {
  const items: Array<{ key: keyof ChartToolbarConfig; label: string; icon: React.ReactNode }> = [
    { key: 'showVolume', label: I18N('volume'), icon: '📊' },
    { key: 'showCrosshair', label: I18N('crosshair'), icon: '➕' },
    { key: 'showTooltip', label: I18N('tooltip'), icon: '💬' },
    { key: 'showLegend', label: I18N('legend'), icon: '🏷️' },
    { key: 'showZoom', label: I18N('zoom'), icon: '🔍' },
    { key: 'showIndicators', label: I18N('indicators'), icon: '📈' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
      background: '#1a1a25', border: '1px solid #2a2d3e', borderRadius: 8,
      flexWrap: 'wrap',
    }}>
      <SettingOutlined style={{ color: '#9ca3af', fontSize: 14 }} />
      {items.map(item => (
        <Tooltip key={item.key} title={item.label}>
          <span
            onClick={() => onToggle(item.key)}
            style={{
              cursor: 'pointer', padding: '2px 8px', borderRadius: 4, fontSize: 12,
              background: config[item.key] ? '#D4A85320' : 'transparent',
              color: config[item.key] ? '#D4A853' : '#6b7280',
              border: `1px solid ${config[item.key] ? '#D4A85340' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {config[item.key] ? <EyeOutlined style={{ fontSize: 10 }} /> : <EyeInvisibleOutlined style={{ fontSize: 10 }} />}
          </span>
        </Tooltip>
      ))}
      <Tooltip title={I18N('reset')}>
        <ReloadOutlined onClick={onReset} style={{ cursor: 'pointer', color: '#6b7280', fontSize: 12 }} />
      </Tooltip>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// G2: 面板状态记忆
// ═══════════════════════════════════════════════════════════════════════

export interface PanelState {
  id: string;
  collapsed: boolean;
  width?: number;
  height?: number;
  order?: number;
  visible: boolean;
}

const PANEL_STORAGE_KEY = 'dw_panel_states_v2';

function loadPanelStates(): Record<string, PanelState> {
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function savePanelStates(states: Record<string, PanelState>) {
  try { localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(states)); } catch {}
}

export function usePanelState(panelId: string, defaults: Partial<PanelState> = {}) {
  const defaultState: PanelState = {
    id: panelId,
    collapsed: false,
    visible: true,
    order: 0,
    ...defaults,
  };

  const [state, setState] = useState<PanelState>(() => {
    const saved = loadPanelStates();
    return { ...defaultState, ...(saved[panelId] || {}) };
  });

  const updateState = useCallback((partial: Partial<PanelState>) => {
    setState(prev => {
      const next = { ...prev, ...partial };
      const all = loadPanelStates();
      all[panelId] = next;
      savePanelStates(all);
      return next;
    });
  }, [panelId]);

  const toggleCollapse = useCallback(() => {
    updateState({ collapsed: !state.collapsed });
  }, [state.collapsed, updateState]);

  const toggleVisibility = useCallback(() => {
    updateState({ visible: !state.visible });
  }, [state.visible, updateState]);

  return {
    state,
    updateState,
    toggleCollapse,
    toggleVisibility,
    isCollapsed: state.collapsed,
    isVisible: state.visible,
  };
}

/** 小型面板折叠控制栏 */
export function PanelControlBar({
  panelId, state, onToggle, onVisibility,
}: {
  panelId: string;
  state: PanelState;
  onToggle: () => void;
  onVisibility: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px',
      background: '#1a1a25', borderBottom: '1px solid #2a2d3e',
      fontSize: 11,
    }}>
      <span style={{ flex: 1, color: '#9ca3af', fontWeight: 600 }}>{panelId}</span>
      <Tooltip title={state.visible ? I18N('hidePanel') : I18N('showPanel')}>
        <span onClick={onVisibility} style={{ cursor: 'pointer', color: state.visible ? '#22c55e' : '#6b7280' }}>
          {state.visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
        </span>
      </Tooltip>
      <Tooltip title={state.collapsed ? I18N('expand') : I18N('collapse')}>
        <span onClick={onToggle} style={{ cursor: 'pointer', color: '#9ca3af', transform: state.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </Tooltip>
    </div>
  );
}

/** 获取所有面板状态列表 (用于初始化/批量重置) */
export function getAllPanelStates(): Record<string, PanelState> {
  return loadPanelStates();
}

export function resetAllPanelStates() {
  savePanelStates({});
  message.success(I18N('panelsReset'));
}
