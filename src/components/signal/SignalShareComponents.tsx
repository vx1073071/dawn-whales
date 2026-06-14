/**
 * TradingEasy R124 J02 — Signal Share UI Components
 * 
 * 5 components per spec docs/design/signal-share-ui-design.md:
 *   SignalShareButton → SignalShareModal → 生成链接+QR
 *   SignalPreviewCard → 落地展示
 *   CopyTradeConfirmModal → 跟单确认
 * 
 * + IPC bridge: signal:share / signal:get-shared / signal:copy-trade / signal:stop-copy / signal:get-copies
 */

import React, { useState, useCallback, useEffect } from 'react';

// ═══════════ Types ════════════════════════════════════════

export interface SignalMeta {
  strategyId: string;
  strategyName: string;
  providerId: string;
  providerName: string;
  return30d: number;       // percentage
  winRate: number;         // percentage
  maxDrawdown: number;
  sharpeRatio?: number;
  riskLevel: 'low' | 'medium' | 'high';
  profitSplit: number;     // percentage (15 = 15%)
  followerCount?: number;
  recentTrades?: Array<{
    symbol: string;
    side: 'BUY' | 'SELL';
    pnlPct: number;
    date: string;
  }>;
  token: string;
}

export interface CopyTradeConfig {
  amount: number;          // USDT
  maxPerTrade: number;
  brokerId: string;
  stopLossPct: number;
}

// ═══════════ IPC Bridge ══════════════════════════════════

const ipc = () => (window as any).api ?? {};
const signalIpc = () => ipc().signal ?? {};

async function shareSignal(meta: Omit<SignalMeta, 'token'>): Promise<SignalMeta | null> {
  try {
    const result = await signalIpc().share(meta);
    return result?.success ? result.signal : null;
  } catch { return null; }
}

async function getSharedSignal(token: string): Promise<SignalMeta | null> {
  try {
    const result = await signalIpc().getShared(token);
    return result?.success ? result.signal : null;
  } catch { return null; }
}

async function startCopyTrade(token: string, config: CopyTradeConfig): Promise<boolean> {
  try {
    const result = await signalIpc().copyTrade(token, config);
    return result?.success ?? false;
  } catch { return false; }
}

async function stopCopyTrade(token: string): Promise<boolean> {
  try {
    const result = await signalIpc().stopCopy(token);
    return result?.success ?? false;
  } catch { return false; }
}

async function getCopyList(): Promise<any[]> {
  try {
    const result = await signalIpc().getCopies();
    return result?.success ? result.copies : [];
  } catch { return []; }
}

// ═══════════ SignalShareButton ═══════════════════════════

interface ShareButtonProps {
  meta: Omit<SignalMeta, 'token'>;
  onShared?: (signal: SignalMeta) => void;
}

export const SignalShareButton: React.FC<ShareButtonProps> = ({ meta, onShared }) => {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    const result = await shareSignal(meta);
    setSharing(false);
    if (result) onShared?.(result);
  };

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg border border-[#30363d] bg-[#161b22] text-[#c9d1d9] hover:bg-[#1c2333] hover:border-[#58a6ff] transition-colors disabled:opacity-50"
      title="分享交易信号"
    >
      {sharing ? '⏳' : '📤'} 分享
    </button>
  );
};

// ═══════════ SignalShareModal ═══════════════════════════

interface ShareModalProps {
  signal: SignalMeta;
  onClose: () => void;
}

