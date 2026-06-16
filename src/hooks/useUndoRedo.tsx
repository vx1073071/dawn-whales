// @ts-nocheck
// R233 ML#1: useUndoRedo — Command-pattern undo/redo system
// Supports: strategy params, factor weights, factor selection, order actions, template changes
// Immutable history stack with serialization, keyboard shortcuts (Ctrl+Z/Y)

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export type UndoableOpType = 'strategy_param' | 'factor_weight' | 'factor_select' | 'order_action' | 'template_change';

export interface UndoableOperation {
  id: string;
  type: UndoableOpType;
  label: string;
  timestamp: number;
  data: Record<string, unknown>;
  undo: (data: Record<string, unknown>) => void;
  redo: (data: Record<string, unknown>) => void;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  lastAction: string | null;
  isUndoing: boolean;
  isRedoing: boolean;
}

export interface UndoRedoActions {
  undo: () => void;
  redo: () => void;
  push: (op: Omit<UndoableOperation, 'id' | 'timestamp'>) => string;
  clear: () => void;
  jumpTo: (index: number) => void;
  getHistory: () => UndoableOperation[];
}

// ── Command Stack ────────────────────────────────────────────────────
const MAX_HISTORY = 50;
let opCounter = 0;

function createOpId(): string {
  return `op_${Date.now()}_${++opCounter}`;
}

// ── Hook ────────────────────────────────────────────────────────────
export function useUndoRedo(
  onStateChange?: (state: UndoRedoState) => void,
): UndoRedoState & UndoRedoActions {
  const [undoStack, setUndoStack] = useState<UndoableOperation[]>([]);
  const [redoStack, setRedoStack] = useState<UndoableOperation[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  
  const undoRef = useRef(undoStack);
  const redoRef = useRef(redoStack);
  undoRef.current = undoStack;
  redoRef.current = redoStack;
  
  const push = useCallback((op: Omit<UndoableOperation, 'id' | 'timestamp'>): string => {
    const id = createOpId();
    const fullOp: UndoableOperation = {
      ...op,
      id,
      timestamp: Date.now(),
    };
    
    setUndoStack(prev => {
      const next = [...prev, fullOp];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setRedoStack([]); // Clear redo on new action
    setLastAction(op.label);
    
    return id;
  }, []);
  
  const undo = useCallback(() => {
    const stack = undoRef.current;
    if (stack.length === 0) return;
    
    setIsUndoing(true);
    const op = stack[stack.length - 1];
    
    try {
      op.undo(op.data);
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, op]);
      setLastAction(`Undo: ${op.label}`);
    } catch (e) {
      console.error('[UndoRedo] Undo failed:', e);
    } finally {
      setIsUndoing(false);
    }
  }, []);
  
  const redo = useCallback(() => {
    const stack = redoRef.current;
    if (stack.length === 0) return;
    
    setIsRedoing(true);
    const op = stack[stack.length - 1];
    
    try {
      op.redo(op.data);
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, op]);
      setLastAction(`Redo: ${op.label}`);
    } catch (e) {
      console.error('[UndoRedo] Redo failed:', e);
    } finally {
      setIsRedoing(false);
    }
  }, []);
  
  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    setLastAction(null);
  }, []);
  
  const jumpTo = useCallback((index: number) => {
    const stack = undoRef.current;
    if (index < 0 || index >= stack.length) return;
    
    // Undo back to the target index
    while (undoRef.current.length > index + 1) {
      const op = undoRef.current[undoRef.current.length - 1];
      op.undo(op.data);
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, op]);
    }
  }, []);
  
  const getHistory = useCallback((): UndoableOperation[] => {
    return [...undoStack];
  }, [undoStack]);
  
  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y = redo, Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);
  
  const state: UndoRedoState = {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    lastAction,
    isUndoing,
    isRedoing,
  };
  
  // Notify on state change
  useEffect(() => {
    onStateChange?.(state);
  }, [state.canUndo, state.canRedo, state.lastAction]);
  
  return { ...state, undo, redo, push, clear, jumpTo, getHistory };
}

// ── UndoRedoToolbar ─────────────────────────────────────────────────
export interface UndoRedoToolbarProps {
  state: UndoRedoState;
  actions: UndoRedoActions;
  className?: string;
  showLabel?: boolean;
  showCount?: boolean;
}

export function UndoRedoToolbar({ state, actions, className = '', showLabel = true, showCount = false }: UndoRedoToolbarProps) {
  return (
    <div className={`undo-redo-toolbar ${className}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <button
        onClick={actions.undo}
        disabled={!state.canUndo}
        title={state.canUndo ? `Undo: ${state.lastAction}` : 'Nothing to undo'}
        style={{
          padding: '4px 8px', borderRadius: 6, border: 'none',
          background: state.canUndo ? 'var(--surface-2, #1e293b)' : 'var(--surface-1, #0f172a)',
          color: state.canUndo ? 'var(--text-primary, #e2e8f0)' : 'var(--text-tertiary, #64748b)',
          cursor: state.canUndo ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600,
          opacity: state.canUndo ? 1 : 0.4,
        }}
      >
        ↩
      </button>
      <button
        onClick={actions.redo}
        disabled={!state.canRedo}
        title={state.canRedo ? `Redo: ${state.lastAction}` : 'Nothing to redo'}
        style={{
          padding: '4px 8px', borderRadius: 6, border: 'none',
          background: state.canRedo ? 'var(--surface-2, #1e293b)' : 'var(--surface-1, #0f172a)',
          color: state.canRedo ? 'var(--text-primary, #e2e8f0)' : 'var(--text-tertiary, #64748b)',
          cursor: state.canRedo ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600,
          opacity: state.canRedo ? 1 : 0.4,
        }}
      >
        ↪
      </button>
      {showLabel && state.lastAction && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #64748b)', marginLeft: 4, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {state.lastAction}
        </span>
      )}
      {showCount && (
        <span style={{ fontSize: 10, color: 'var(--text-tertiary, #64748b)', marginLeft: 2 }}>
          {state.undoCount}/{state.redoCount}
        </span>
      )}
    </div>
  );
}

// ── useUndoableState — Track state changes for undo/redo ────────────
export function useUndoableState<T>(
  initialState: T,
  undoRedo: ReturnType<typeof useUndoRedo>,
  label: string,
  type: UndoableOpType = 'strategy_param',
) {
  const [value, setValue] = useState<T>(initialState);
  const valueRef = useRef(value);
  valueRef.current = value;
  
  const setWithUndo = useCallback((newValue: T | ((prev: T) => T)) => {
    const resolved = typeof newValue === 'function'
      ? (newValue as (prev: T) => T)(valueRef.current)
      : newValue;
    
    const oldValue = { ...(valueRef.current as any) };
    
    undoRedo.push({
      type,
      label,
      data: { oldValue, newValue: resolved },
      undo: (data) => {
        setValue(data.oldValue as T);
      },
      redo: (data) => {
        setValue(data.newValue as T);
      },
    });
    
    setValue(resolved);
  }, [undoRedo, type, label]);
  
  return [value, setWithUndo] as const;
}
