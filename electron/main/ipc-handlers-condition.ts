// electron/main/ipc-handlers-condition.ts
// ConditionEngine IPC handlers — Phase 4.2 R30 Q-30-02

import { ConditionEngine } from '../engine/core/condition-engine.js';
import type { ConditionRule } from '../types/condition.js';

export function registerConditionHandlers(
  engine: ConditionEngine,
  ipcHandlers: Map<string, Function>
): void {
  ipcHandlers.set('condition:create', async (_: unknown, payload: unknown) => {
    try {
      const rule = engine.createRule(payload);
      return { success: true, data: rule };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcHandlers.set('condition:delete', async (_: unknown, ruleId: string) => {
    const ok = engine.deleteRule(ruleId);
    return { success: ok };
  });

  ipcHandlers.set('condition:update', async (_: unknown, payload: { ruleId: string; patch: Partial<ConditionRule> }) => {
    const { ruleId, patch } = payload;
    const updated = engine.updateRule(ruleId, patch);
    if (!updated) return { success: false, error: 'Rule not found' };
    return { success: true, data: updated };
  });

  ipcHandlers.set('condition:list', async (_: unknown, filter?: unknown) => {
    const rules = engine.listRules(filter);
    return { success: true, data: rules };
  });

  ipcHandlers.set('condition:enable', async (_: unknown, ruleId: string) => {
    const ok = engine.enableRule(ruleId);
    return { success: ok, error: ok ? undefined : 'Rule not found' };
  });

  ipcHandlers.set('condition:disable', async (_: unknown, ruleId: string) => {
    const ok = engine.disableRule(ruleId);
    return { success: ok, error: ok ? undefined : 'Rule not found' };
  });

  ipcHandlers.set('condition:clear', async () => {
    engine.clearAll();
    return { success: true };
  });

  ipcHandlers.set('condition:history', async (_: unknown, filter?: unknown) => {
    const events = engine.getHistory(filter);
    return { success: true, data: events };
  });

  ipcHandlers.set('condition:evaluate', async (_: unknown, payload: { symbol: string; data: unknown }) => {
    const { symbol, data } = payload;
    const results = engine.evaluate(symbol, data);
    return { success: true, data: results };
  });
}
