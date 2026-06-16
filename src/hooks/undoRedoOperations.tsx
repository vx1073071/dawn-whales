// @ts-nocheck
// R233 ML#1: UndoRedo operation factories for 5 operation types
// Pre-built undo/redo pairs for common trading operations

import type { UndoableOperation, UndoableOpType } from '../../hooks/useUndoRedo';

// ── Strategy Parameter Change ────────────────────────────────────────
export function createStrategyParamOp(
  paramKey: string,
  oldValue: string | number | boolean,
  newValue: string | number | boolean,
  onUpdate: (key: string, value: string | number | boolean) => void,
): Omit<UndoableOperation, 'id' | 'timestamp'> {
  return {
    type: 'strategy_param',
    label: `Change "${paramKey}": ${oldValue} → ${newValue}`,
    data: { paramKey, oldValue, newValue },
    undo: (data) => {
      onUpdate(data.paramKey as string, data.oldValue as string | number | boolean);
    },
    redo: (data) => {
      onUpdate(data.paramKey as string, data.newValue as string | number | boolean);
    },
  };
}

// ── Factor Weight Change ─────────────────────────────────────────────
export function createFactorWeightOp(
  factorId: string,
  factorName: string,
  oldWeight: number,
  newWeight: number,
  onUpdateWeight: (factorId: string, weight: number) => void,
): Omit<UndoableOperation, 'id' | 'timestamp'> {
  return {
    type: 'factor_weight',
    label: `${factorName}: weight ${oldWeight}% → ${newWeight}%`,
    data: { factorId, factorName, oldWeight, newWeight },
    undo: (data) => {
      onUpdateWeight(data.factorId as string, data.oldWeight as number);
    },
    redo: (data) => {
      onUpdateWeight(data.factorId as string, data.newWeight as number);
    },
  };
}

// ── Factor Selection ─────────────────────────────────────────────────
export function createFactorSelectOp(
  factorId: string,
  factorName: string,
  added: boolean,
  onToggleFactor: (factorId: string, added: boolean) => void,
): Omit<UndoableOperation, 'id' | 'timestamp'> {
  return {
    type: 'factor_select',
    label: added ? `Add factor: ${factorName}` : `Remove factor: ${factorName}`,
    data: { factorId, factorName, added },
    undo: (data) => {
      onToggleFactor(data.factorId as string, !(data.added as boolean));
    },
    redo: (data) => {
      onToggleFactor(data.factorId as string, data.added as boolean);
    },
  };
}

// ── Order Action ─────────────────────────────────────────────────────
export function createOrderActionOp(
  action: 'buy' | 'sell' | 'cancel' | 'modify',
  symbol: string,
  quantity: number,
  price?: number,
  orderId?: string,
  onReverse: (action: string, symbol: string, qty: number, price?: number, orderId?: string) => void,
): Omit<UndoableOperation, 'id' | 'timestamp'> {
  const revAction = action === 'buy' ? 'sell' : action === 'sell' ? 'buy' : action;
  return {
    type: 'order_action',
    label: `${action.toUpperCase()} ${symbol} x${quantity}${price ? ` @${price}` : ''}`,
    data: { action, revAction, symbol, quantity, price, orderId },
    undo: (data) => {
      onReverse(
        data.revAction as string,
        data.symbol as string,
        data.quantity as number,
        data.price as number | undefined,
        data.orderId as string | undefined,
      );
    },
    redo: (data) => {
      onReverse(
        data.action as string,
        data.symbol as string,
        data.quantity as number,
        data.price as number | undefined,
        data.orderId as string | undefined,
      );
    },
  };
}

// ── Template Change ──────────────────────────────────────────────────
export function createTemplateChangeOp(
  oldTemplateId: string,
  newTemplateId: string,
  oldTemplateName: string,
  newTemplateName: string,
  onSwitch: (templateId: string) => void,
): Omit<UndoableOperation, 'id' | 'timestamp'> {
  return {
    type: 'template_change',
    label: `Template: ${oldTemplateName} → ${newTemplateName}`,
    data: { oldTemplateId, newTemplateId, oldTemplateName, newTemplateName },
    undo: (data) => {
      onSwitch(data.oldTemplateId as string);
    },
    redo: (data) => {
      onSwitch(data.newTemplateId as string);
    },
  };
}

// ── Batch Operation (multiple changes as one undo step) ──────────────
export function createBatchOp(
  operations: Omit<UndoableOperation, 'id' | 'timestamp'>[],
  label: string,
): Omit<UndoableOperation, 'id' | 'timestamp'> {
  return {
    type: 'strategy_param', // Default type for batches
    label: `Batch: ${label} (${operations.length} changes)`,
    data: { operations },
    undo: () => {
      // Undo in reverse order
      for (let i = operations.length - 1; i >= 0; i--) {
        operations[i].undo(operations[i].data);
      }
    },
    redo: () => {
      // Redo in original order
      for (const op of operations) {
        op.redo(op.data);
      }
    },
  };
}
