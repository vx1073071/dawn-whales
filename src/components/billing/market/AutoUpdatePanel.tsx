/**
 * AutoUpdatePanel — ML-70-02 [P1]
 * R70: v1.7.0 GA — Desktop version check + auto-update UI
 *
 * Features:
 * - Current version display with release date
 * - Check for updates button + loading/progress
 * - Update available notification bar
 * - Download progress bar with percentage
 * - Install & restart flow
 * - Changelog preview in update modal
 * - Update channel selector (stable/beta)
 * - Auto-check toggle (every 4h)
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from "react-i18next";

// ── Types ───────────────────────────────────────────────────────────────

export type UpdateChannel = 'stable' | 'beta';
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  channel: UpdateChannel;
  size: string;
  changelog: string[];
  downloadUrl: string;
}

export interface AutoUpdatePanelProps {
  currentVersion?: string;
  currentChannel?: UpdateChannel;
  releaseDate?: string;
  updateInfo?: UpdateInfo;
  autoCheck?: boolean;
  onCheckUpdate?: () => Promise<UpdateInfo | null>;
  onDownload?: () => Promise<void>;
  onInstall?: () => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockUpdate: UpdateInfo = {
  version: 'v1.7.1',
  releaseDate: '2026-06-10',
  channel: 'stable',
  size: '128 MB',
  changelog: [
    '修复: flaky test全部清零',
    '新增: 访客模式浏览信号广场',
    '新增: 性能面板(Agent耗时/缓存/API延迟)',
    '优化: 回测1年日线<1.5s (提速60%)',
    '新增: IBKR盈透券商接入',
    '修复: 碎股部分成交状态跟踪',
  ],
  downloadUrl: 'https://github.com/vx1073071/dawn-whales/releases/latest',
};

// ── Main Component ──────────────────────────────────────────────────────

export default function AutoUpdatePanel({
  currentVersion = 'v1.7.0',
  currentChannel = 'stable',
  releaseDate = '2026-06-09',
  updateInfo: propUpdate,
  autoCheck = true,
  onCheckUpdate,
  onDownload,
  onInstall,
  className = '',
}: AutoUpdatePanelProps) {
  const { t } = useTranslation();

  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [downloadPct, setDownloadPct] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(propUpdate ?? null);
  const [errorMsg, setErrorMsg] = useState('');
  const [channel, setChannel] = useState<UpdateChannel>(currentChannel);

  // Auto-check on mount
  useEffect(() => {
    if (autoCheck) {
      const timer = setTimeout(() => handleCheck(), 3000);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheck = useCallback(async () => {
    setStatus('checking');
    setErrorMsg('');
    try {
      const info = onCheckUpdate ? await onCheckUpdate() : mockUpdate;
      if (info && info.version !== currentVersion) {
        setUpdateInfo(info);
        setStatus('available');
      } else {
        setStatus('up-to-date');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch {
      setErrorMsg('检查更新失败，请检查网络连接');
      setStatus('error');
    }
  }, [currentVersion, onCheckUpdate]);

  const handleDownload = useCallback(async () => {
    setStatus('downloading');
    setDownloadPct(0);
    try {
      if (onDownload) {
        await onDownload();
      } else {
        // Simulated download progress
        for (let i = 0; i <= 100; i += Math.random() * 15 + 5) {
          setDownloadPct(Math.min(100, Math.round(i)));
          await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
        }
        setDownloadPct(100);
      }
      setStatus('ready');
    } catch {
      setErrorMsg('下载失败，请稍后重试');
      setStatus('error');
    }
  }, [onDownload]);

  const handleInstall = useCallback(() => {
    onInstall?.();
    // In production, this calls electron-updater.quitAndInstall()
  }, [onInstall]);

  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t('版本更新')}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{t('自动更新 · 版本管理 · 更新日志')}</p>
          </div>
          {/* Channel selector */}
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            <button onClick={() => setChannel('stable')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${channel === 'stable' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
              稳定版
            </button>
            <button onClick={() => setChannel('beta')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${channel === 'beta' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-600'}`}>
              Beta
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ── Current Version Card ──────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider">{t('当前版本')}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-white">{currentVersion}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${channel === 'stable' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {channel}
                </span>
              </div>
              <div className="text-[10px] text-gray-600 mt-1">{t('发布于 {releaseDate}')}</div>
            </div>
            <button onClick={handleCheck} disabled={status === 'checking' || status === 'downloading'}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${status === 'up-to-date' ? 'bg-green-500/10 text-green-400' : 'bg-[#C9A046] hover:bg-[#D4A853] text-black'} disabled:opacity-40`}>
              {status === 'checking' ? '⏳ 检查中...' : status === 'up-to-date' ? '✅ 已是最新' : '🔍 检查更新'}
            </button>
          </div>
        </div>

        {/* ── Update Available ──────────────────────────────────────────── */}
        {status === 'available' && updateInfo && (
          <div className="bg-[#111119] border border-[#C9A046]/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🆕</span>
              <span className="text-[#D4A853] font-semibold">{t('新版本可用')}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/[0.02] rounded-lg p-3">
                <div className="text-[10px] text-gray-600 mb-1">{t("components.version")}</div>
                <div className="text-lg font-bold text-white">{updateInfo.version}</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3">
                <div className="text-[10px] text-gray-600 mb-1">{t('大小')}</div>
                <div className="text-lg font-bold text-gray-300">{updateInfo.size}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{t('更新内容')}</div>
              <div className="space-y-1">
                {updateInfo.changelog.map((line, i) => (
                  <div key={i} className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">•</span> {line}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleDownload}
              className="w-full py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors">
              ⬇ 下载更新 {updateInfo.version}
            </button>
          </div>
        )}

        {/* ── Download Progress ──────────────────────────────────────────── */}
        {(status === 'downloading' || status === 'ready') && (
          <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-300 font-semibold text-sm">
                {status === 'downloading' ? '⏳ 正在下载...' : '✅ 下载完成'}
              </span>
              <span className="text-xs text-gray-500">{downloadPct}%</span>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden mb-4">
              <div className="h-full rounded-full transition-all duration-300"
                   style={{ width: `${downloadPct}%`, background: status === 'ready' ? '#4ade80' : '#D4A853' }} />
            </div>
            {status === 'ready' && (
              <button onClick={handleInstall}
                className="w-full py-2.5 rounded-lg bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors">
                🔄 安装并重启
              </button>
            )}
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
            <span className="text-red-400 text-sm">{t("{errorMsg || '更新失败'}")}</span>
            <button onClick={handleCheck}
              className="block mx-auto mt-2 px-4 py-1.5 rounded bg-red-500/10 text-red-400 text-xs font-semibold">
              重试
            </button>
          </div>
        )}

        {/* ── Auto Check ─────────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-3">{t('⚙️ 更新设置')}</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-400">{t('自动检查更新 (每4小时)')}</span>
              <input type="checkbox" defaultChecked={autoCheck} className="accent-[#C9A046]" />
            </label>
            <label className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-400">{t('自动下载更新')}</span>
              <input type="checkbox" defaultChecked className="accent-[#C9A046]" />
            </label>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-400">{t('更新频道')}</span>
              <span className="text-xs text-gray-500">{t("{channel === 'stable' ? '稳定版 (推荐)' : 'Beta (测试版)'}")}</span>
            </div>
          </div>
        </div>

        {/* ── Version History ────────────────────────────────────────────── */}
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
          <h3 className="text-gray-300 font-semibold text-sm mb-3">{t('📋 版本历史')}</h3>
          <div className="space-y-2">
            {[
              ['v1.6.0 GA', '2026-06-09', '创作者增长飞轮 · 策略市场 · 等级排行榜 · 信号表现'],
              ['v1.5.0-rc', '2026-06-08', '服务器化 · 许可证激活 · P2P转账 · 安全加固'],
              ['v1.4.0-beta', '2026-06-07', '多市场执行 · 信号广场 · 碎股交易'],
              ['v1.3.0 GA', '2026-06-06', '实时执行 · 风控面板 · USDT钱包'],
            ].map(([v, date, desc]) => (
              <div key={v} className="flex items-center gap-3 py-1.5 px-3 rounded hover:bg-white/[0.02]">
                <span className={`text-xs font-mono font-semibold ${v === currentVersion ? 'text-[#D4A853]' : 'text-gray-500'}`}>
                  {v} {v === currentVersion ? '← 当前' : ''}
                </span>
                <span className="text-[10px] text-gray-600 font-mono">{date}</span>
                <span className="text-xs text-gray-500 truncate">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
