// @ts-nocheck
// R236 ML#1: EnhancedShortcuts — 5 new shortcut groups for power users
// Strategy Compare hotkeys + Quick actions + Panel management

import { useHotkey, HotkeyScope } from '../../hooks/useHotkeys';
import { useCallback } from 'react';

// ── Group 1: Strategy Compare Shortcuts ──────────────────────────────
export interface CompareShortcuts {
  onAddStrategy?: () => void;
  onRemoveStrategy?: () => void;
  onSwitchTab?: (tab: 'performance' | 'risk' | 'factors' | 'ai') => void;
  onExport?: () => void;
  onToggleFavorite?: () => void;
}

export function useCompareShortcuts(actions: CompareShortcuts, enabled = true) {
  // Ctrl+Shift+A = Add strategy to compare
  useHotkey({ key: 'Ctrl+Shift+A', scope: 'strategy', enabled: !!actions.onAddStrategy && enabled, onPress: () => actions.onAddStrategy?.() });
  // Ctrl+Shift+D = Remove strategy from compare
  useHotkey({ key: 'Ctrl+Shift+D', scope: 'strategy', enabled: !!actions.onRemoveStrategy && enabled, onPress: () => actions.onRemoveStrategy?.() });
  // Ctrl+1~4 = Switch compare tabs
  useHotkey({ key: 'Ctrl+Shift+1', scope: 'strategy', enabled: !!actions.onSwitchTab && enabled, onPress: () => actions.onSwitchTab?.('performance') });
  useHotkey({ key: 'Ctrl+Shift+2', scope: 'strategy', enabled: !!actions.onSwitchTab && enabled, onPress: () => actions.onSwitchTab?.('risk') });
  useHotkey({ key: 'Ctrl+Shift+3', scope: 'strategy', enabled: !!actions.onSwitchTab && enabled, onPress: () => actions.onSwitchTab?.('factors') });
  useHotkey({ key: 'Ctrl+Shift+4', scope: 'strategy', enabled: !!actions.onSwitchTab && enabled, onPress: () => actions.onSwitchTab?.('ai') });
  // Ctrl+Shift+E = Export comparison
  useHotkey({ key: 'Ctrl+Shift+E', scope: 'strategy', enabled: !!actions.onExport && enabled, onPress: () => actions.onExport?.() });
  // Ctrl+Shift+F = Toggle favorite
  useHotkey({ key: 'Ctrl+Shift+F', scope: 'strategy', enabled: !!actions.onToggleFavorite && enabled, onPress: () => actions.onToggleFavorite?.() });
}

// ── Group 2: Factor Analysis Shortcuts ───────────────────────────────
export interface FactorShortcuts {
  onOpenDetail?: (factorId: string) => void;
  onToggleWeight?: (factorId: string) => void;
  onResetWeights?: () => void;
  onSearchFocus?: () => void;
  onToggleHeatmap?: () => void;
}

export function useFactorShortcuts(actions: FactorShortcuts, enabled = true) {
  // F = Focus search bar
  useHotkey({ key: 'Ctrl+F', scope: 'strategy', enabled: !!actions.onSearchFocus && enabled, onPress: () => actions.onSearchFocus?.() });
  // H = Toggle heatmap
  useHotkey({ key: 'Ctrl+H', scope: 'strategy', enabled: !!actions.onToggleHeatmap && enabled, onPress: () => actions.onToggleHeatmap?.() });
  // Ctrl+R = Reset weights
  useHotkey({ key: 'Ctrl+R', scope: 'strategy', enabled: !!actions.onResetWeights && enabled, onPress: () => actions.onResetWeights?.() });
}

// ── Group 3: Panel Management Shortcuts ──────────────────────────────
export interface PanelShortcuts {
  onMaximizePanel?: () => void;
  onClosePanel?: () => void;
  onToggleSidebar?: () => void;
  onNextPanel?: () => void;
  onPrevPanel?: () => void;
}

export function usePanelShortcuts(actions: PanelShortcuts, enabled = true) {
  // F11 = Maximize current panel (override browser default)
  useHotkey({ key: 'F11', scope: 'global', enabled: !!actions.onMaximizePanel && enabled, onPress: () => actions.onMaximizePanel?.() });
  // Ctrl+W = Close current panel
  useHotkey({ key: 'Ctrl+W', scope: 'global', enabled: !!actions.onClosePanel && enabled, onPress: () => actions.onClosePanel?.() });
  // Ctrl+B = Toggle sidebar
  useHotkey({ key: 'Ctrl+B', scope: 'global', enabled: !!actions.onToggleSidebar && enabled, onPress: () => actions.onToggleSidebar?.() });
  // Ctrl+Tab = Next panel
  useHotkey({ key: 'Ctrl+Tab', scope: 'global', enabled: !!actions.onNextPanel && enabled, onPress: () => actions.onNextPanel?.() });
  // Ctrl+Shift+Tab = Previous panel
  useHotkey({ key: 'Ctrl+Shift+Tab', scope: 'global', enabled: !!actions.onPrevPanel && enabled, onPress: () => actions.onPrevPanel?.() });
}

