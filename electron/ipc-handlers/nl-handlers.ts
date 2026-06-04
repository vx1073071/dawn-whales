// ── IPC Handlers — NL Parser ────────────────────────────────────────────────
// nl:* 相关的 IPC handlers
// 从 main.ts 拆分出来，2个 handlers

import { ipcMain } from 'electron';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../engine/nl-parser';
import { validate, NlParseSchema } from '../ipc-schemas';

export function registerNlHandlers() {
  ipcMain.handle('nl:parse', async (_e, text: string) => {
    const vErr = validate(NlParseSchema, { text });
    if (vErr) return vErr;
    return parseNaturalLanguage(text);
  });

  ipcMain.handle('nl:templates', async () => {
    return { success: true, templates: STRATEGY_TEMPLATES };
  });
}
