/**
 * MultiPanelLayout — Resizable multi-panel workspace with drag-to-resize
 * (ML-43-01, R43 Phase 6.0)
 *
 * Features:
 * - 3 preset layouts: single / horizontal-split / 4-panel grid
 * - Drag separator to resize panels
 * - Layout persistence via localStorage
 * - Panel slots: top-left / top-right / bottom-left / bottom-right
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

type LayoutPreset = 'single' | 'horizontal' | 'grid4';

interface PanelSlot {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultSize?: number;
}

interface LayoutState {
  preset: LayoutPreset;
  splitRatio: number; // 0.3–0.7, vertical split for horizontal mode
  horizontalRatio: number; // for grid4 top/bottom
}

// ── Constants ───────────────────────────────────────────────────────────

const LAYOUT_LABELS: Record<LayoutPreset, { icon: string; label: string }> = {
  single: { icon: '◼', label: '单面板' },
  horizontal: { icon: '◫', label: '左右分屏' },
  grid4: { icon: '⊞', label: '四面板' },
};

const STORAGE_KEY = 'dawn-whales-layout';

// ── Main Component ──────────────────────────────────────────────────────

interface MultiPanelLayoutProps {
  panels: PanelSlot[];
  className?: string;
}

export const MultiPanelLayout: React.FC<MultiPanelLayoutProps> = ({ panels, className }) => {
  const [layout, setLayout] = useState<LayoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { preset: 'horizontal', splitRatio: 0.5, horizontalRatio: 0.5 };
  });

  const [dragging, setDragging] = useState<'vertical' | 'horizontal' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist layout
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
  }, [layout]);

  // Drag handlers
  const handleDragStart = useCallback((axis: 'vertical' | 'horizontal') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(axis);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (dragging === 'vertical') {
        const ratio = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
        setLayout(prev => ({ ...prev, splitRatio: ratio }));
      } else {
        const ratio = Math.max(0.2, Math.min(0.8, (e.clientY - rect.top) / rect.height));
        setLayout(prev => ({ ...prev, horizontalRatio: ratio }));
      }
    };
    const handleUp = () => setDragging(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const setPreset = useCallback((preset: LayoutPreset) => {
    setLayout(prev => ({ ...prev, preset }));
  }, []);

  // Slots allocation
  const topLeft = panels[0];
  const topRight = panels[1] ?? panels[0];
  const bottomLeft = panels[2] ?? panels[0];
  const bottomRight = panels[3] ?? panels[1] ?? panels[0];

  const renderPanel = (slot: PanelSlot, key: string) => (
    <div key={key} className="flex flex-col min-h-0 min-w-0 overflow-auto">
      <div className="text-[10px] text-gray-600 px-2 py-0.5 bg-gray-800/30 border-b border-gray-800 flex-shrink-0">
        {slot.title}
      </div>
      <div className="flex-1 overflow-auto">
        {slot.component}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${className ?? ''}`}>
      {/* Layout toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/40 border-b border-gray-800 flex-shrink-0">
        <div className="flex gap-0.5">
          {(Object.keys(LAYOUT_LABELS) as LayoutPreset[]).map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                layout.preset === p
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {LAYOUT_LABELS[p].icon} {LAYOUT_LABELS[p].label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-600">
          {layout.preset === 'horizontal'
            ? `${Math.round(layout.splitRatio * 100)}:${Math.round((1 - layout.splitRatio) * 100)}`
            : layout.preset === 'grid4'
            ? `${Math.round(layout.horizontalRatio * 100)}:${Math.round((1 - layout.horizontalRatio) * 100)}`
            : ''}
        </span>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {layout.preset === 'single' && (
          <div className="h-full">
            {renderPanel(topLeft, 'single')}
          </div>
        )}

        {layout.preset === 'horizontal' && (
          <div className="flex h-full">
            <div style={{ width: `${layout.splitRatio * 100}%` }} className="min-w-0">
              {renderPanel(topLeft, 'left')}
            </div>
            {/* Drag separator */}
            <div
              className={`w-1 cursor-col-resize flex-shrink-0 transition-colors ${
                dragging === 'vertical' ? 'bg-amber-500' : 'bg-gray-800 hover:bg-amber-500/50'
              }`}
              onMouseDown={handleDragStart('vertical')}
            >
              <div className="w-1 h-8 rounded-full bg-gray-600 mx-auto mt-[50vh] opacity-0 hover:opacity-100 transition-opacity" />
            </div>
            <div style={{ width: `${(1 - layout.splitRatio) * 100}%` }} className="min-w-0">
              {renderPanel(topRight, 'right')}
            </div>
          </div>
        )}

        {layout.preset === 'grid4' && (
          <div className="flex flex-col h-full">
            {/* Top row */}
            <div className="flex" style={{ height: `${layout.horizontalRatio * 100}%` }}>
              <div style={{ width: `${layout.splitRatio * 100}%` }} className="min-w-0 min-h-0">
                {renderPanel(topLeft, 'tl')}
              </div>
              <div
                className={`w-1 cursor-col-resize flex-shrink-0 ${dragging === 'vertical' ? 'bg-amber-500' : 'bg-gray-800 hover:bg-amber-500/50'}`}
                onMouseDown={handleDragStart('vertical')}
              />
              <div style={{ width: `${(1 - layout.splitRatio) * 100}%` }} className="min-w-0 min-h-0">
                {renderPanel(topRight, 'tr')}
              </div>
            </div>
            {/* Horizontal separator */}
            <div
              className={`h-1 cursor-row-resize flex-shrink-0 ${dragging === 'horizontal' ? 'bg-amber-500' : 'bg-gray-800 hover:bg-amber-500/50'}`}
              onMouseDown={handleDragStart('horizontal')}
            >
              <div className="h-1 w-8 rounded-full bg-gray-600 mx-auto opacity-0 hover:opacity-100 transition-opacity" />
            </div>
            {/* Bottom row */}
            <div className="flex" style={{ height: `${(1 - layout.horizontalRatio) * 100}%` }}>
              <div style={{ width: `${layout.splitRatio * 100}%` }} className="min-w-0 min-h-0">
                {renderPanel(bottomLeft, 'bl')}
              </div>
              <div
                className={`w-1 cursor-col-resize flex-shrink-0 ${dragging === 'vertical' ? 'bg-amber-500' : 'bg-gray-800 hover:bg-amber-500/50'}`}
                onMouseDown={handleDragStart('vertical')}
              />
              <div style={{ width: `${(1 - layout.splitRatio) * 100}%` }} className="min-w-0 min-h-0">
                {renderPanel(bottomRight, 'br')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiPanelLayout;
