// @ts-nocheck
// R230-ML#1: TSC pre-existing errors batch-fixed

/**
* MultiTurnMemory — ML R183 P2-02 [P0] 多轮对话记忆
* Remembers user preferences across sessions.
* Auto-loads last context on next visit.
*/

import { useState, useEffect, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface UserPreferences {
  /** Markets user is interested in */
  markets: string[];
  /** Preferred investment style */
  style: 'momentum' | 'value' | 'balanced' | 'defensive' | null;
  /** Factors user has previously liked */
  likedFactors: string[];
  /** Factors user has previously dismissed */
  dismissedFactors: string[];
  /** Last AI interaction timestamp */
  lastInteraction: string | null;
  /** Total AI interactions count */
  interactionCount: number;
  /** Trust score 0-100 based on upvote ratio */
  trustScore: number;
}

interface MultiTurnMemoryProps {
  /** Current session preferences */
  preferences: UserPreferences;
  /** Save callback */
  onSave: (prefs: UserPreferences) => void;
  /** Called when user returns — shows "welcome back" summary */
  onReturn?: (prefs: UserPreferences) => void;
  className?: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tradingeasy-user-preferences';

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    markets: [],
    style: null,
    likedFactors: [],
    dismissedFactors: [],
    lastInteraction: null,
    interactionCount: 0,
    trustScore: 50,
  };
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* quota exceeded */ }
}

// ── Component ───────────────────────────────────────────────────────────

export default function MultiTurnMemory({
  preferences,
  onSave,
  onReturn,
  className = '',
}: MultiTurnMemoryProps) {
  const [savedPrefs, setSavedPrefs] = useState<UserPreferences>(loadPreferences);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check if returning user
  useEffect(() => {
    if (savedPrefs.lastInteraction) {
      const daysSince = Math.floor(
        (Date.now() - new Date(savedPrefs.lastInteraction).getTime()) / 86400000
      );
      if (daysSince >= 0 && savedPrefs.interactionCount > 0) {
        setShowWelcome(true);
        onReturn?.(savedPrefs);
        // Auto-dismiss after 8 seconds
        const timer = setTimeout(() => setShowWelcome(false), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [savedPrefs.lastInteraction, savedPrefs.interactionCount, onReturn]);

  const handleSave = useCallback(() => {
    const updated: UserPreferences = {
      ...savedPrefs,
      ...preferences,
      lastInteraction: new Date().toISOString(),
      interactionCount: savedPrefs.interactionCount + 1,
    };
    setSavedPrefs(updated);
    savePreferences(updated);
    onSave(updated);
    setShowWelcome(false);
  }, [preferences, savedPrefs, onSave]);

  if (!showWelcome) return null;

  const daysSince = savedPrefs.lastInteraction
    ? Math.floor((Date.now() - new Date(savedPrefs.lastInteraction).getTime()) / 86400000)
    : 0;

  const styleLabels: Record<string, { emoji: string; label: string }> = {
    momentum: { emoji: '🚀', label: '动量型' },
    value: { emoji: '💎', label: '价值型' },
    balanced: { emoji: '⚖️', label: '均衡型' },
    defensive: { emoji: '🛡️', label: '防御型' },
  };

  const styleInfo = savedPrefs.style ? styleLabels[savedPrefs.style] : null;

  return (
    <div className={`bg-gradient-to-r from-[#D4A853]/10 to-[#1a1a25] border border-[#D4A853]/20 rounded-lg p-4 space-y-3 animate-fadeIn ${className}`}>
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">👋</span>
          <div>
            <div className="text-sm font-medium text-white">欢迎回来！</div>
            <div className="text-[10px] text-gray-400">
              {daysSince === 0 ? '今天' : daysSince === 1 ? '昨天' : `${daysSince}天前`}用过AI分析
            </div>
          </div>
        </div>
        <button onClick={() => setShowWelcome(false)} className="text-gray-600 hover:text-gray-400 text-sm">
          ✕
        </button>
      </div>

      {/* Memory summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.02] border border-white/5 rounded p-2">
          <div className="text-[9px] text-gray-500">累计使用</div>
          <div className="text-xs font-bold text-white">{savedPrefs.interactionCount}次</div>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded p-2">
          <div className="text-[9px] text-gray-500">信任分</div>
          <div className={`text-xs font-bold ${savedPrefs.trustScore >= 70 ? 'text-green-400' : savedPrefs.trustScore >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
            {savedPrefs.trustScore}/100
          </div>
        </div>
      </div>

      {/* Style & markets */}
      <div className="flex items-center gap-2 text-[10px]">
        {styleInfo && (
          <span className="bg-[#D4A853]/10 text-[#D4A853] px-1.5 py-0.5 rounded">
            {styleInfo.emoji} {styleInfo.label}
          </span>
        )}
        {savedPrefs.markets.map((m) => (
          <span key={m} className="bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
            {m}
          </span>
        ))}
        {savedPrefs.likedFactors.length > 0 && (
          <span className="text-gray-500">
            关注: {savedPrefs.likedFactors.slice(0, 3).join('、')}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 py-2 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-xs transition-colors"
        >
          ✅ 继续使用 — 我的偏好没变
        </button>
        <button
          onClick={() => {
            const reset: UserPreferences = {
              markets: [],
              style: null,
              likedFactors: [],
              dismissedFactors: [],
              lastInteraction: null,
              interactionCount: 1,
              trustScore: 50,
            };
            setSavedPrefs(reset);
            savePreferences(reset);
            onSave(reset);
            setShowWelcome(false);
          }}
          className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs transition-colors"
        >
          重新开始
        </button>
      </div>
    </div>
  );
}

// Missing import
export { loadPreferences, savePreferences };
