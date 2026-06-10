/**
 * MultiAccountSwitcher — Multi-account selector with balance display
 * (ML-42-02, R42 Phase 6.0)
 *
 * Features:
 * - Dropdown account list with balances
 * - Quick switch between main (281756477617822986) and API (281756479319068137)
 * - Connection status indicator per account
 * - Total aggregated balance
 * - Mobile-friendly compact mode
 */

import { useTranslation } from "react-i18next";
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface AccountInfo {
  id: string;
  name: string;
  type: 'main' | 'api' | 'paper';
  balance: number;
  currency: string;
  todayPnl: number;
  todayPnlPct: number;
  connected: boolean;
  brokerInfo?: string;
}

// ── Mock accounts ────────────────────────────────────────────────────────

const MOCK_ACCOUNTS: AccountInfo[] = [
  {
    id: '281756477617822986',
    name: '主账户',
    type: 'main',
    balance: 17600000,
    currency: 'HKD',
    todayPnl: 28500,
    todayPnlPct: 0.16,
    connected: true,
    brokerInfo: 'Futu OpenD · 127.0.0.1:11111',
  },
  {
    id: '281756479319068137',
    name: 'API 交易账户',
    type: 'api',
    balance: 1490000,
    currency: 'HKD',
    todayPnl: -3200,
    todayPnlPct: -0.21,
    connected: true,
    brokerInfo: 'Futu OpenD · 127.0.0.1:11111',
  },
  {
    id: 'paper-001',
    name: '模拟盘',
    type: 'paper',
    balance: 1000000,
    currency: 'HKD',
    todayPnl: 5600,
    todayPnlPct: 0.56,
    connected: true,
    brokerInfo: 'Paper Trading',
  },
];

// ── Main Component ──────────────────────────────────────────────────────

interface MultiAccountSwitcherProps {
  activeAccountId?: string;
  onSwitch?: (accountId: string) => void;
  className?: string;
}

export const MultiAccountSwitcher: React.FC<MultiAccountSwitcherProps> = ({
  activeAccountId: externalActive,
  onSwitch,
  className,
}) => {
  const [activeId, setActiveId] = useState<string>(externalActive ?? MOCK_ACCOUNTS[0].id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
  const { t } = useTranslation();
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync external active
  useEffect(() => {
    if (externalActive) setActiveId(externalActive);
  }, [externalActive]);

  const activeAccount = useMemo(
    () => MOCK_ACCOUNTS.find(a => a.id === activeId) ?? MOCK_ACCOUNTS[0],
    [activeId]
  );

  const totalBalance = useMemo(
    () => MOCK_ACCOUNTS.reduce((s, a) => s + a.balance, 0),
    []
  );

  const totalPnl = useMemo(
    () => MOCK_ACCOUNTS.reduce((s, a) => s + a.todayPnl, 0),
    []
  );

  const handleSwitch = useCallback((id: string) => {
    setActiveId(id);
    setOpen(false);
    onSwitch?.(id);
  }, [onSwitch]);

  const formatBalance = (v: number) => {
    if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
    if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
    return v.toLocaleString();
  };

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg hover:border-gray-600 transition-colors"
      >
        {/* Connection dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          activeAccount.connected ? 'bg-emerald-500' : 'bg-red-500'
        }`} />

        {/* Account info */}
        <div className="text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-white truncate">
              {activeAccount.name}
            </span>
            <span className="text-[10px] text-gray-600 bg-gray-800/50 px-1 rounded flex-shrink-0">
              {activeAccount.type === 'main' ? '主' : activeAccount.type === 'api' ? 'API' : t('components.simulation')}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">
            {activeAccount.currency} {formatBalance(activeAccount.balance)}
          </div>
        </div>

        {/* Today PnL */}
        <span className={`text-[10px] font-mono flex-shrink-0 ${
          activeAccount.todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {activeAccount.todayPnl >= 0 ? '+' : ''}{formatBalance(activeAccount.todayPnl)}
        </span>

        {/* Chevron */}
        <svg className={`w-3 h-3 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[260px]">
          {/* Total bar */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="text-[10px] text-gray-500 uppercase">{t("components.totalAssets")}</div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                HKD {formatBalance(totalBalance)}
              </span>
              <span className={`text-[10px] font-mono ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{formatBalance(totalPnl)}
              </span>
            </div>
          </div>

          {/* Account list */}
          {MOCK_ACCOUNTS.map(account => (
            <button
              key={account.id}
              onClick={() => handleSwitch(account.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                account.id === activeId
                  ? 'bg-amber-500/10 border-l-2 border-amber-500'
                  : 'hover:bg-gray-800/40 border-l-2 border-transparent'
              }`}
            >
              {/* Dot + icon */}
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                account.connected ? 'bg-emerald-500' : 'bg-red-500'
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white">
                    {account.name}
                  </span>
                  <span className="text-[10px] text-gray-600 bg-gray-800/50 px-1 rounded">
                    {account.type === 'main' ? '主账户' : account.type === 'api' ? 'API' : t('components.simulation')}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500">
                  {account.currency} {formatBalance(account.balance)}
                </div>
              </div>

              <span className={`text-[10px] font-mono ${
                account.todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {account.todayPnl >= 0 ? '+' : ''}{formatBalance(account.todayPnl)}
              </span>

              {/* Active checkmark */}
              {account.id === activeId && (
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}

          {/* Add account hint */}
          <div className="px-4 py-2 border-t border-gray-800">
            <button className="w-full text-center text-[10px] text-gray-600 hover:text-gray-400 py-1">
              + 添加账户
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiAccountSwitcher;
