// electron/main/ipc-handlers-condition.ts
// ConditionEngine IPC handlers — Phase 4.2 R30 Q-30-02

import { ConditionEngine } from '../engine/condition-engine.js';
import type { ConditionRule } from '../types/condition.js';

export function registerConditionHandlers(
  engine: ConditionEngine,
  ipcHandlers: Map<string, Function>
): void {
  ipcHandlers.set('condition:create', async (_: any, payload: any) => {
    try {
      const rule = engine.createRule(payload);
      return { success: true, data: rule };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcHandlers.set('condition:delete', async (_: any, ruleId: string) => {
    const ok = engine.deleteRule(ruleId);
    return { success: ok };
  });

  ipcHandlers.set('condition:update', async (_: any, payload: { ruleId: string; patch: Partial<ConditionRule> }) => {
    const { ruleId, patch } = payload;
    const updated = engine.updateRule(ruleId, patch);
    if (!updated) return { success: false, error: 'Rule not found' };
    return { success: true, data: updated };
  });

  ipcHandlers.set('condition:list', async (_: any, filter?: any) => {
    const rules = engine.listRules(filter);
    return { success: true, data: rules };
  });

  ipcHandlers.set('condition:enable', async (_: any, ruleId: string) => {
    const ok = engine.enableRule(ruleId);
    return { success: ok, error: ok ? undefined : 'Rule not found' };
  });

  ipcHandlers.set('condition:disable', async (_: any, ruleId: string) => {
    const ok = engine.disableRule(ruleId);
    return { success: ok, error: ok ? undefined : 'Rule not found' };
  });

  ipcHandlers.set('condition:clear', async () => {
    engine.clearAll();
    return { success: true };
  });

  ipcHandlers.set('condition:history', async (_: any, filter?: any) => {
    const events = engine.getHistory(filter);
    return { success: true, data: events };
  });

  ipcHandlers.set('condition:evaluate', async (_: any, payload: { symbol: string; data: any }) => {
    const { symbol, data } = payload;
    const results = engine.evaluate(symbol, data);
    return { success: true, data: results };
  });
}
