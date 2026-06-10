// ── DAWN WHALES — System Tray ──────────────────────────────────────────────
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';

/**
 * Create a diamond-shaped fallback tray icon.
 */
export function createDiamondIcon(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      const idx = (y * size + x) * 4;
      if (dist < size / 2 - 1) {
        pixels[idx] = 201;
        pixels[idx + 1] = 169;
        pixels[idx + 2] = 110;
        pixels[idx + 3] = 255;
      }
    }
  }
  return pixels;
}

/**
 * Create the system tray icon and menu.
 * Requires RESOURCES_PATH, mainWindow, and strategyEngine from the calling context.
 */
export function createTray(
  RESOURCES_PATH: string,
  mainWindowRef: { current: BrowserWindow | null },
  strategyEngineRef: { current: any },
  trayRef: { current: Tray | null },
): void {
  const trayIconPath = path.join(RESOURCES_PATH, 'icons', 'tray-icon.png');
  const icon = nativeImage.createFromPath(trayIconPath);
  if (icon.isEmpty()) {
    log.warn('[Tray] tray-icon.png not found, using fallback diamond');
    const fallback = nativeImage.createFromBuffer(createDiamondIcon(16));
    trayRef.current = new Tray(fallback);
  } else {
    trayRef.current = new Tray(icon);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'DAWN WHALES · 道鲸', enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => mainWindowRef.current?.show() },
    { label: '紧急停止所有策略', click: () => strategyEngineRef.current?.emergencyStop() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);

  trayRef.current.setToolTip('DAWN WHALES · 道鲸');
  trayRef.current.setContextMenu(contextMenu);
  trayRef.current.on('double-click', () => mainWindowRef.current?.show());
}
