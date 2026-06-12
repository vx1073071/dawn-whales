// ── Window Creation ────────────────────────────────────────────────────────
import i18n from '../../src/i18n';
import { session, app } from 'electron';

/**
 * Content-Security-Policy for Electron renderer.
 * - default-src 'self': only allow same-origin resources
 * - script-src 'self' 'unsafe-inline' 'unsafe-eval': React + Vite HMR need inline scripts
 * - style-src 'self' 'unsafe-inline': CSS-in-JS and Tailwind need inline styles
 * - img-src 'self' data: blob:: allow base64/blob images (charts, logos)
 * - connect-src: allow WebSocket connections to Futu OpenD and API endpoints
 * - font-src 'self' data:: allow embedded fonts
 * - frame-src 'none': no iframes for security
 */
const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';

const CSP_POLICY = [
  "default-src 'self'",
  isProduction
    ? "script-src 'self' 'unsafe-inline'"       // Production: no unsafe-eval
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Dev: Vite HMR needs eval
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws://127.0.0.1:* wss://* http://127.0.0.1:* https://*",
  "font-src 'self' data:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_POLICY],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
      },
    });
  });
}

export function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: i18n.t('Browser.k0'),
    icon: path.join(RESOURCES_PATH, 'icons', 'icon.png'),
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // R128: sqlite moved to main process (sqlite-ipc.ts)
      webSecurity: true, // R92: Enabled for CSP enforcement
    },
  });

  // Apply CSP headers
  setupCSP();

  // Load app — dev server in development, built files in production
  const hasDevServer = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (hasDevServer) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Log renderer console messages
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['log', 'warn', 'error'];
    log.info(`[Renderer:${levels[level] || 'log'}] ${message}`);
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}
