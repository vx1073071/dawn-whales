// ── TradingEasy — Electron Main Process ───────────────────────────────
// S-19: Modularized into electron/main/{lifecycle,ipc-setup,tray,updater}.ts
// main.ts now imports and delegates — <100 lines

import { app } from 'electron';
import { onAppReady, onWindowAllClosed, onActivate, onBeforeQuit } from './main/lifecycle';

app.whenReady().then(onAppReady);
app.on('window-all-closed', onWindowAllClosed);
app.on('activate', onActivate);
app.on('before-quit', onBeforeQuit);
