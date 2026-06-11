/**
 * UpdatePanel — R92 J-02: Auto-Updater UI
 *
 * Displays update status, download progress, and install button.
 * Communicates with main process via IPC: update:check, update:download, update:install, update:status
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ──────────────────────────────────────────────────────────────────

type UpdateState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  downloadProgress: number;
  downloadSpeed: number;
  releaseNotes: string | null;
  error: string | null;
  lastChecked: number | null;
  canInstall: boolean;
}

// ── IPC Bridge ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

async function ipcInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke(channel, ...args);
  }
  // Fallback for web/dev mode
  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatTimeAgo(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────

const UpdatePanel: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>({
    state: 'idle',
    currentVersion: '0.0.0',
    latestVersion: null,
    downloadProgress: 0,
    downloadSpeed: 0,
    releaseNotes: null,
    error: null,
    lastChecked: null,
    canInstall: false,
  });

  // Listen for update:status events from main process
  useEffect(() => {
    const handler = (...args: unknown[]) => {
      const newStatus = args[0] as UpdateStatus;
      if (newStatus) setStatus(newStatus);
    };

    if (window.electronAPI?.on) {
      window.electronAPI.on('update:status', handler);
    }

    // Fetch initial status
    ipcInvoke('update:get-status').then((result) => {
      if (result) setStatus(result as UpdateStatus);
    });

    return () => {
      if (window.electronAPI?.removeListener) {
        window.electronAPI.removeListener('update:status', handler);
      }
    };
  }, []);

  const handleCheck = useCallback(async () => {
    setStatus(prev => ({ ...prev, state: 'checking' }));
    const result = await ipcInvoke('update:check') as { success: boolean; updateAvailable?: boolean } | null;
    if (!result?.success) {
      setStatus(prev => ({ ...prev, state: 'idle', error: result ? (result as any).message : 'Not in Electron' }));
    }
  }, []);

  const handleDownload = useCallback(async () => {
    const result = await ipcInvoke('update:download') as { success: boolean } | null;
    if (!result?.success) {
      setStatus(prev => ({ ...prev, error: 'Download failed' }));
    }
  }, []);

  const handleInstall = useCallback(async () => {
    await ipcInvoke('update:install');
  }, []);

  const handleDismiss = useCallback(async () => {
    await ipcInvoke('update:dismiss');
    setStatus(prev => ({ ...prev, state: 'idle', downloadProgress: 0, error: null }));
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const { state, currentVersion, latestVersion, downloadProgress: progress, downloadSpeed: speed, releaseNotes: notes, error, lastChecked, canInstall } = status;

  const stateLabel: Record<UpdateState, string> = {
    idle: t('Updater.idle', 'Up to date'),
    checking: t('Updater.checking', 'Checking for updates…'),
    available: t('Updater.available', 'Update available'),
    'not-available': t('Updater.notAvailable', 'You are on the latest version'),
    downloading: t('Updater.downloading', 'Downloading update…'),
    downloaded: t('Updater.downloaded', 'Update ready to install'),
    error: t('Updater.error', 'Update error'),
  };

  const stateColor: Record<UpdateState, string> = {
    idle: '#6B7280',
    checking: '#F59E0B',
    available: '#3B82F6',
    'not-available': '#10B981',
    downloading: '#3B82F6',
    downloaded: '#10B981',
    error: '#EF4444',
  };

  return (
    <div style={{
      padding: '24px',
      borderRadius: 12,
      background: 'var(--bg-card, #1F2937)',
      border: '1px solid var(--border-color, #374151)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #F9FAFB)' }}>
            {t('Updater.title', 'Software Update')}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary, #9CA3AF)' }}>
            v{currentVersion} · {t('Updater.lastChecked', 'Last checked')}: {formatTimeAgo(lastChecked)}
          </p>
        </div>
        <div style={{
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 500,
          background: `${stateColor[state]}22`,
          color: stateColor[state],
          border: `1px solid ${stateColor[state]}44`,
        }}>
          {stateLabel[state]}
        </div>
      </div>

      {/* New version info */}
      {state === 'available' && latestVersion && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#1E3A5F', marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: '#93C5FD', fontWeight: 500 }}>
            {t('Updater.newVersion', 'New version')}: v{latestVersion}
          </div>
          {notes && (
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {notes}
            </div>
          )}
        </div>
      )}

      {/* Download progress */}
      {state === 'downloading' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>
            <span>{progress}%</span>
            <span>{formatSpeed(speed)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#374151', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: 3,
              background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: '#7F1D1D33', color: '#FCA5A5', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(state === 'idle' || state === 'error' || state === 'not-available') && (
          <button
            onClick={handleCheck}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #4B5563',
              background: 'transparent',
              color: '#D1D5DB',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {t('Updater.checkNow', 'Check for Updates')}
          </button>
        )}

        {state === 'available' && (
          <button
            onClick={handleDownload}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#3B82F6',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t('Updater.download', 'Download Update')}
          </button>
        )}

        {canInstall && (
          <button
            onClick={handleInstall}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#10B981',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t('Updater.install', 'Install & Restart')}
          </button>
        )}

        {(state === 'available' || state === 'downloaded') && (
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #4B5563',
              background: 'transparent',
              color: '#9CA3AF',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {t('Updater.later', 'Later')}
          </button>
        )}
      </div>
    </div>
  );
};

export default UpdatePanel;