// ── Group 4: Quick Calculator Shortcuts ──────────────────────────────
export interface CalculatorShortcuts {
  onCalculatePnL?: () => void;
  onCalculatePosition?: () => void;
  onCalculateRisk?: () => void;
  onToggleCalculator?: () => void;
}

export function useCalculatorShortcuts(actions: CalculatorShortcuts, enabled = true) {
  // Ctrl+Shift+P = Calculate P&L
  useHotkey({ key: 'Ctrl+Shift+P', scope: 'trading', enabled: !!actions.onCalculatePnL && enabled, onPress: () => actions.onCalculatePnL?.() });
  // Ctrl+Shift+Q = Calculate position size
  useHotkey({ key: 'Ctrl+Shift+Q', scope: 'trading', enabled: !!actions.onCalculatePosition && enabled, onPress: () => actions.onCalculatePosition?.() });
  // Ctrl+Shift+R = Calculate risk
  useHotkey({ key: 'Ctrl+Shift+R', scope: 'trading', enabled: !!actions.onCalculateRisk && enabled, onPress: () => actions.onCalculateRisk?.() });
  // Ctrl+` = Toggle calculator panel
  useHotkey({ key: 'Ctrl+`', scope: 'global', enabled: !!actions.onToggleCalculator && enabled, onPress: () => actions.onToggleCalculator?.() });
}

// ── Group 5: Data Management Shortcuts ───────────────────────────────
export interface DataShortcuts {
  onRefreshAll?: () => void;
  onClearCache?: () => void;
  onToggleAutoRefresh?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
}

export function useDataShortcuts(actions: DataShortcuts, enabled = true) {
  // F5 = Refresh all data (already defined, but can be overridden)
  // Ctrl+Shift+F5 = Clear cache + refresh
  useHotkey({ key: 'Ctrl+Shift+F5', scope: 'global', enabled: !!actions.onClearCache && enabled, onPress: () => actions.onClearCache?.() });
  // Ctrl+Shift+T = Toggle auto-refresh
  useHotkey({ key: 'Ctrl+Shift+T', scope: 'global', enabled: !!actions.onToggleAutoRefresh && enabled, onPress: () => actions.onToggleAutoRefresh?.() });
  // Ctrl+Shift+X = Export data
  useHotkey({ key: 'Ctrl+Shift+X', scope: 'global', enabled: !!actions.onExportData && enabled, onPress: () => actions.onExportData?.() });
  // Ctrl+Shift+I = Import data
  useHotkey({ key: 'Ctrl+Shift+I', scope: 'global', enabled: !!actions.onImportData && enabled, onPress: () => actions.onImportData?.() });
}

// ── Shortcut Cheat Sheet Component ───────────────────────────────────
export interface ShortcutCheatSheetProps {
  groups: { name: string; shortcuts: { key: string; description: string }[] }[];
  onClose: () => void;
}

export function ShortcutCheatSheet({ groups, onClose }: ShortcutCheatSheetProps) {
  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
  }, [
    React.createElement('div', { key: 'backdrop', onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' } }),
    React.createElement('div', { key: 'modal', style: {
      position: 'relative', zIndex: 1, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto',
      borderRadius: 16, background: 'var(--surface-1, #0f172a)', border: '1px solid var(--border-color, #334155)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: 24,
    }}, [
      React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', marginBottom: 20 } }, [
        React.createElement('h2', { key: 't', style: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', margin: 0 } }, '⌨️ Keyboard Shortcuts'),
        React.createElement('button', { key: 'x', onClick: onClose, style: { background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', fontSize: 20, cursor: 'pointer' } }, '✕'),
      ]),
      ...groups.map((group, gi) =>
        React.createElement('div', { key: gi, style: { marginBottom: 16 } }, [
          React.createElement('h3', { key: 'h', style: { fontSize: 13, fontWeight: 600, color: 'var(--brand, #d4a574)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 } }, group.name),
          React.createElement('div', { key: 'l', style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            group.shortcuts.map((s, si) =>
              React.createElement('div', { key: si, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' } }, [
                React.createElement('span', { key: 'd', style: { fontSize: 12, color: 'var(--text-secondary, #94a3b8)' } }, s.description),
                React.createElement('kbd', { key: 'k', style: {
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: 'var(--surface-2, #1e293b)', color: 'var(--text-primary, #e2e8f0)',
                  border: '1px solid var(--border-color, #334155)', fontFamily: 'monospace',
                }}, s.key),
              ])
            )
          ),
        ])
      ),
      React.createElement('div', { key: 'hint', style: { marginTop: 12, fontSize: 11, color: 'var(--text-tertiary, #64748b)', textAlign: 'center' } },
        'Press Ctrl+K to search, F1 for help, Esc to close'),
    ]),
  ]);
}
