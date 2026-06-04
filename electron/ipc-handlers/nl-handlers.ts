// -- IPC Handlers: nl (2 handlers) --

import { ipcMain } from 'electron';
import { parseNaturalLanguage, STRATEGY_TEMPLATES } from '../engine/nl-parser';

export function registerNlHandlers() {

  ipcMain.handle('nl:parse', async (_e, text: string) => {
      return parseNaturalLanguage(text);
    });


  ipcMain.handle('nl:templates', async () => {
      return { success: true, templates: STRATEGY_TEMPLATES };
    });

}
