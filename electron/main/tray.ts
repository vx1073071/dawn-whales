// ── System Tray ────────────────────────────────────────────────────────────
import i18n from '../../src/i18n';

export function createTray() {
    const trayIconPath = path.join(RESOURCES_PATH, 'icons', 'tray-icon.png');
    const icon = nativeImage.createFromPath(trayIconPath);
    if (icon.isEmpty()) {
      log.warn('[Tray] tray-icon.png not found, using fallback diamond');
      const fallback = nativeImage.createFromBuffer(createDiamondIcon(16));
      tray = new Tray(fallback);
    } else {
      tray = new Tray(icon);
    }

  const contextMenu = Menu.buildFromTemplate([
    { label: i18n.t('Tray.k0'), enabled: false },
    { type: 'separator' },
    { label: i18n.t('Tray.k1'), click: () => mainWindow?.show() },
    { label: i18n.t('Tray.k2'), click: () => strategyEngine?.emergencyStop() },
    { type: 'separator' },
    { label: i18n.t('Tray.k3'), click: () => app.quit() },
  ]);

  tray.setToolTip(i18n.t('Tray.k4'));
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}
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
