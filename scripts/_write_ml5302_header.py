import sys
sys.stdout.reconfigure(encoding='utf-8')

header = """/**
 * SignalFeed + CopyTradePanel - ML-53-02 [P0]
 * R53: v1.1.0-beta Social Trading - Signal Feed + Copy Trade UI
 */
import React, { useState, useCallback, useMemo } from 'react';

export interface FeedSignal {
  id: string; traderId: string; traderName: string; traderAvatar: string;
  symbol: string; direction: 'BUY' | 'SELL' | 'HOLD'; confidence: number;
  price: number; stopLoss?: number; takeProfit?: number; timestamp: string;
  strategyName: string; verified: boolean;
}
export interface CopyTradeConfig {
  traderId: string; traderName: string; mode: 'fixed' | 'proportional' | 'kelly';
  amount: number; maxPositionSize: number; stopLoss: boolean; maxDrawdownLimit: number;
}
export interface ActiveCopyTrade {
  id: string; config: CopyTradeConfig; startDate: string;
  totalPnl: number; totalPnlPercent: number; winRate: number;
  totalTrades: number; currentPosition: number; status: 'active' | 'paused' | 'stopped';
}
export interface SignalFeedProps {
  signals: FeedSignal[]; isLoading?: boolean; onCopyTrade?: (s: FeedSignal) => void;
  onSignalClick?: (id: string) => void; onFilterChange?: (f: SignalFilter) => void; className?: string;
}
export interface CopyTradePanelProps {
  activeTrades: ActiveCopyTrade[];
  availableTraders: Array<{id:string;name:string;avatar:string}>;
  onStartCopy: (c: CopyTradeConfig) => void; onStopCopy: (id: string) => void;
  onPauseCopy: (id: string) => void; onResumeCopy: (id: string) => void; className?: string;
}
export interface SignalFilter {
  direction?: 'BUY' | 'SELL' | 'ALL'; minConfidence?: number; verifiedOnly?: boolean;
}
"""
with open(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\scripts\_write_ml5302.py', 'w', encoding='utf-8') as f:
    f.write(header)
print('ok')