export const SignalShareModal: React.FC<ShareModalProps> = ({ signal, onClose }) => {
  const shareUrl = `TradingEasy://signal/${signal.token}`;
  const [copied, setCopied] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [liveUpdate, setLiveUpdate] = useState(false);

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareTo = (platform: string) => {
    const text = `🔥 ${signal.strategyName}\n30天收益: ${signal.return30d > 0 ? '+' : ''}${signal.return30d}% | 胜率: ${signal.winRate}%\n${shareUrl}`;
    const urls: Record<string, string> = {
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      wechat: '#', // WeChat requires SDK
    };
    if (urls[platform] !== '#') window.open(urls[platform], '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#c9d1d9] mb-4 flex items-center gap-2">
          📤 分享交易信号
        </h3>

        {/* Signal Summary */}
        <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-[#c9d1d9]">{signal.strategyName}</p>
              <p className="text-[10px] text-[#484f58]">{signal.providerName}</p>
            </div>
            <span className={`text-sm font-semibold ${signal.return30d >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {signal.return30d >= 0 ? '+' : ''}{signal.return30d}%
            </span>
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-[#8b949e]">
            <span>胜率 {signal.winRate}%</span>
            <span>回撤 {signal.maxDrawdown}%</span>
            {signal.sharpeRatio != null && <span>夏普 {signal.sharpeRatio}</span>}
            <span className="text-[#f0883e]">分润 {signal.profitSplit}%</span>
          </div>
        </div>

        {/* Share Link */}
        <div className="mb-3">
          <label className="text-[10px] text-[#8b949e] mb-1 block">🔗 分享链接</label>
          <div className="flex items-center gap-2">
            <input
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 text-[11px] font-mono bg-[#0d1117] border border-[#30363d] rounded-lg text-[#58a6ff] outline-none"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copyLink}
              className="px-3 py-2 text-[11px] rounded-lg border border-[#30363d] bg-[#1c2333] text-[#c9d1d9] hover:bg-[#21262d]"
            >
              {copied ? '✅' : '📋'}
            </button>
          </div>
        </div>

        {/* QR Placeholder */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-[#0d1117] border border-[#21262d] rounded-lg">
            <span className="text-[10px] text-[#484f58]">QR Code</span>
          </div>
          <p className="text-[9px] text-[#484f58] mt-1">扫码分享</p>
        </div>

        {/* Share Platforms */}
        <div className="flex gap-2 mb-3">
          {[
            { id: 'wechat', label: '微信' },
            { id: 'telegram', label: 'Telegram' },
            { id: 'twitter', label: 'Twitter' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => shareTo(p.id)}
              className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-[#30363d] bg-[#1c2333] text-[#c9d1d9] hover:bg-[#21262d]"
            >
              {p.label}
            </button>
          ))}
          <button onClick={copyLink} className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-[#30363d] bg-[#1c2333] text-[#c9d1d9] hover:bg-[#21262d]">
            复制
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-1 text-[10px]">
          <label className="flex items-center gap-2 text-[#8b949e] cursor-pointer">
            <input type="checkbox" checked={includeHistory} onChange={() => setIncludeHistory(!includeHistory)} className="accent-[#58a6ff]" />
            包含最近交易记录
          </label>
          <label className="flex items-center gap-2 text-[#8b949e] cursor-pointer">
            <input type="checkbox" checked={liveUpdate} onChange={() => setLiveUpdate(!liveUpdate)} className="accent-[#58a6ff]" />
            实时更新(推送模式)
          </label>
        </div>
      </div>
    </div>
  );
};

// ═══════════ SignalPreviewCard ═══════════════════════════

interface PreviewProps {
  token: string;
  onStartCopy?: (meta: SignalMeta) => void;
}

export const SignalPreviewCard: React.FC<PreviewProps> = ({ token, onStartCopy }) => {
  const [meta, setMeta] = useState<SignalMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSharedSignal(token).then(result => {
      if (result) { setMeta(result); setError(''); }
      else { setError('信号已过期或不存在'); }
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="p-6 bg-[#0d1117] rounded-xl border border-[#21262d] text-center text-[#484f58]">
        加载信号中...
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="p-6 bg-[#330d17] rounded-xl border border-[#ef444440] text-center text-[#f85149] text-sm">
        {error || '无法加载信号'}
      </div>
    );
  }

  const riskColor = { low: 'text-[#22c55e]', medium: 'text-[#f59e0b]', high: 'text-[#ef4444]' };
  const riskLabel = { low: '低', medium: '中等', high: '高' };

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#1c2333] flex items-center justify-center text-lg">
          👤
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#c9d1d9]">{meta.providerName}</p>
          <p className="text-[10px] text-[#484f58]">
            跟单人数: {meta.followerCount?.toLocaleString() ?? 0}
          </p>
        </div>
        <span className="px-2 py-1 text-[10px] rounded-full bg-[#f0883e20] text-[#f0883e]">
          🔥 热门
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
        <div className="flex justify-between p-2 bg-[#161b22] rounded">
          <span className="text-[#8b949e]">30天收益</span>
          <span className={`font-semibold ${meta.return30d >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {meta.return30d >= 0 ? '+' : ''}{meta.return30d}%
          </span>
        </div>
        <div className="flex justify-between p-2 bg-[#161b22] rounded">
          <span className="text-[#8b949e]">胜率</span>
          <span className="font-semibold text-[#c9d1d9]">{meta.winRate}%</span>
        </div>
        <div className="flex justify-between p-2 bg-[#161b22] rounded">
          <span className="text-[#8b949e]">最大回撤</span>
          <span className="font-semibold text-[#ef4444]">{meta.maxDrawdown}%</span>
        </div>
        <div className="flex justify-between p-2 bg-[#161b22] rounded">
          <span className="text-[#8b949e]">夏普比率</span>
          <span className="font-semibold text-[#c9d1d9]">{meta.sharpeRatio ?? '—'}</span>
        </div>
      </div>

      <div className="flex justify-between p-2 mb-4 bg-[#161b22] rounded text-[11px]">
        <span className="text-[#8b949e]">分润比例</span>
        <span className="font-semibold text-[#f0883e]">{meta.profitSplit}%</span>
        <span className={`${riskColor[meta.riskLevel]}`}>风险: {riskLabel[meta.riskLevel]}</span>
      </div>

      {/* Recent Trades */}
      {meta.recentTrades && meta.recentTrades.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-[#8b949e] mb-2">最近交易</p>
          {meta.recentTrades.map((t, i) => (
            <div key={i} className="flex justify-between text-[10px] py-1 border-t border-[#21262d]">
              <span className="font-mono text-[#58a6ff]">{t.symbol}</span>
              <span className={t.side === 'BUY' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                {t.side === 'BUY' ? '多' : '空'}
              </span>
              <span className={t.pnlPct >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct}%
              </span>
              <span className="text-[#484f58]">{t.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onStartCopy?.(meta)}
        className="w-full py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-sm transition-colors"
      >
        🚀 开始跟单 · 分润 {meta.profitSplit}%
      </button>
    </div>
  );
};

// ═══════════ CopyTradeConfirmModal ═══════════════════════

interface CopyTradeProps {
  meta: SignalMeta;
  onConfirm: (config: CopyTradeConfig) => void;
  onCancel: () => void;
}

export const CopyTradeConfirmModal: React.FC<CopyTradeProps> = ({ meta, onConfirm, onCancel }) => {
  const [amount, setAmount] = useState(100);
  const [maxPerTrade, setMaxPerTrade] = useState(50);
  const [brokerId, setBrokerId] = useState('binance');
  const [stopLoss, setStopLoss] = useState(5);
  const [agreed, setAgreed] = useState(false);

  const brokers = ['binance', 'okx', 'bybit', 'bitget', 'futu'];
  const stopLossOptions = [3, 5, 10, 15, 20];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[420px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#c9d1d9] mb-4 flex items-center gap-2">
          ⚠️ 确认跟单
        </h3>

        <div className="space-y-3 mb-4 text-[11px]">
          <div className="flex justify-between">
            <span className="text-[#8b949e]">信号源</span>
            <span className="text-[#c9d1d9] font-semibold">{meta.providerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">分润比例</span>
            <span className="text-[#f0883e]">{meta.profitSplit}% (盈利部分)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">风险等级</span>
            <span className={meta.riskLevel === 'high' ? 'text-[#ef4444]' : meta.riskLevel === 'medium' ? 'text-[#f59e0b]' : 'text-[#22c55e]'}>
              {meta.riskLevel === 'low' ? '低' : meta.riskLevel === 'medium' ? '中等' : '高'}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[10px] text-[#8b949e] block mb-1">跟单金额 (USDT)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min={10}
              className="w-full px-3 py-2 text-sm bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] outline-none focus:border-[#58a6ff]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] block mb-1">最大单笔 (USDT)</label>
            <input
              type="number"
              value={maxPerTrade}
              onChange={e => setMaxPerTrade(Number(e.target.value))}
              min={10}
              className="w-full px-3 py-2 text-sm bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] outline-none focus:border-[#58a6ff]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] block mb-1">扣费券商</label>
            <select
              value={brokerId}
              onChange={e => setBrokerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] outline-none focus:border-[#58a6ff]"
            >
              {brokers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#8b949e] block mb-1">止损比例</label>
            <select
              value={stopLoss}
              onChange={e => setStopLoss(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] outline-none focus:border-[#58a6ff]"
            >
              {stopLossOptions.map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-[10px] text-[#8b949e] mb-4 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} className="accent-[#58a6ff]" />
          我已阅读并同意《跟单协议》
        </label>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-[#30363d] text-[#8b949e] hover:bg-[#1c2333] text-sm">
            取消
          </button>
          <button
            onClick={() => onConfirm({ amount, maxPerTrade, brokerId, stopLossPct: stopLoss })}
            disabled={!agreed}
            className="flex-1 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            确认跟单
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════ SignalDeepLinkHandler ═══════════════════════

interface DeepLinkProps {
  onSignal?: (meta: SignalMeta) => void;
  onCopyTrade?: (meta: SignalMeta) => void;
}

export const SignalDeepLinkHandler: React.FC<DeepLinkProps> = ({ onSignal, onCopyTrade }) => {
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;

    const unsub = api.on('deep-link:signal', (data: { token: string; action?: 'view' | 'copy' }) => {
      if (!data?.token) return;
      getSharedSignal(data.token).then(meta => {
        if (!meta) return;
        if (data.action === 'copy') {
          onCopyTrade?.(meta);
        } else {
          onSignal?.(meta);
        }
      });
    });

    return () => { unsub?.(); };
  }, [onSignal, onCopyTrade]);

  return null; // Invisible component, just handles deep links
};

// ═══════════ UseSignalShare Hook (convenience) ═══════════

export function useSignalShare() {
  const [shareModalMeta, setShareModalMeta] = useState<SignalMeta | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [copyTradeMeta, setCopyTradeMeta] = useState<SignalMeta | null>(null);

  const openShare = useCallback(async (meta: Omit<SignalMeta, 'token'>) => {
    const result = await shareSignal(meta);
    if (result) setShareModalMeta(result);
  }, []);

  const openPreview = useCallback((token: string) => setPreviewToken(token), []);
  const openCopyTrade = useCallback((meta: SignalMeta) => setCopyTradeMeta(meta), []);

  const handleCopyConfirm = useCallback(async (config: CopyTradeConfig) => {
    if (!copyTradeMeta) return;
    const ok = await startCopyTrade(copyTradeMeta.token, config);
    setCopyTradeMeta(null);
    return ok;
  }, [copyTradeMeta]);

  return {
    shareModalMeta,
    setShareModalMeta,
    previewToken,
    setPreviewToken,
    copyTradeMeta,
    openShare,
    openPreview,
    openCopyTrade,
    handleCopyConfirm,
    getCopyList,
    stopCopyTrade,
  };
}
